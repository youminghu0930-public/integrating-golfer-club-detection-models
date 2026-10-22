import { clippedBone, overlayTransform } from './pose-geometry.js';
const svgNS = 'http://www.w3.org/2000/svg';
const bodyEdges = [
  ['left_shoulder', 'right_shoulder'], ['left_shoulder', 'left_elbow'], ['left_elbow', 'left_wrist'],
  ['right_shoulder', 'right_elbow'], ['right_elbow', 'right_wrist'], ['left_shoulder', 'left_hip'],
  ['right_shoulder', 'right_hip'], ['left_hip', 'right_hip'], ['left_hip', 'left_knee'],
  ['left_knee', 'left_ankle'], ['right_hip', 'right_knee'], ['right_knee', 'right_ankle']
];
const headEdges = [
  [['nose', 'left_eye'], ['nose', 'right_eye'], ['left_eye', 'left_ear'], ['right_eye', 'right_ear'], ['left_ear', 'left_shoulder'], ['right_ear', 'right_shoulder']],
  [['nose', 'left_ear'], ['nose', 'right_ear'], ['nose', 'atlas'], ['nose', 'top_head']]
];
const usable = point => point && Number.isFinite(point[0]) && Number.isFinite(point[1]) && (point[2] === undefined || point[2] >= 0) && (point[0] !== 0 || point[1] !== 0);
const clubEdges = [
  ['golf_club_grip', 'golf_club_shaft_midpoint'],
  ['golf_club_shaft_midpoint', 'golf_club_heel'],
  ['golf_club_heel', 'golf_club_head'],
];
export const poseConnections = index => [...bodyEdges, ...headEdges[index], ...clubEdges];
const svg = (tag, attributes = {}) => {
  const node = document.createElementNS(svgNS, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
};
const format = (text, values) => text.replace(/\{(\w+)\}/g, (_, key) => values[key]);

export function createPoseOverlay(viewport, index, copy, selected, onSelect, { interactive = true } = {}) {
  const view = copy.modelLabel;
  const overlay = svg('svg', { class: `pose-overlay pose-overlay-${index}`, role: 'group', 'aria-label': format(copy.skeletonLabel, { view }), preserveAspectRatio: 'xMidYMid meet' });
  if (!interactive) overlay.setAttribute('aria-hidden', 'true');
  const tooltip = document.createElement('div');
  tooltip.className = 'pose-tooltip'; tooltip.hidden = true;
  tooltip.setAttribute('role', 'tooltip');
  const geometry = svg('g'); overlay.append(geometry);
  viewport.append(overlay, tooltip);
  let pose, features = [], sourceWidth, sourceHeight, hovered, radius;
  let transform = { zoom: 1, x: 0, y: 0 };
  const nameOf = name => copy.jointNames[name] || name.replaceAll('_', ' ');
  function positionTooltip(x, y) {
    const rect = viewport.getBoundingClientRect();
    const half = tooltip.offsetWidth / 2;
    tooltip.style.left = `${Math.max(half + 8, Math.min(rect.width - half - 8, x - rect.left))}px`;
    tooltip.style.top = `${Math.max(8, y - rect.top - tooltip.offsetHeight - 14)}px`;
  }
  function hitTest(event) {
    const matrix = geometry.getScreenCTM();
    if (!matrix) return;
    const inverse = matrix.inverse();
    const scale = Math.hypot(matrix.a, matrix.b);
    const x = inverse.a*event.clientX + inverse.c*event.clientY + inverse.e;
    const y = inverse.b*event.clientX + inverse.d*event.clientY + inverse.f;
    let joint, bone, jointDistance = Math.max(8, radius*scale + 2), boneDistance = 6;
    for (const item of features) {
      if (!item.coordinates || item.group.style.display === 'none') continue;
      const [a, b] = item.coordinates;
      if (item.name) {
        const distance = Math.hypot(x - a[0], y - a[1]) * scale;
        if (distance < jointDistance) { joint = item; jointDistance = distance; }
      } else {
        const dx = b[0] - a[0], dy = b[1] - a[1];
        const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1)));
        const distance = Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy) * scale;
        if (distance < boneDistance) { bone = item; boneDistance = distance; }
      }
    }
    return joint || bone;
  }
  const clearHover = () => {
    hovered?.group.classList.remove('is-hovered'); hovered = undefined; tooltip.hidden = true;
    viewport.style.cursor = '';
  };
  viewport.addEventListener('pointermove', event => {
    if (!interactive) return;
    if (event.buttons || viewport.dataset.dragging === 'true') { clearHover(); return; }
    const item = hitTest(event);
    if (hovered !== item) { clearHover(); hovered = item; }
    if (!item) return;
    item.group.classList.add('is-hovered'); viewport.style.cursor = 'pointer';
    tooltip.textContent = item.label; tooltip.hidden = false;
    positionTooltip(event.clientX, event.clientY);
  });
  viewport.addEventListener('pointerleave', clearHover);
  viewport.addEventListener('pointerdown', clearHover, true);
  viewport.addEventListener('wheel', clearHover, { passive: true });
  viewport.addEventListener('click', event => {
    if (!interactive) return;
    // Resolve overlapping hit areas by distance, rather than SVG stacking order.
    const item = event.detail === 0
      ? features.find(item => item.group === event.target.closest('.pose-feature'))
      : hitTest(event);
    onSelect(item?.key ?? null, event.shiftKey); tooltip.hidden = true;
  });
  function feature(key, label, nodes) {
    const group = svg('g', { class: 'pose-feature', role: 'button', tabindex: '0', 'aria-label': format(copy.featureLabel, { view, feature: label }), 'aria-pressed': 'false', 'data-feature': key });
    if (!interactive) { group.removeAttribute('role'); group.removeAttribute('tabindex'); }
    group.style.display = 'none';
    group.append(...nodes);
    geometry.append(group);
    if (!interactive) return { key, label, group, nodes };
    const leave = () => { group.classList.remove('is-hovered'); tooltip.hidden = true; };
    group.addEventListener('focus', () => {
      group.classList.add('is-hovered'); tooltip.textContent = group.dataset.hint || label; tooltip.hidden = false;
      const rect = group.getBoundingClientRect(); positionTooltip(rect.left + rect.width / 2, rect.top);
    });
    group.addEventListener('blur', leave);
    const toggle = event => { onSelect(key, event.shiftKey); tooltip.hidden = true; };
    group.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); toggle(event); }
    });
    return { key, label, group, nodes };
  }
  return {
    setPose(data, width, height) {
      clearHover(); pose = data; features = []; geometry.replaceChildren();
      sourceWidth = width; sourceHeight = height;
      radius = Math.max(width, height)/190;
      overlay.setAttribute('viewBox', `0 0 ${width} ${height}`);
      const names = new Set(pose.joints);
      for (const [a, b] of poseConnections(index)) {
        if (!names.has(a) || !names.has(b)) continue;
        const label = format(copy.connectionLabel, { from: nameOf(a), to: nameOf(b) });
        const item = feature(`bone:${[a, b].sort().join(':')}`, label, [svg('line', { class: 'bone-hit' }), svg('line', { class: 'bone-line' })]);
        features.push({ ...item, a, b });
      }
      // Joint targets sit above bone targets so endpoints remain easy to select.
      for (const name of pose.joints) {
        const side = name.startsWith('left_') ? '#3b82f6' : name.startsWith('right_') ? '#ef4444' : 'var(--pose-color)';
        const item = feature(`joint:${name}`, nameOf(name), [svg('circle', { class: 'joint-hit', r: radius }), svg('circle', { class: 'joint-dot', r: radius*.65, fill: side }), svg('circle', { class: 'joint-ring', r: radius, fill: 'none' })]);
        features.push({ ...item, name });
      }
      this.updateSelection();
      this.setTransform(transform);
    },
    setTransform(state) {
      transform = state; clearHover();
      if (sourceWidth && sourceHeight) geometry.setAttribute('transform', overlayTransform(sourceWidth, sourceHeight, viewport.clientWidth, viewport.clientHeight, state));
    },
    updateSelection() {
      for (const { key, group } of features) {
        group.classList.toggle('is-selected', selected.has(key));
        group.setAttribute('aria-pressed', String(selected.has(key)));
      }
    },
    render(frame) {
      const joints = pose?.pred[frame];
      const points = Object.fromEntries((pose?.joints || []).map((name, i) => [name, joints?.[i]]));
      for (const item of features) {
        const { group, nodes, name, a, b } = item;
        const visible = name ? usable(points[name]) : usable(points[a]) && usable(points[b]);
        group.style.display = visible ? '' : 'none';
        if (!visible) continue;
        item.coordinates = name ? [points[name]] : [points[a], points[b]];
        const endpoints = !name && clippedBone(points[a], points[b], radius);
        if (!name && !endpoints) { group.style.display = 'none'; continue; }
        for (const node of nodes) {
          if (name) { node.setAttribute('cx', points[name][0]); node.setAttribute('cy', points[name][1]); }
          else if (!name) {
            node.setAttribute('x1', endpoints[0][0]); node.setAttribute('y1', endpoints[0][1]);
            node.setAttribute('x2', endpoints[1][0]); node.setAttribute('y2', endpoints[1][1]);
          }
        }
      }
    },
    clear() { clearHover(); geometry.replaceChildren(); features = []; }
  };
}
