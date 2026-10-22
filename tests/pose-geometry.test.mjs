import test from 'node:test';
import assert from 'node:assert/strict';
import { clippedBone, overlayTransform } from '../pose-geometry.js';

test('bones stop at the hollow joint boundaries', () => {
  assert.deepEqual(clippedBone([0, 0], [20, 0], 3), [[3, 0], [17, 0]]);
  assert.equal(clippedBone([0, 0], [5, 0], 3), null);
});
test('independent SVG geometry stays aligned with zoomed letterboxed video', () => {
  const width = 720, height = 1280, viewportWidth = 400, viewportHeight = 540;
  const state = { zoom: 3, x: .2, y: -.1 };
  const values = overlayTransform(width, height, viewportWidth, viewportHeight, state).match(/-?\d+(?:\.\d+)?/g).map(Number);
  const [tx, ty, zoom, ox, oy] = values;
  const scale = Math.min(viewportWidth/width, viewportHeight/height);
  const point = [300, 450];
  const rendered = [(viewportWidth-width*scale)/2 + scale*(tx+zoom*(point[0]+ox)), (viewportHeight-height*scale)/2 + scale*(ty+zoom*(point[1]+oy))];
  const video = [((1-state.zoom)/2+state.x)*viewportWidth + state.zoom*((viewportWidth-width*scale)/2+scale*point[0]), ((1-state.zoom)/2+state.y)*viewportHeight + state.zoom*((viewportHeight-height*scale)/2+scale*point[1])];
  rendered.forEach((value, i) => assert.ok(Math.abs(value-video[i]) < 1e-9));
});
