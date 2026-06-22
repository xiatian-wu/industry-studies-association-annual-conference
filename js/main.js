import { loadData } from './data.js';
import { renderSchedule } from './schedule.js';
import { filterSessions, getTimeSlots } from './filters.js';
import { computeEdges, DEFAULT_SIMILARITY_CONFIG, weightCategory } from './similarity.js';
import { renderGraph, roleColor } from './graph.js';
import { showProfileCard } from './profile-card.js';
import { createMultiSelect } from './multi-select.js';
import { renderVenue, hasVenueData } from './venue.js';
import { renderInfo, hasInfoContent } from './info.js';

const app = document.getElementById('app');
const daySlot = document.getElementById('day-slot');
const timeslotSlot = document.getElementById('timeslot-slot');
const trackSlot = document.getElementById('track-slot');
const searchInput = document.getElementById('search-input');
const graphContainer = document.getElementById('graph-container');
const graphSidebar = document.getElementById('graph-sidebar');
const focusControl = document.getElementById('focus-control');
const focusSelect = document.getElementById('focus-select');
const viewNav = document.getElementById('view-nav');
const scheduleView = document.getElementById('schedule-view');
const graphView = document.getElementById('graph-view');
const venueView = document.getElementById('venue-view');
const venueContainer = document.getElementById('venue-container');
const venueTab = document.getElementById('venue-tab');
const infoView = document.getElementById('info-view');
const infoContainer = document.getElementById('info-container');
const infoTab = document.getElementById('info-tab');
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const expandAllBtn = document.getElementById('expand-all');
const collapseAllBtn = document.getElementById('collapse-all');
const resetFiltersBtn = document.getElementById('reset-filters');
const eventTitleEl = document.getElementById('event-title');
const eventDescriptionEl = document.getElementById('event-description');
const eventLogoEl = document.getElementById('event-logo');
const eventWebsiteEl = document.getElementById('event-website');

function applyEventDetails(ed) {
  if (!ed || typeof ed !== 'object') return;
  if (ed.name) {
    document.title = ed.name;
    eventTitleEl.textContent = ed.name;
  }
  if (ed.description) {
    eventDescriptionEl.textContent = ed.description;
    eventDescriptionEl.hidden = false;
  } else {
    eventDescriptionEl.hidden = true;
  }
  if (ed.logoUrl) {
    eventLogoEl.src = ed.logoUrl;
    eventLogoEl.hidden = false;
  } else {
    eventLogoEl.hidden = true;
  }
  if (eventWebsiteEl) {
    if (ed.websiteUrl && /^https?:\/\//i.test(ed.websiteUrl)) {
      eventWebsiteEl.href = ed.websiteUrl;
      eventWebsiteEl.hidden = false;
    } else {
      eventWebsiteEl.hidden = true;
    }
  }
}

let allData = null;
const filters = { date: null, track: null, query: '', timeSlot: null };
let visibleIds = null;
let focusId = null;

let dayMs = null;
let timeslotMs = null;
let trackMs = null;
const graphFilterControls = [];

function renderScheduleView() {
  const filtered = filterSessions(allData, filters);
  renderSchedule({ ...allData, sessions: filtered }, app);
}

// Attendees who consented to appear on the network map. Absent or empty
// show_in_network defaults to true so chairs uploading the old template
// (without the column) keep their previous behavior.
function networkAttendees() {
  return allData.attendees.filter(a => a.show_in_network !== false);
}

