// Start once after leaving the hero. Snapshots lead; video metadata may load
// concurrently, with full buffering promoted only after snapshots settle.
export function createDemoLoader(demos, mount) {
  let pending;
  return () => pending ??= (async () => {
    const run = async (demo, options) => {
      try { await mount(demo, options); }
      catch (error) { console.warn('Demo preload failed', error); }
    };
    if (!demos.length) return;
    const priorityReady = run(demos[0]);
    await Promise.all([priorityReady, ...demos.slice(1).map(demo => run(demo, { priorityReady }))]);
  })();
}
