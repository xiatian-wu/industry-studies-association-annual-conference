export function parseSessionDateTime(dateStr, timeStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = (timeStr || '00:00').split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  weekday: 'long', month: 'short', day: 'numeric', year: 'numeric',
});
const TIME_FMT = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric', minute: '2-digit', hour12: true,
});

export function formatDateLong(date) {
  return DATE_FMT.format(date);
}

export function formatTime(date) {
  return TIME_FMT.format(date);
}

export function formatTimeRange(start, end) {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

function gcalLocalString(dateStr, timeStr) {
  // Google Calendar accepts YYYYMMDDTHHmmSS (floating local time).
  const [y, m, d] = dateStr.split('-');
  const [hh, mm] = (timeStr || '00:00').split(':');
  return `${y}${m}${d}T${hh}${mm}00`;
}

export function googleCalendarUrl(session) {
  const start = gcalLocalString(session.date, session.start_time);
  const end = gcalLocalString(session.date, session.end_time);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: session.title ?? '',
    dates: `${start}/${end}`,
    details: session.description ?? '',
    location: session.location ?? '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function icsEscape(s) {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function icsStamp() {
  // YYYYMMDDTHHmmSSZ in UTC
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
}

function sanitizeFilename(s) {
  return String(s ?? 'session')
    .replace(/[^a-z0-9 \-_]/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60) || 'session';
}

export function buildIcs(session) {
  const start = gcalLocalString(session.date, session.start_time);
  const end = gcalLocalString(session.date, session.end_time);
  const uid = `${session.session_id}-${session.date}@conference-connection`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Conference Connection//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${icsStamp()}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${icsEscape(session.title)}`,
    `DESCRIPTION:${icsEscape(session.description ?? '')}`,
    `LOCATION:${icsEscape(session.location ?? '')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}

export function downloadIcs(session) {
  const ics = buildIcs(session);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${sanitizeFilename(session.title)}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
