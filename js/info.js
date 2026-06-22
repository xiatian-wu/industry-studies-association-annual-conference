export function hasInfoContent(info) {
  if (!info || typeof info !== 'object') return false;
  return typeof info.content === 'string' && info.content.trim().length > 0;
}

export function renderInfo(info, container) {
  container.innerHTML = '';
  if (!info || typeof info !== 'object') return;
  const body = document.createElement('div');
  body.className = 'info-body';
  body.textContent = info.content || '';
  container.appendChild(body);
}