function renderNetworkExplainer(config) {
  const host = document.getElementById('network-explainer');
  if (!host) return;
  const cfg = (config && Array.isArray(config.components) && config.components.length > 0)
    ? config
    : DEFAULT_SIMILARITY_CONFIG;
  const active = cfg.components.filter(c => c.enabled !== false && (Number(c.weight) || 0) > 0);
  host.replaceChildren();

  const title = document.createElement('div');
  title.className = 'network-explainer-title';
  title.textContent = 'How people are connected';
  host.appendChild(title);

  const lead = document.createElement('p');
  lead.className = 'network-explainer-lead';
  if (active.length === 0) {
    lead.textContent = "Nothing is set up to link people together, so every dot stands on its own.";
  } else {
    lead.textContent = "Two people are linked when they have things in common:";
  }
  host.appendChild(lead);

  if (active.length === 0) return;

  const list = document.createElement('ul');
  list.className = 'network-explainer-list';
  for (const c of active) {
    const li = document.createElement('li');
    const label = document.createElement('span');
    label.className = 'network-explainer-label';
    label.textContent = c.label || c.field;
    const cat = weightCategory(c.weight);
    const badge = document.createElement('span');
    badge.className = 'network-explainer-weight';
    badge.dataset.level = cat;
    badge.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
    li.appendChild(label);
    li.appendChild(badge);
    list.appendChild(li);
  }
  host.appendChild(list);

  const footer = document.createElement('p');
  footer.className = 'network-explainer-foot';
  footer.textContent = 'Thicker lines mean more in common.';
  host.appendChild(footer);

  const privacy = document.createElement('p');
  privacy.className = 'network-explainer-foot';
  privacy.textContent = 'Only attendees who chose to appear on the network are shown here.';
  host.appendChild(privacy);
}

function renderGraphView() {
  const consented = networkAttendees();
  const config = (allData.eventDetails && allData.eventDetails.similarity_config) || undefined;
  const edges = computeEdges(consented, config);
  renderGraph(consented, edges, graphContainer, {
    onNodeClick: (attendee) => showProfileCard(attendee),
    focusId,
    visibleIds,
  });
  // renderGraph wipes graphContainer.innerHTML, so re-attach the legend overlay every time.
  if (roleLegendEl) graphContainer.appendChild(roleLegendEl);
  renderNetworkExplainer(config);
}

function formatTimeSlotLabel(slot, includeDate) {
  const time = `${slot.start_time} – ${slot.end_time}`;
  return includeDate ? `${slot.date} ${time}` : time;
}

function rebuildTimeslotSelect() {
  timeslotSlot.innerHTML = '';
  const dateFilter = filters.date;
  let pool = allData.sessions;
  if (dateFilter) {
    pool = pool.filter(s => dateFilter.has(s.date));
  }
  const slots = getTimeSlots(pool);
  const includeDate = !dateFilter || dateFilter.size !== 1;
  timeslotMs = createMultiSelect({
    label: 'Time slot',
    options: slots.map(s => ({ value: s.key, label: formatTimeSlotLabel(s, includeDate) })),
    onChange: (sel) => {
      filters.timeSlot = sel;
      renderScheduleView();
    },
  });
  timeslotSlot.appendChild(timeslotMs);
  filters.timeSlot = null;
}

function buildDayMultiSelect() {
  const dates = [...new Set(allData.sessions.map(s => s.date))].sort();
  dayMs = createMultiSelect({
    label: 'Day',
    options: dates.map(d => ({ value: d, label: d })),
    onChange: (sel) => {
      filters.date = sel;
      rebuildTimeslotSelect();
      renderScheduleView();
    },
  });
  daySlot.appendChild(dayMs);
}

function buildTrackMultiSelect() {
  const tracks = [...new Set(allData.sessions.map(s => s.track).filter(Boolean))].sort();
  trackMs = createMultiSelect({
    label: 'Track',
    options: tracks.map(t => ({ value: t, label: t })),
    onChange: (sel) => {
      filters.track = sel;
      renderScheduleView();
    },
  });
  trackSlot.appendChild(trackMs);
}

function wireSearch() {
  searchInput.addEventListener('input', () => {
    filters.query = searchInput.value;
    renderScheduleView();
  });
}

