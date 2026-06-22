// Similarity scoring for the network map.
//
// Every pair of attendees gets a similarity score in [0, 1] from a
// weighted combination of component scores. Edges are drawn for pairs
// whose final score meets the threshold.
//
// Component types currently supported:
//   - 'jaccard'        Array overlap: |A ∩ B| / |A ∪ B|. For tag-style
//                      fields like `interests`, `tags`.
//   - 'exact_match'    Returns 1 if both values are non-empty and equal,
//                      0 otherwise. For categorical fields like
//                      `affiliation`, `country`.
//   - 'text_keywords'  Tokenize text (lowercase, strip punctuation,
//                      drop stopwords + words shorter than 3 letters),
//                      then Jaccard the resulting word sets. For free-
//                      form prose like `bio`.
//
// The chair can override DEFAULT_SIMILARITY_CONFIG by writing a
// `similarity_config` field into event.json (see js/generator/
// similarity-config.js for the wizard UI that produces that config).

// Compact stopword list. Keeps verbs and adjectives that might carry
// meaning ("teaches", "behavioral"); drops the ones that show up in
// almost every bio regardless of topic.
const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'all', 'am', 'an', 'and', 'any',
  'are', 'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below',
  'between', 'both', 'but', 'by', 'can', 'could', 'did', 'do', 'does',
  'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further',
  'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself',
  'him', 'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it',
  'its', 'itself', 'just', 'me', 'might', 'more', 'most', 'must', 'my',
  'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only',
  'or', 'other', 'our', 'ours', 'out', 'over', 'own', 'same', 'she',
  'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs',
  'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those',
  'through', 'to', 'too', 'under', 'until', 'up', 'us', 'very', 'was',
  'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom',
  'why', 'will', 'with', 'would', 'you', 'your', 'yours', 'yourself',
]);

export const DEFAULT_SIMILARITY_CONFIG = {
  threshold: 0.3,
  components: [
    { field: 'interests',   type: 'jaccard',       weight: 1.0, enabled: true,
      label: 'Shared interests',
      hint: 'Two people show up as connected when their interest lists overlap.' },
    { field: 'affiliation', type: 'exact_match',   weight: 0.6, enabled: true,
      label: 'Same affiliation',
      hint: 'Two people show up as connected when they list the same institution.' },
    { field: 'country',     type: 'exact_match',   weight: 0.3, enabled: false,
      label: 'Same country',
      hint: 'Off by default. Turn this on for events where geography matters.' },
    { field: 'bio',         type: 'text_keywords', weight: 0.3, enabled: true,
      label: 'Similar bios',
      hint: 'Two people show up as connected when their bios mention similar topics.' },
  ],
};

// Numeric weight → category. Used by the chair wizard and the attendee
// explainer card so both speak the same Low/Medium/High language.
export function weightCategory(weight) {
  const w = Number(weight) || 0;
  if (w <= 0) return 'off';
  if (w < 0.45) return 'low';
  if (w < 0.8) return 'medium';
  return 'high';
}

// Threshold (0.0 - 1.0) → category. Lower threshold = more edges shown
// (looser); higher = fewer (stricter).
export function thresholdCategory(threshold) {
  const t = Number(threshold) || 0;
  if (t < 0.2) return 'loose';
  if (t < 0.45) return 'balanced';
  return 'strict';
}

// Canonical numeric values the wizard writes when the chair picks a
// named category. Keeps localStorage values stable across sessions and
// gives the engine consistent inputs.
export const WEIGHT_BY_CATEGORY = { off: 0, low: 0.3, medium: 0.6, high: 1.0 };
export const THRESHOLD_BY_CATEGORY = { loose: 0.1, balanced: 0.3, strict: 0.55 };

function jaccard(a = [], b = []) {
  if (a.length === 0 && b.length === 0) return 0;
  const sa = new Set(a);
  const sb = new Set(b);
  let intersection = 0;
  for (const x of sa) if (sb.has(x)) intersection++;
  const union = sa.size + sb.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function tokenizeText(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOPWORDS.has(w));
}

function componentScore(a, b, comp) {
  const va = a[comp.field];
  const vb = b[comp.field];
  switch (comp.type) {
    case 'jaccard':
      return jaccard(Array.isArray(va) ? va : [], Array.isArray(vb) ? vb : []);
    case 'exact_match':
      return va && vb && va === vb ? 1 : 0;
    case 'text_keywords':
      return jaccard(tokenizeText(va), tokenizeText(vb));
    default:
      return 0;
  }
}

function normalizeConfig(config) {
  if (!config || typeof config !== 'object') return DEFAULT_SIMILARITY_CONFIG;
  const threshold = typeof config.threshold === 'number' ? config.threshold : DEFAULT_SIMILARITY_CONFIG.threshold;
  const components = Array.isArray(config.components) && config.components.length > 0
    ? config.components
    : DEFAULT_SIMILARITY_CONFIG.components;
  return { threshold, components };
}

export function computeSimilarity(a, b, config) {
  const cfg = normalizeConfig(config);
  let total = 0;
  for (const comp of cfg.components) {
    if (comp.enabled === false) continue;
    const s = componentScore(a, b, comp);
    total += s * (Number(comp.weight) || 0);
  }
  return Math.min(1, total);
}

export function computeEdges(attendees, configOrThreshold) {
  // Backwards compatibility: callers used to pass a number (the threshold).
  // Convert to a default config with that threshold.
  let cfg;
  if (typeof configOrThreshold === 'number') {
    cfg = { ...DEFAULT_SIMILARITY_CONFIG, threshold: configOrThreshold };
  } else {
    cfg = normalizeConfig(configOrThreshold);
  }
  const threshold = cfg.threshold;
  const edges = [];
  for (let i = 0; i < attendees.length; i++) {
    for (let j = i + 1; j < attendees.length; j++) {
      const w = computeSimilarity(attendees[i], attendees[j], cfg);
      if (w >= threshold) {
        edges.push({ source: attendees[i].attendee_id, target: attendees[j].attendee_id, weight: w });
      }
    }
  }
  return edges;
}

// Internal helpers exposed for testing.
export const _internals = { jaccard, tokenizeText, componentScore, normalizeConfig };
