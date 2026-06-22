const PREVIEW_KEYS = {
  attendees: 'cc:preview:attendees',
  sessions: 'cc:preview:sessions',
  presentations: 'cc:preview:presentations',
  event: 'cc:preview:event',
  venue: 'cc:preview:venue',
  info: 'cc:preview:info',
};

function isPreviewMode() {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('data') === 'preview';
  } catch {
    return false;
  }
}

function readArrayFromSession(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readObjectFromSession(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function fetchEvent(basePath) {
  try {
    const res = await fetch(`${basePath}event.json`);
    if (res.ok) {
      const parsed = await res.json();
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* event.json is optional */
  }
  return {};
}

async function fetchVenue(basePath) {
  try {
    const res = await fetch(`${basePath}venue.json`);
    if (res.ok) {
      const parsed = await res.json();
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* venue.json is optional */
  }
  return {};
}

async function fetchInfo(basePath) {
  try {
    const res = await fetch(`${basePath}info.json`);
    if (res.ok) {
      const parsed = await res.json();
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* info.json is optional */
  }
  return {};
}

export function enrichRoles(data) {
  // Attaches an effective `role` to each attendee where derivable.
  // Explicit role on the attendee object always wins.
  const byId = new Map();
  for (const a of data.attendees) byId.set(a.attendee_id, a);
  for (const s of data.sessions ?? []) {
    for (const id of s.presenter_ids ?? []) {
      const a = byId.get(id);
      if (a && !a.role) a.role = 'presenter';
    }
    if (s.moderator_attendee_id) {
      const a = byId.get(s.moderator_attendee_id);
      if (a && !a.role) a.role = 'moderator';
    }
  }
  for (const p of data.presentations ?? []) {
    for (const id of p.presenter_ids ?? []) {
      const a = byId.get(id);
      if (a && !a.role) a.role = 'presenter';
    }
  }
  return data;
}

export async function loadData(basePath = 'data/') {
  if (isPreviewMode()) {
    return enrichRoles({
      attendees: readArrayFromSession(PREVIEW_KEYS.attendees),
      sessions: readArrayFromSession(PREVIEW_KEYS.sessions),
      presentations: readArrayFromSession(PREVIEW_KEYS.presentations),
      eventDetails: readObjectFromSession(PREVIEW_KEYS.event),
      venue: readObjectFromSession(PREVIEW_KEYS.venue),
      info: readObjectFromSession(PREVIEW_KEYS.info),
    });
  }

  const [attendeesRes, sessionsRes] = await Promise.all([
    fetch(`${basePath}attendees.json`),
    fetch(`${basePath}sessions.json`),
  ]);
  if (!attendeesRes.ok) throw new Error(`Failed to load ${basePath}attendees.json`);
  if (!sessionsRes.ok) throw new Error(`Failed to load ${basePath}sessions.json`);

  const attendees = await attendeesRes.json();
  const sessions = await sessionsRes.json();

  let presentations = [];
  const presRes = await fetch(`${basePath}presentations.json`);
  if (presRes.ok) {
    presentations = await presRes.json();
  }

  const eventDetails = await fetchEvent(basePath);
  const venue = await fetchVenue(basePath);
  const info = await fetchInfo(basePath);

  return enrichRoles({ attendees, sessions, presentations, eventDetails, venue, info });
}

export const _previewKeys = PREVIEW_KEYS;
