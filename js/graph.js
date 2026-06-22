// Curated for maximum pairwise distinguishability at small swatch sizes:
// no two adjacent entries fall in the same hue family.
export const ROLE_PALETTE = ['#f59e0b', '#dc2626', '#16a34a', '#2563eb', '#a855f7', '#ec4899'];

// Common derived/canonical roles get fixed colors so they never collide
// with each other regardless of hash chance.
const PINNED_ROLES = {
  keynote: '#f59e0b',    // amber
  organizer: '#dc2626',  // red
  presenter: '#16a34a',  // emerald
  moderator: '#2563eb',  // royal blue
  panelist: '#a855f7',   // purple
  chair: '#ec4899',      // pink
};

export function roleColor(role) {
  if (!role) return null;
  const normalized = String(role).toLowerCase().trim();
  if (PINNED_ROLES[normalized]) return PINNED_ROLES[normalized];
  let h = 0;
  for (let i = 0; i < role.length; i++) h = ((h << 5) - h + role.charCodeAt(i)) | 0;
  return ROLE_PALETTE[Math.abs(h) % ROLE_PALETTE.length];
}

export function renderGraph(attendees, edges, container, options = {}) {
  const onNodeClick = options.onNodeClick ?? (() => {});
  const focusId = options.focusId ?? null;
  const visibleIds = options.visibleIds ?? null; // null means "all visible"

  container.innerHTML = '';

  const width = container.clientWidth || 800;
  const height = 600;

  const svg = d3.select(container).append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', [0, 0, width, height]);

  // Transparent background rect so pan-drag works from empty space.
  svg.append('rect')
    .attr('class', 'zoom-surface')
    .attr('width', width)
    .attr('height', height)
    .attr('fill', 'transparent')
    .style('pointer-events', 'all');

  // Single transform target for zoom + pan. All nodes and links live inside it.
  const viewport = svg.append('g').attr('class', 'viewport');

  let userInteracted = false;
  const zoom = d3.zoom()
    .scaleExtent([0.15, 6])
    .on('zoom', (event) => {
      viewport.attr('transform', event.transform);
      if (event.sourceEvent) userInteracted = true;
    });
  svg.call(zoom);
  svg.on('dblclick.zoom', null); // double-click reserved for future use

  const allAffiliations = [...new Set(attendees.map(a => a.affiliation))].sort();
  const palette = d3.schemeTableau10;
  const colorOf = (aff) => palette[allAffiliations.indexOf(aff) % palette.length];

  // Role-based visual emphasis. Empty/absent role → normal node.
  // Each distinct role string gets a stable color from a small palette.
  function nodeRadius(d) {
    if (d.id === focusId) return 14;
    if (d.role) return 12;
    return 9;
  }
  function nodeStrokeColor(d) {
    if (d.id === focusId) return 'var(--text)';
    if (d.role) return roleColor(d.role);
    return 'var(--surface)';
  }
  function nodeStrokeWidth(d) {
    if (d.id === focusId) return 3;
    if (d.role) return 2.5;
    return 1.5;
  }

  const isVisible = (a) => !visibleIds || visibleIds.has(a.attendee_id);
  const visibleAttendees = attendees.filter(isVisible);
  const renderIds = new Set(visibleAttendees.map(a => a.attendee_id));

  const filteredEdges = edges.filter(e => renderIds.has(e.source) && renderIds.has(e.target));

  const connectedToFocus = new Set();
  if (focusId) {
    connectedToFocus.add(focusId);
    for (const e of filteredEdges) {
      if (e.source === focusId) connectedToFocus.add(e.target);
      if (e.target === focusId) connectedToFocus.add(e.source);
    }
  }
  const dimOpacity = focusId ? 0.15 : 1;

  const nodes = visibleAttendees.map(a => ({ ...a, id: a.attendee_id }));
  const links = filteredEdges.map(e => ({ source: e.source, target: e.target, weight: e.weight }));

  const weightScale = d3.scaleLinear()
    .domain(links.length ? d3.extent(links, l => l.weight) : [0, 1])
    .range([1, 4]);

  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(d => 100 - 40 * d.weight))
    .force('charge', d3.forceManyBody().strength(-220))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collide', d3.forceCollide(22));

  const linkSel = viewport.append('g')
    .attr('class', 'links')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('stroke-width', d => weightScale(d.weight))
    .attr('stroke-opacity', d => {
      if (!focusId) return 0.5;
      const touchesFocus = d.source.id === focusId || d.target.id === focusId
        || d.source === focusId || d.target === focusId;
      return touchesFocus ? 0.8 : 0.05;
    });

  const nodeSel = viewport.append('g')
    .attr('class', 'nodes')
    .selectAll('g')
    .data(nodes)
    .join('g')
    .style('cursor', 'pointer')
    .style('opacity', d => focusId ? (connectedToFocus.has(d.id) ? 1 : dimOpacity) : 1)
    .on('click', (event, d) => onNodeClick(d))
    .call(d3.drag()
      .on('start', (event, d) => {
        userInteracted = true;
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
      .on('end', (event, d) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }));

  nodeSel.append('circle')
    .attr('r', nodeRadius)
    .attr('fill', d => colorOf(d.affiliation))
    .style('stroke', nodeStrokeColor)
    .attr('stroke-width', nodeStrokeWidth);

  nodeSel.append('text')
    .attr('dx', 13)
    .attr('dy', '0.35em')
    .attr('font-size', d => d.id === focusId ? 13 : 11)
    .attr('font-weight', d => d.id === focusId ? 'bold' : 'normal')
    .text(d => `${d.first_name} ${d.last_name}`);

  simulation.on('tick', () => {
    linkSel
      .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
    nodeSel.attr('transform', d => `translate(${d.x},${d.y})`);
  });

  function fitToView() {
    if (nodes.length === 0) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of nodes) {
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    }
    const padding = 60;
    const contentW = (maxX - minX) + padding * 2;
    const contentH = (maxY - minY) + padding * 2;
    const scale = Math.min(width / contentW, height / contentH, 1);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const tx = width / 2 - centerX * scale;
    const ty = height / 2 - centerY * scale;
    svg.transition().duration(400).call(
      zoom.transform,
      d3.zoomIdentity.translate(tx, ty).scale(scale)
    );
  }

  // Auto-fit once after the simulation has settled, unless the user
  // has already touched the graph.
  const settleTimer = setTimeout(() => {
    if (!userInteracted) fitToView();
  }, 1500);
  simulation.on('end', () => {
    if (!userInteracted) fitToView();
    clearTimeout(settleTimer);
  });

  // Floating zoom controls (top-right of graph container).
  const controls = document.createElement('div');
  controls.className = 'graph-controls';
  controls.innerHTML = `
    <button type="button" class="graph-ctrl" data-action="zoom-in" title="Zoom in" aria-label="Zoom in">+</button>
    <button type="button" class="graph-ctrl" data-action="zoom-out" title="Zoom out" aria-label="Zoom out">&minus;</button>
    <button type="button" class="graph-ctrl" data-action="fit" title="Fit to view" aria-label="Fit to view">&#9974;</button>
  `;
  container.appendChild(controls);
  controls.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'zoom-in') {
      userInteracted = true;
      svg.transition().duration(200).call(zoom.scaleBy, 1.4);
    } else if (action === 'zoom-out') {
      userInteracted = true;
      svg.transition().duration(200).call(zoom.scaleBy, 1 / 1.4);
    } else if (action === 'fit') {
      userInteracted = false; // explicit re-fit
      fitToView();
    }
  });

  return { simulation, svg, nodes, links, colorOf, affiliations: allAffiliations, fitToView };
}
