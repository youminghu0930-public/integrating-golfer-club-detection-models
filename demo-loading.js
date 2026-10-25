// First visible snapshot readiness is independent of offscreen preloading.
export function createDemoLoader(demos, mount, backgroundStart = Promise.resolve()) {
  let pending;
  return () => pending ??= (async () => {
    const run = async (demo, options) => {
      try { await mount(demo, options); }
      catch (error) { console.warn('Demo preload failed', error); }
    };
    if (!demos.length) return;
    let firstReady;
    const priorityReady = new Promise(resolve => { firstReady = resolve; });
    const snapshots = run(demos[0], { warmAfter: backgroundStart, onFirstReady: firstReady }).finally(firstReady);
    await Promise.all([snapshots, ...demos.slice(1).map(demo => backgroundStart.then(()=>run(demo, { priorityReady })))]);
  })();
}