function wireSessionToggles() {
  expandAllBtn.addEventListener('click', () => {
    app.querySelectorAll('.session-body').forEach(el => el.classList.remove('hidden'));
  });
  collapseAllBtn.addEventListener('click', () => {
    app.querySelectorAll('.session-body').forEach(el => el.classList.add('hidden'));
  });
}

function wireResetFilters() {
  resetFiltersBtn.addEventListener('click', () => {
    filters.date = null;
    filters.timeSlot = null;
    filters.track = null;
    filters.query = '';
    if (dayMs) dayMs.clearSelection();
    if (trackMs) trackMs.clearSelection();
    searchInput.value = '';
    rebuildTimeslotSelect();
    renderScheduleView();
  });
}

function closeMobileSidebar() {
  document.querySelectorAll('.sidebar.mobile-open').forEach(s => s.classList.remove('mobile-open'));
  sidebarOverlay.classList.remove('show');
}

function wireSidebarToggle() {
  sidebarToggle.addEventListener('click', () => {
    const visibleSidebar = document.querySelector('main > section:not(.hidden) .sidebar');
    if (!visibleSidebar) return;
    const isOpen = visibleSidebar.classList.toggle('mobile-open');
    sidebarOverlay.classList.toggle('show', isOpen);
  });
  sidebarOverlay.addEventListener('click', closeMobileSidebar);
}

function wireViewNav() {
  viewNav.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-view]');
    if (!btn) return;
    const view = btn.dataset.view;
    [...viewNav.querySelectorAll('button')].forEach(x => x.classList.toggle('active', x === btn));
    closeMobileSidebar();
    scheduleView.classList.add('hidden');
    graphView.classList.add('hidden');
    if (venueView) venueView.classList.add('hidden');
    if (infoView) infoView.classList.add('hidden');
    if (view === 'schedule') {
      scheduleView.classList.remove('hidden');
    } else if (view === 'graph') {
      graphView.classList.remove('hidden');
      renderGraphView();
    } else if (view === 'venue') {
      venueView.classList.remove('hidden');
      renderVenue(allData.venue, venueContainer);
    } else if (view === 'info') {
      infoView.classList.remove('hidden');
      renderInfo(allData.info, infoContainer);
    }
  });
}

let selAff = null;
let selInt = null;
let selCountry = null;

function computeVisibleIds() {
  if (!selAff && !selInt && !selCountry) {
    visibleIds = null;
    return;
  }
  visibleIds = new Set(
    allData.attendees
      .filter(a =>
        (!selAff || selAff.has(a.affiliation)) &&
        (!selInt || (a.interests ?? []).some(i => selInt.has(i))) &&
        (!selCountry || (a.country && selCountry.has(a.country)))
      )
      .map(a => a.attendee_id)
  );
}

function buildAffiliationsMultiSelect() {
  const affiliations = [...new Set(networkAttendees().map(a => a.affiliation))].sort();
  if (affiliations.length === 0) return;
  const palette = d3.schemeTableau10;
  const ms = createMultiSelect({
    label: 'Affiliation',
    options: affiliations.map((a, i) => ({ value: a, label: a, color: palette[i % palette.length] })),
    onChange: (sel) => { selAff = sel; computeVisibleIds(); renderGraphView(); },
    renderOption: (opt) => {
      const wrap = document.createElement('span');
      wrap.style.display = 'flex';
      wrap.style.alignItems = 'center';
      wrap.style.gap = '0.4rem';
      const sw = document.createElement('span');
      sw.className = 'swatch';
      sw.style.background = opt.color;
      const txt = document.createElement('span');
      txt.textContent = opt.label;
      wrap.appendChild(sw);
      wrap.appendChild(txt);
      return wrap;
    },
  });
  graphSidebar.insertBefore(ms, focusControl);
  graphFilterControls.push(ms);
}

