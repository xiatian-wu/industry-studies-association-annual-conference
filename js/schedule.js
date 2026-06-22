import { showProfileCard } from './profile-card.js';
import {
  parseSessionDateTime, formatDateLong, formatTimeRange,
  googleCalendarUrl, downloadIcs,
} from './calendar.js';

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function presentersForSession(session, presentations, attendees) {
  if (session.presenter_ids && session.presenter_ids.length > 0) {
    return session.presenter_ids
      .map(id => attendees.find(a => a.attendee_id === id))
      .filter(Boolean);
  }
  const ids = presentations
    .filter(p => p.session_id === session.session_id)
    .flatMap(p => p.presenter_ids ?? []);
  return [...new Set(ids)]
    .map(id => attendees.find(a => a.attendee_id === id))
    .filter(Boolean);
}

function nestedPresentations(session, presentations) {
  return presentations.filter(p => p.session_id === session.session_id);
}

function presenterButton(attendee) {
  const btn = document.createElement('button');
  btn.className = 'presenter-link';
  btn.textContent = `${attendee.first_name} ${attendee.last_name}`;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    showProfileCard(attendee);
  });
  return btn;
}

function calendarMenu(session) {
  const wrap = document.createElement('div');
  wrap.className = 'calendar-menu';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'calendar-trigger';
  btn.innerHTML = 'Add to Calendar <span class="cal-arrow">▾</span>';
  wrap.appendChild(btn);

  const panel = document.createElement('div');
  panel.className = 'calendar-panel hidden';

  const gItem = document.createElement('button');
  gItem.type = 'button';
  gItem.className = 'calendar-item';
  gItem.innerHTML = '<span class="cal-ico">🌐</span> Google Calendar';
  gItem.addEventListener('click', (e) => {
    e.stopPropagation();
    window.open(googleCalendarUrl(session), '_blank', 'noopener,noreferrer');
    panel.classList.add('hidden');
  });
  panel.appendChild(gItem);

  const iItem = document.createElement('button');
  iItem.type = 'button';
  iItem.className = 'calendar-item';
  iItem.innerHTML = '<span class="cal-ico">📨</span> Apple / Outlook (.ics)';
  iItem.addEventListener('click', (e) => {
    e.stopPropagation();
    downloadIcs(session);
    panel.classList.add('hidden');
  });
  panel.appendChild(iItem);

  wrap.appendChild(panel);

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.toggle('hidden');
  });
  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) panel.classList.add('hidden');
  });

  return wrap;
}

const TRACK_PALETTE = [
  [59, 130, 246],   // blue
  [34, 197, 94],    // green
  [168, 85, 247],   // purple
  [249, 115, 22],   // orange
  [236, 72, 153],   // pink
  [234, 179, 8],    // amber
  [6, 182, 212],    // cyan
  [239, 68, 68],    // red
];

function trackColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  return TRACK_PALETTE[Math.abs(h) % TRACK_PALETTE.length];
}

