function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeImageUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (/^data:image\//i.test(url)) return url;
  return '';
}

let currentOverlay = null;

export function closeProfileCard() {
  if (currentOverlay) {
    currentOverlay.remove();
    currentOverlay = null;
  }
}

export function showProfileCard(attendee) {
  closeProfileCard();
  const overlay = document.createElement('div');
  overlay.className = 'profile-overlay';
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeProfileCard();
  });

  const card = document.createElement('div');
  card.className = 'profile-card';
  const interests = (attendee.interests ?? []).join(', ');
  const country = attendee.country ? ` · ${escapeHtml(attendee.country)}` : '';
  const role = attendee.role ? String(attendee.role).trim() : '';
  const headshotUrl = safeImageUrl(attendee.headshot_url);

  card.innerHTML = `
    <button class="profile-close" aria-label="Close">&times;</button>
    <div class="profile-head">
      <div class="profile-head-text">
        <h3>${escapeHtml(attendee.first_name)} ${escapeHtml(attendee.last_name)}${role ? ` <span class="profile-role" data-role="${escapeHtml(role.toLowerCase())}">${escapeHtml(role)}</span>` : ''}</h3>
        <p class="profile-affiliation">${escapeHtml(attendee.affiliation)}${country}</p>
      </div>
    </div>
    ${interests ? `<p><strong>Interests:</strong> ${escapeHtml(interests)}</p>` : ''}
  `;

  // Insert headshot via createElement (safer for arbitrary URLs).
  if (headshotUrl) {
    const headEl = card.querySelector('.profile-head');
    const img = document.createElement('img');
    img.className = 'profile-headshot';
    img.alt = '';
    img.src = headshotUrl;
    headEl.insertBefore(img, headEl.firstChild);
  }

  // LinkedIn link (before bio) with scheme guard.
  if (attendee.linkedin_url && /^https?:\/\//i.test(attendee.linkedin_url)) {
    const p = document.createElement('p');
    const link = document.createElement('a');
    link.href = attendee.linkedin_url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'LinkedIn profile →';
    p.appendChild(link);
    card.appendChild(p);
  }

  // Bio last, so LinkedIn sits between interests and bio.
  if (attendee.bio) {
    const bioEl = document.createElement('p');
    bioEl.className = 'profile-bio';
    bioEl.textContent = attendee.bio;
    card.appendChild(bioEl);
  }

  card.querySelector('.profile-close').addEventListener('click', closeProfileCard);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  currentOverlay = overlay;
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeProfileCard();
});