function buildInterestsMultiSelect() {
  const interests = [...new Set(networkAttendees().flatMap(a => a.interests ?? []))].sort();
  if (interests.length === 0) return;
  const ms = createMultiSelect({
    label: 'Interests',
    options: interests.map(i => ({ value: i, label: i })),
    onChange: (sel) => { selInt = sel; computeVisibleIds(); renderGraphView(); },
  });
  graphSidebar.insertBefore(ms, focusControl);
  graphFilterControls.push(ms);
}

function buildCountryMultiSelect() {
  const countries = [...new Set(networkAttendees().map(a => a.country).filter(Boolean))].sort();
  if (countries.length === 0) return;
  const ms = createMultiSelect({
    label: 'Country',
    options: countries.map(c => ({ value: c, label: c })),
    onChange: (sel) => { selCountry = sel; computeVisibleIds(); renderGraphView(); },
  });
  graphSidebar.insertBefore(ms, focusControl);
  graphFilterControls.push(ms);
}

let roleLegendEl = null;

function buildRoleLegend() {
  const roles = [...new Set(allData.attendees.map(a => a.role).filter(Boolean))].sort();
  if (roles.length === 0) {
    roleLegendEl = null;
    return;
  }
  const legend = document.createElement('div');
  legend.className = 'role-legend-overlay';
  const heading = document.createElement('strong');
  heading.textContent = 'Roles';
  legend.appendChild(heading);
  for (const role of roles) {
    const row = document.createElement('div');
    row.className = 'role-row';
    const swatch = document.createElement('span');
    swatch.className = 'role-swatch';
    swatch.style.borderColor = roleColor(role);
    const label = document.createElement('span');
    label.textContent = role;
    row.appendChild(swatch);
    row.appendChild(label);
    legend.appendChild(row);
  }
  roleLegendEl = legend;
}

function wireResetGraphFilters() {
  const btn = document.getElementById('reset-graph-filters');
  if (!btn) return;
  btn.addEventListener('click', () => {
    selAff = null;
    selInt = null;
    selCountry = null;
    visibleIds = null;
    focusId = null;
    for (const ms of graphFilterControls) {
      if (ms.clearSelection) ms.clearSelection();
    }
    if (focusSelect) focusSelect.value = '';
    renderGraphView();
  });
}

function populateFocusSelect() {
  const sortedAttendees = networkAttendees().slice().sort((a, b) =>
    a.first_name.localeCompare(b.first_name) || a.last_name.localeCompare(b.last_name)
  );
  for (const a of sortedAttendees) {
    const opt = document.createElement('option');
    opt.value = a.attendee_id;
    opt.textContent = `${a.first_name} ${a.last_name}`;
    focusSelect.appendChild(opt);
  }
  focusSelect.addEventListener('change', () => {
    focusId = focusSelect.value || null;
    renderGraphView();
  });
}

try {
  // The chair's preview iframe loads us with ?data=preview. Mark the body
  // so the responsive sidebar collapse is suppressed -- the chair always
  // wants to see the controls in the preview, not a hamburger toggle.
  try {
    if (new URLSearchParams(window.location.search).get('data') === 'preview') {
      document.body.classList.add('preview-mode');
    }
  } catch { /* URL parsing failure shouldn't block startup */ }

  allData = await loadData('data/');
  applyEventDetails(allData.eventDetails);
  if (venueTab) {
    venueTab.hidden = !hasVenueData(allData.venue);
  }
  if (infoTab) {
    infoTab.hidden = !hasInfoContent(allData.info);
  }
  buildDayMultiSelect();
  rebuildTimeslotSelect();
  buildTrackMultiSelect();
  wireSearch();
  wireSessionToggles();
  wireResetFilters();
  wireViewNav();
  wireSidebarToggle();
  buildAffiliationsMultiSelect();
  buildInterestsMultiSelect();
  buildCountryMultiSelect();
  buildRoleLegend();
  populateFocusSelect();
  wireResetGraphFilters();
  renderScheduleView();
} catch (err) {
  app.textContent = `Error: ${err.message}`;
}