function groupByDateThenStart(sessions) {
  const byDate = new Map();
  for (const s of sessions) {
    if (!byDate.has(s.date)) byDate.set(s.date, []);
    byDate.get(s.date).push(s);
  }
  for (const list of byDate.values()) {
    list.sort((a, b) => a.start_time.localeCompare(b.start_time));
  }
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export function renderSchedule(data, container) {
  const grouped = groupByDateThenStart(data.sessions);
  container.innerHTML = '';
  for (const [date, sessions] of grouped) {
    const dayEl = document.createElement('section');
    dayEl.className = 'day';
    const heading = document.createElement('h2');
    heading.textContent = date;
    dayEl.appendChild(heading);

    for (const session of sessions) {
      const card = document.createElement('article');
      card.className = 'session-card';
      const presenters = presentersForSession(session, data.presentations, data.attendees);
      const presentations = nestedPresentations(session, data.presentations);
      const start = parseSessionDateTime(session.date, session.start_time);
      const end = parseSessionDateTime(session.date, session.end_time);

      const locHtml = session.location
        ? `<span class="session-location"><span class="session-icon">📍</span> ${escapeHtml(session.location)}</span>`
        : '';
      const descHtml = session.description
        ? `<p class="session-description">${escapeHtml(session.description)}</p>`
        : '';
      const header = document.createElement('div');
      header.className = 'session-header';
      header.innerHTML = `
        <h3 class="session-title">${escapeHtml(session.title)}</h3>
        ${descHtml}
        <div class="session-datetime">
          <span><span class="session-icon">📅</span> ${escapeHtml(formatDateLong(start))}</span>
          <span><span class="session-icon">🕐</span> ${escapeHtml(formatTimeRange(start, end))}</span>
          ${locHtml}
        </div>
      `;
      card.appendChild(header);

      card.appendChild(calendarMenu(session));

      if (session.track) {
        const meta = document.createElement('div');
        meta.className = 'session-meta';
        const trackEl = document.createElement('span');
        trackEl.className = 'session-track';
        trackEl.textContent = session.track;
        const [r, g, b] = trackColor(session.track);
        trackEl.style.background = `rgba(${r}, ${g}, ${b}, 0.18)`;
        trackEl.style.color = `rgb(${r}, ${g}, ${b})`;
        meta.appendChild(trackEl);
        card.appendChild(meta);
      }

      const moderator = session.moderator_attendee_id
        ? data.attendees.find(a => a.attendee_id === session.moderator_attendee_id)
        : null;
      if (moderator) {
        const modEl = document.createElement('div');
        modEl.className = 'session-moderator';
        modEl.appendChild(document.createTextNode('Moderator: '));
        modEl.appendChild(presenterButton(moderator));
        card.appendChild(modEl);
      }

      const presEl = document.createElement('div');
      presEl.className = 'session-presenters';
      if (presenters.length > 0) {
        const label = document.createElement('span');
        label.className = 'presenters-label';
        label.textContent = 'Presenters: ';
        presEl.appendChild(label);
      }
      for (let i = 0; i < presenters.length; i++) {
        if (i > 0) presEl.appendChild(document.createTextNode(', '));
        presEl.appendChild(presenterButton(presenters[i]));
      }
      card.appendChild(presEl);

      const body = document.createElement('div');
      body.className = 'session-body hidden';
      if (presentations.length > 0) {
        const list = document.createElement('ul');
        list.className = 'presentation-list';
        for (const p of presentations) {
          const li = document.createElement('li');
          li.innerHTML = `<strong>${escapeHtml(p.title)}</strong>`;
          if (p.description) {
            const d = document.createElement('p');
            d.className = 'presentation-description';
            d.textContent = p.description;
            li.appendChild(d);
          }
          if (p.presenter_ids && p.presenter_ids.length > 0) {
            const presLine = document.createElement('div');
            presLine.className = 'presentation-presenters';
            for (let i = 0; i < p.presenter_ids.length; i++) {
              const a = data.attendees.find(x => x.attendee_id === p.presenter_ids[i]);
              if (!a) continue;
              if (i > 0) presLine.appendChild(document.createTextNode(', '));
              presLine.appendChild(presenterButton(a));
            }
            if (p.additional_credits && p.additional_credits.length > 0) {
              presLine.appendChild(document.createTextNode(`; ${p.additional_credits.join(', ')}`));
            }
            li.appendChild(presLine);
          }
          list.appendChild(li);
        }
        body.appendChild(list);
      }
      card.appendChild(body);

      // Expand affordance only when there's something to reveal (nested
      // presentations). Description is always visible in the header now.
      if (presentations.length > 0) {
        const chevron = document.createElement('button');
        chevron.type = 'button';
        chevron.className = 'session-expand';
        chevron.setAttribute('aria-label', 'Toggle session details');
        chevron.setAttribute('aria-expanded', 'false');
        chevron.textContent = '▾';
        header.appendChild(chevron);

        card.style.cursor = 'pointer';
        // Anywhere on the card toggles, except interactive children
        // (presenter buttons, calendar menu, links) and the expanded body
        // itself — so clicking inside the open list doesn't collapse it.
        card.addEventListener('click', (e) => {
          if (e.target.closest('button, a, .calendar-menu, .session-body')) return;
          toggle();
        });
        chevron.addEventListener('click', (e) => {
          e.stopPropagation();
          toggle();
        });
        function toggle() {
          const hidden = body.classList.toggle('hidden');
          chevron.setAttribute('aria-expanded', String(!hidden));
          card.classList.toggle('expanded', !hidden);
        }
      }

      dayEl.appendChild(card);
    }
    container.appendChild(dayEl);
  }
}
