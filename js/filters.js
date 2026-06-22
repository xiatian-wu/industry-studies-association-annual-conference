function attendeeTokens(attendees, id) {
  const a = attendees.find(x => x.attendee_id === id);
  if (!a) return [];
  return [`${a.first_name} ${a.last_name}`, a.affiliation];
}

function sessionSearchText(session, attendees, presentations) {
  const parts = [
    session.title,
    session.description,
    session.location,
    session.track,
    session.session_type,
    ...(session.presenter_ids ?? []).flatMap(id => attendeeTokens(attendees, id)),
  ];
  const nested = presentations.filter(p => p.session_id === session.session_id);
  for (const p of nested) {
    parts.push(p.title, p.description);
    if (p.tags) parts.push(...p.tags);
    for (const id of p.presenter_ids ?? []) {
      parts.push(...attendeeTokens(attendees, id));
    }
    if (p.additional_credits) parts.push(...p.additional_credits);
  }
  return parts.filter(Boolean).join(' ').toLowerCase();
}

function asSet(v) {
  if (v == null) return null;
  if (v instanceof Set) return v.size === 0 ? null : v;
  if (Array.isArray(v)) return v.length === 0 ? null : new Set(v);
  return new Set([v]);
}

export function filterSessions(data, filters = {}) {
  const sessions = Array.isArray(data) ? data : (data.sessions ?? []);
  const attendees = Array.isArray(data) ? [] : (data.attendees ?? []);
  const presentations = Array.isArray(data) ? [] : (data.presentations ?? []);
  const dateSet = asSet(filters.date);
  const trackSet = asSet(filters.track);
  const timeSlotSet = asSet(filters.timeSlot);
  const q = (filters.query ?? '').trim().toLowerCase();
  return sessions.filter(s => {
    if (dateSet && !dateSet.has(s.date)) return false;
    if (trackSet && !trackSet.has(s.track)) return false;
    if (timeSlotSet) {
      const slotKey = `${s.date}|${s.start_time}|${s.end_time}`;
      if (!timeSlotSet.has(slotKey)) return false;
    }
    if (q) {
      const text = sessionSearchText(s, attendees, presentations);
      if (!text.includes(q)) return false;
    }
    return true;
  });
}

export function getTimeSlots(sessions, date = null) {
  const seen = new Set();
  const slots = [];
  for (const s of sessions) {
    if (date && s.date !== date) continue;
    const key = `${s.date}|${s.start_time}|${s.end_time}`;
    if (seen.has(key)) continue;
    seen.add(key);
    slots.push({ date: s.date, start_time: s.start_time, end_time: s.end_time, key });
  }
  slots.sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));
  return slots;
}
