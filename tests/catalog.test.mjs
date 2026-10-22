import test from 'node:test';
import assert from 'node:assert/strict';
import { readCatalog } from '../catalog.js';

test('all viewers share a catalog request and a failed request can retry', async () => {
  const original = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    if (requests === 1) throw new Error('Offline');
    return {ok:true,json:async()=>({clips:[]})};
  };
  try {
    await assert.rejects(readCatalog(), /Offline/);
    const [a,b,c] = await Promise.all([readCatalog(),readCatalog(),readCatalog()]);
    assert.equal(requests,2);
    assert.equal(a,b); assert.equal(b,c);
  } finally { globalThis.fetch = original; }
});
