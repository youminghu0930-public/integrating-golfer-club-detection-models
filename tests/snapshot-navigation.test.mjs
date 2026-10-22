import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshotTravel, snapshotPlacement } from '../snapshot-viewer.js';

test('snapshot travel prepares every visible card along the route, including wraparound', () => {
  assert.deepEqual(snapshotTravel(0, -2, 20).indices, [18, 19, 0]);
  assert.deepEqual(snapshotTravel(1.4, 5, 20).indices, [1, 2, 3, 4, 5]);
});

test('adjacent snapshots retain their timing while distant jumps have more settling time', () => {
  assert.equal(snapshotTravel(0, 1, 20).duration, 300);
  assert.ok(snapshotTravel(0, 5, 20).duration > 300);
  assert.equal(snapshotTravel(0, 10, 20).duration, 900);
});

test('projected snapshot wheel centers the selected card and keeps neighbors symmetric', () => {
  const selected = snapshotPlacement(2, 2, 20, 1000, 550, 526);
  assert.equal(selected.x, 0); assert.equal(selected.y, 0); assert.equal(selected.scale, 1);
  const left = snapshotPlacement(1, 2, 20, 1000, 550, 526);
  const right = snapshotPlacement(3, 2, 20, 1000, 550, 526);
  assert.equal(left.x, -right.x); assert.equal(left.scale, right.scale);
  assert.equal(left.opacity, 1, 'Rotation must not fade the image into the pale background');
  assert.ok(selected.depth > left.depth);
  const wrapped = snapshotPlacement(2, 22, 20, 1000, 550, 526);
  assert.ok(Math.abs(wrapped.x-selected.x) < 1e-9);
});
