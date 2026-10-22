import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoLoader } from '../demo-loading.js';

test('leaving the banner starts both tasks once and promotes video after snapshots', async () => {
  let finishSnapshots;
  const snapshots = new Promise(resolve => { finishSnapshots = resolve; });
  const calls = [];
  let promoted = false;
  const start = createDemoLoader(['snapshots','video'], async (demo, options) => {
    calls.push(demo);
    if (demo === 'snapshots') await snapshots;
    else { await options.priorityReady; promoted = true; }
  });
  const first = start();
  assert.equal(start(),first);
  assert.deepEqual(calls,['snapshots','video']);
  assert.equal(promoted,false);
  finishSnapshots(); await first;
  assert.deepEqual(calls,['snapshots','video']);
  assert.equal(promoted,true);
  await start(); assert.equal(calls.length,2);
});

test('a failed snapshot preload cannot prevent video loading', async () => {
  const calls = [];
  await createDemoLoader(['snapshots','video'], async demo => {
    calls.push(demo);
    if (demo === 'snapshots') throw new Error('Fixture snapshot failure');
  })();
  assert.deepEqual(calls,['snapshots','video']);
});
