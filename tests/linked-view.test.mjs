import test from 'node:test';
import assert from 'node:assert/strict';
import { zoomView, constrainView, focusedView, installLinkedView } from '../linked-view.js';

test('zoom preserves the source point under the cursor', () => {
  const state = { zoom: 2, x: .1, y: -.15 }, anchor = { x: .3, y: -.2 };
  const result = zoomView(state, 3, anchor);
  assert.ok(Math.abs((anchor.x - state.x) / state.zoom - (anchor.x - result.x) / result.zoom) < 1e-10);
  assert.ok(Math.abs((anchor.y - state.y) / state.zoom - (anchor.y - result.y) / result.zoom) < 1e-10);
});
test('pan bounds keep the frame covering its viewport', () => {
  assert.deepEqual(constrainView({ zoom: 2, x: 5, y: -5 }), { zoom: 2, x: .5, y: -.5 });
  assert.deepEqual(constrainView({ zoom: 1, x: .2, y: -.3 }), { zoom: 1, x: 0, y: 0 });
});
test('zoom limits and zooming back to full frame reset panning', () => {
  assert.deepEqual(zoomView({ zoom: 3, x: .7, y: -.4 }, .5), { zoom: 1, x: 0, y: 0 });
  assert.equal(zoomView({ zoom: 1, x: 0, y: 0 }, 10).zoom, 6);
});

test('snapshot framing centers a source point at 2x with letterboxing accounted for', () => {
  const point = { x: 400, y: 500 }, width = 720, height = 1280, viewportWidth = 408, viewportHeight = 440;
  const state = focusedView({ point, width, height, viewportWidth, viewportHeight });
  const scale = Math.min(viewportWidth/width, viewportHeight/height);
  assert.equal(state.zoom, 2);
  assert.ok(Math.abs((point.x-width/2)*scale*state.zoom + state.x*viewportWidth) < 1e-10);
  assert.ok(Math.abs((point.y-height/2)*scale*state.zoom + state.y*viewportHeight) < 1e-10);
});

test('snapshot framing keeps existing pan limits and defaults to image center without a focus', () => {
  assert.deepEqual(focusedView({ point: null, width: 720, height: 1280, viewportWidth: 408, viewportHeight: 440 }), { zoom: 2, x: 0, y: 0 });
  const edge = focusedView({ point: { x: 0, y: 0 }, width: 720, height: 1280, viewportWidth: 408, viewportHeight: 440 });
  assert.equal(edge.y, .5);
  assert.ok(edge.x <= .5);
});

test('default snapshot focus is recalculated after mobile resize without overriding manual adjustments', () => {
  const previousObserver = globalThis.ResizeObserver;
  let resized;
  globalThis.ResizeObserver = class {
    constructor(callback) { resized = callback; }
    observe() {}
  };
  try {
    const viewport = new EventTarget();
    Object.assign(viewport, { clientWidth: 408, clientHeight: 440, classList: { toggle() {} }, dataset: {} });
    const scene = { style: {} }, point = { x: 400, y: 500 };
    let state, manual = false;
    const focus = () => focusedView({ point, width: 720, height: 1280,
      viewportWidth: viewport.clientWidth, viewportHeight: viewport.clientHeight });
    const view = installLinkedView([viewport], [scene], next => { state = next; }, {
      resizeView: current => manual ? current : focus(),
      onInteraction: () => { manual = true; },
    });
    view.setView(focus());
    const desktop = state;
    viewport.clientWidth = 134; viewport.clientHeight = 237;
    resized();
    assert.deepEqual(state, focus());
    assert.notEqual(state.x, desktop.x, 'Mobile must not retain desktop letterbox offsets');
    view.zoomBy(1.25);
    const adjusted = state;
    viewport.clientWidth = 408; viewport.clientHeight = 440;
    resized();
    assert.deepEqual(state, adjusted, 'Resizing must preserve manually adjusted framing');
  } finally { globalThis.ResizeObserver = previousObserver; }
});
