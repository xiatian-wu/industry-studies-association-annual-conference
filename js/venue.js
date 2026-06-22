function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function safeImageUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (/^data:image\//i.test(url)) return url;
  // Allow same-origin relative paths (no scheme, no protocol-relative leading //).
  if (/^[a-zA-Z0-9._/-]+$/.test(url)) return url;
  return '';
}

function safeHttpUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    if (u.protocol === 'https:' || u.protocol === 'http:') return url;
  } catch { /* not parseable */ }
  return '';
}

export function hasVenueData(venue) {
  if (!venue || typeof venue !== 'object') return false;
  if (safeImageUrl(venue.venueMapUrl)) return true;
  if (Array.isArray(venue.floorPlans)
      && venue.floorPlans.some(f => f && safeImageUrl(f.imageUrl))) return true;
  return false;
}

export function renderVenue(venue, container) {
  container.innerHTML = '';
  if (!venue || typeof venue !== 'object') return;

  if (venue.name) {
    const h = document.createElement('h2');
    h.className = 'venue-heading';
    h.textContent = venue.name;
    container.appendChild(h);
  }

  const mapUrl = safeImageUrl(venue.venueMapUrl);
  const gmaps = safeHttpUrl(venue.googleMapsUrl || '');

  if (mapUrl || gmaps) {
    const mapBlock = document.createElement('div');
    mapBlock.className = 'venue-map-block';

    if (mapUrl) {
      const img = document.createElement('img');
      img.className = 'venue-map-image';
      img.src = mapUrl;
      img.alt = venue.name ? `${venue.name} overview map` : 'Overview map';
      mapBlock.appendChild(img);
    }

    if (gmaps) {
      const btn = document.createElement('a');
      btn.className = 'btn-action btn-primary venue-gmaps-link';
      btn.href = gmaps;
      btn.target = '_blank';
      btn.rel = 'noopener';
      btn.textContent = 'Open in Google Maps ↗';
      mapBlock.appendChild(btn);
    }

    container.appendChild(mapBlock);
  }

  const plans = (Array.isArray(venue.floorPlans) ? venue.floorPlans : [])
    .filter(fp => fp && safeImageUrl(fp.imageUrl));
  if (plans.length > 0) {
    const heading = document.createElement('h3');
    heading.className = 'venue-floorplans-heading';
    heading.textContent = 'Maps';
    container.appendChild(heading);

    const grid = document.createElement('div');
    grid.className = 'floorplan-grid';
    for (const fp of plans) {
      const card = document.createElement('figure');
      card.className = 'floorplan-card';
      const img = document.createElement('img');
      img.src = safeImageUrl(fp.imageUrl);
      img.alt = fp.caption || 'Floor plan';
      img.className = 'floorplan-image';
      card.appendChild(img);
      if (fp.caption) {
        const cap = document.createElement('figcaption');
        cap.className = 'floorplan-caption';
        cap.textContent = fp.caption;
        card.appendChild(cap);
      }
      grid.appendChild(card);
    }
    container.appendChild(grid);
  }
}
