// The Abstract's first snapshot starts on landing. Remaining snapshots and video
// metadata warm after the hero leaves; full buffering follows snapshot readiness.
export function createDemoLoader(demos, mount, backgroundStart = Promise.resolve()) {
  let pending;
  return () => pending ??= (async () => {
    const run = async (demo, options) => {
      try { await mount(demo, options); }
      catch (error) { console.warn('Demo preload failed', error); }
    };
    if (!demos.length) return;
    const priorityReady = run(demos[0], { warmAfter: backgroundStart });
    await Promise.all([priorityReady, ...demos.slice(1).map(demo => backgroundStart.then(()=>run(demo, { priorityReady })))]);
  })();
}
