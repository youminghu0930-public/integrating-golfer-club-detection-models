export function zoomView(state, zoom, anchor = { x: 0, y: 0 }) {
  const next = Math.max(1, Math.min(6, zoom));
  const ratio = next / state.zoom;
  return constrainView({ zoom: next, x: anchor.x - (anchor.x - state.x) * ratio, y: anchor.y - (anchor.y - state.y) * ratio });
}
export function constrainView(state) {
  if (state.zoom === 1) return { zoom: 1, x: 0, y: 0 };
  const limit = (state.zoom - 1) / 2;
  return { zoom: state.zoom, x: Math.max(-limit, Math.min(limit, state.x)), y: Math.max(-limit, Math.min(limit, state.y)) };
}

export function focusedView({ point, width, height, viewportWidth, viewportHeight, zoom = 2 }) {
  const scale = Math.min(viewportWidth/width, viewportHeight/height);
  if (!point || !scale || !viewportWidth || !viewportHeight) return constrainView({ zoom, x: 0, y: 0 });
  return constrainView({ zoom,
    x: -(point.x-width/2)*scale*zoom/viewportWidth,
    y: -(point.y-height/2)*scale*zoom/viewportHeight,
  });
}

export function installLinkedView(viewports, scenes, onChange, { resizeView, onInteraction } = {}) {
  let state = { zoom: 1, x: 0, y: 0 };
  function apply(next) {
    state = constrainView(next);
    viewports.forEach((viewport, i) => {
      const width = viewport.clientWidth, height = viewport.clientHeight;
      scenes[i].style.transform = `translate(${((1 - state.zoom) / 2 + state.x) * width}px, ${((1 - state.zoom) / 2 + state.y) * height}px) scale(${state.zoom})`;
      viewport.classList.toggle('is-zoomed', state.zoom > 1);
      viewport.dataset.zoom = String(state.zoom);
    });
    onChange(state);
  }
  function interact(next) { onInteraction?.(); apply(next); }
  for (const viewport of viewports) {
    const pointers = new Map();
    let moved = false, suppressClick = false;
    const anchor = (x, y) => {
      const rect = viewport.getBoundingClientRect();
      return { x: (x - rect.left) / rect.width - .5, y: (y - rect.top) / rect.height - .5 };
    };
    const pan = (dx, dy) => interact({ ...state, x: state.x + dx / viewport.clientWidth, y: state.y + dy / viewport.clientHeight });
    viewport.addEventListener('wheel', event => {
      event.preventDefault();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1);
      interact(zoomView(state, state.zoom * Math.exp(-delta * .002), anchor(event.clientX, event.clientY)));
    }, { passive: false });
    viewport.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (!pointers.size) { moved = false; suppressClick = false; }
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY });
      if (event.pointerType === 'touch') viewport.setPointerCapture(event.pointerId);
    }, true);
    viewport.addEventListener('pointermove', event => {
      const previous = pointers.get(event.pointerId);
      if (!previous) return;
      const old = [...pointers.values()];
      pointers.set(event.pointerId, { ...previous, x: event.clientX, y: event.clientY });
      const current = [...pointers.values()];
      if (current.length === 2) {
        const midpoint = points => ({ x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 });
        const distance = points => Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
        const before = midpoint(old), after = midpoint(current);
        interact(zoomView(state, state.zoom * distance(current) / Math.max(1, distance(old)), anchor(before.x, before.y)));
        pan(after.x - before.x, after.y - before.y);
        moved = true;
      } else if (state.zoom > 1 && (moved || Math.hypot(event.clientX - previous.startX, event.clientY - previous.startY) > 4)) {
        pan(event.clientX - previous.x, event.clientY - previous.y);
        moved = true;
        if (!viewport.hasPointerCapture(event.pointerId)) viewport.setPointerCapture(event.pointerId);
      }
      if (moved) {
        suppressClick = true; viewport.dataset.dragging = 'true';
        event.preventDefault();
      }
    }, true);
    const release = event => {
      pointers.delete(event.pointerId);
      if (!pointers.size) { moved = false; viewport.dataset.dragging = 'false'; }
    };
    viewport.addEventListener('pointerup', release, true);
    viewport.addEventListener('pointercancel', release, true);
    viewport.addEventListener('lostpointercapture', release, true);
    viewport.addEventListener('click', event => {
      if (suppressClick) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
  }
  const resize = new ResizeObserver(() => apply(resizeView?.(state) ?? state));
  viewports.forEach(viewport => resize.observe(viewport));
  apply(state);
  return {
    setView: next => apply(next),
    zoomBy: factor => interact(zoomView(state, state.zoom * factor)),
    reset: () => interact({ zoom: 1, x: 0, y: 0 })
  };
}
