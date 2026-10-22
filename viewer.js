import { normalizePrediction } from './prediction-data.js';
import { createFrameSeeker } from './frame-seeker.js';
import { createPoseOverlay } from './pose-overlay.js';
import { installFrameKeys } from './frame-keys.js';
import { installLinkedView } from './linked-view.js';
import { readCatalog } from './catalog.js';
const make = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const format = (text, values) => text.replace(/\{(\w+)\}/g, (_, key) => values[key]);
function playbackIcon(button, key) {
  const paths = {
    start: 'M3 4v16M12 6 5 12l7 6ZM21 6l-7 6 7 6Z',
    previous: 'M6 4v16M18 5 8 12l10 7Z',
    play: 'm8 5 11 7-11 7Z',
    stop: 'M6 6h12v12H6Z',
    next: 'M18 4v16M6 5l10 7-10 7Z',
    end: 'M21 4v16M3 6l7 6-7 6ZM12 6l7 6-7 6Z',
  };
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(svg.namespaceURI, 'path');
  path.setAttribute('d', paths[key]); svg.append(path); button.replaceChildren(svg);
}
async function readJSON(url, signal, cache = 'default', priority = 'auto') {
  const response = await fetch(url, { signal, cache, priority });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.json();
}

export async function mountViewer(root, copy, { priorityReady } = {}) {
  const catalog = await readCatalog();
  let backgroundReady = !priorityReady;
  const player = make('div', undefined, 'comparison-player');
  player.tabIndex = 0;
  player.setAttribute('aria-label', copy.modelLabel);
  const screens = make('div', undefined, 'comparison-screens');
  const loadingOverlay = make('div', copy.loading, 'video-loading');
  const loadButton = make('button', copy.loadVideo, 'video-load-button');
  loadButton.type = 'button'; loadButton.hidden = true;
  screens.append(loadingOverlay);
  const canvases = [];
  const selected = new Set();
  const overlays = [];
  const viewports = [], scenes = [];
  for (const label of [copy.modelLabel]) {
    const panel = make('div', undefined, 'comparison-panel');
    panel.dataset.model = 'unified';
    const canvas = make('canvas');
    canvas.width = 360;
    canvas.height = 640;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', label);
    const viewport = make('div', undefined, 'pose-viewport');
    const scene = make('div', undefined, 'pose-scene');
    scene.append(canvas); viewport.append(scene);
    viewports.push(viewport); scenes.push(scene);
    const overlay = createPoseOverlay(viewport, 1, copy, selected, (key, additive) => {
      if (key === null) {
        selected.clear(); overlays.forEach(item => item.updateSelection()); return;
      }
      const remove = selected.has(key) && (additive || selected.size === 1);
      if (!additive) selected.clear();
      if (remove) selected.delete(key); else selected.add(key);
      for (const item of overlays) item.updateSelection();
    });
    overlays.push(overlay);
    panel.append(viewport);
    screens.append(panel);
    canvases.push(canvas);
  }
  const video = document.createElement('video');
  video.muted = true;
  video.defaultMuted = true;
  video.setAttribute('muted', '');
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.preload = 'metadata';
  priorityReady?.then(() => {
    backgroundReady = true;
    video.preload = 'auto';
  });
  // Keep a rendered decoder surface: display:none can suppress paused frame
  // presentation callbacks and leave drawImage reading the previous texture.
  video.className = 'video-decoder';
  video.setAttribute('aria-hidden', 'true');
  video.tabIndex = -1;
  const slider = make('input', undefined, 'frame-slider');
  slider.type = 'range';
  slider.min = '0'; slider.max = '0'; slider.value = '0'; slider.step = '1';
  slider.setAttribute('aria-label', copy.slider);
  const meta = make('div', undefined, 'player-meta');
  const frameLabel = make('span');
  const status = make('span', copy.loading);
  status.setAttribute('role', 'status');
  meta.append(frameLabel, status);
  const controls = make('div', undefined, 'playback-controls');
  const buttons = {};
  for (const key of ['start', 'previous', 'play', 'next', 'end']) {
    const button = make('button'); playbackIcon(button, key);
    button.type = 'button'; button.title = copy[key];
    button.setAttribute('aria-label', copy[key]);
    controls.append(button); buttons[key] = button;
  }
  const zoomControls = make('div', undefined, 'zoom-controls');
  zoomControls.setAttribute('role', 'group'); zoomControls.setAttribute('aria-label', copy.panZoomLabel);
  const zoomOut = make('button', '−'), zoomIn = make('button', '+'), resetView = make('button', copy.resetView), zoomLabel = make('output');
  for (const [button, label] of [[zoomOut, copy.zoomOut], [zoomIn, copy.zoomIn], [resetView, copy.resetView]]) {
    button.type = 'button'; button.title = label; button.setAttribute('aria-label', label);
  }
  zoomLabel.setAttribute('aria-label', copy.zoomLevel);
  zoomControls.append(zoomOut, zoomLabel, zoomIn, resetView);
  const linkedView = installLinkedView(viewports, scenes, state => {
    overlays.forEach(overlay => overlay.setTransform(state));
    zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
    zoomOut.disabled = state.zoom <= 1; zoomIn.disabled = state.zoom >= 6;
    resetView.disabled = state.zoom === 1;
  });
  zoomOut.onclick = () => linkedView.zoomBy(1 / 1.25);
  zoomIn.onclick = () => linkedView.zoomBy(1.25);
  resetView.onclick = () => linkedView.reset();
  const credit = make('div', undefined, 'video-credit');
  credit.hidden = true;
  const details = make('div', undefined, 'video-details');
  details.append(credit, make('p', copy.panZoomHint, 'keyboard-hint'), make('p', copy.keyboard, 'keyboard-hint'), make('p', copy.inspectionHint, 'keyboard-hint'));
  player.append(screens, slider, meta, controls, zoomControls, video);
  const sidebar = make('aside', undefined, 'video-sidebar');
  const sidebarHeading = make('div', undefined, 'sidebar-heading');
  const countLabel = make('span', copy.loadingList);
  sidebarHeading.append(make('h3', copy.listTitle), countLabel);
  const viewLabel = make('label', copy.viewLabel);
  const viewSelect = make('select');
  viewSelect.disabled = true;
  viewLabel.append(viewSelect);
  const list = make('div', undefined, 'video-list');
  sidebar.append(sidebarHeading, viewLabel, list);
  root.replaceChildren(player, sidebar, details);
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.target.closest('.pose-viewport, button, input, select, a, label')) return;
    selected.clear(); overlays.forEach(overlay => overlay.updateSelection());
  });

  let clips = [], active, frame = 0, renderedFrame = 0, ready = false, playing = false;
  let version = 0, controller, frameCallback, animation, playRequest = 0, videoBlobURL;
  let credits = {};
  function renderCredit(clip) {
    credit.replaceChildren(); credit.hidden = true;
    const value = credits[clip.key] ?? credits[clip.id] ?? credits[clip.id.split('-')[0]];
    if (!value) return;
    try {
      const url = new URL(typeof value === 'string' ? value : value.url);
      if (!['https:', 'http:'].includes(url.protocol)) return;
      const line = make('p');
      const link = make('a', copy.creditLink);
      link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer';
      line.append(make('span', `${copy.creditLabel} `));
      if (typeof value === 'object' && value.creator) line.append(make('span', `${value.creator} · `));
      line.append(link);
      credit.append(line, make('p', copy.creditNote, 'credit-note')); credit.hidden = false;
    } catch (error) { console.warn('Invalid video credit URL', error); }
  }
  // Attribution loads independently and never delays the viewer or page content.
  readJSON('materials/data/credits.json', undefined, 'no-cache').then(data => {
    credits = data;
    if (active) renderCredit(active);
  }).catch(error => console.warn('Video credits could not load', error));
  const seeker = createFrameSeeker(video, {
    getTimes: () => active.times,
    onRequest: index => { frame = index; updateFrameLabel(); },
    onSettled: index => { if (ready && !playing) { renderedFrame = index; draw(); } }
  });
  const poseCache = new Map();
  function setEnabled(enabled) {
    slider.disabled = !enabled;
    for (const button of Object.values(buttons)) button.disabled = !enabled;
    player.setAttribute('aria-busy', String(!enabled));
    loadingOverlay.hidden = enabled;
  }
  function updateFrameLabel() {
    const text = format(copy.frame, { current: active ? frame + 1 : 0, total: active?.frameCount || 0 });
    frameLabel.textContent = text;
    slider.value = String(frame);
    slider.setAttribute('aria-valuetext', text);
  }
  function draw() {
    if (!ready || video.readyState < 2) return;
    for (const [index, canvas] of canvases.entries()) {
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      overlays[index].render(renderedFrame);
    }
    updateFrameLabel();
  }
  function stop() {
    playRequest++;
    playing = false; video.pause();
    if (frameCallback !== undefined) video.cancelVideoFrameCallback?.(frameCallback);
    cancelAnimationFrame(animation);
    playbackIcon(buttons.play, 'play'); buttons.play.title = copy.play;
    buttons.play.setAttribute('aria-label', copy.play);
  }
  function frameAt(time) {
    let low = 0, high = active.frameCount - 1;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (active.times[mid] <= time + 0.00001) low = mid;
      else high = mid - 1;
    }
    return low;
  }
  function seek(index) {
    if (!ready) return;
    stop();
    seeker.request(index);
  }
  function tick(now, metadata) {
    if (!playing || !ready) return;
    frame = renderedFrame = frameAt(metadata?.mediaTime ?? video.currentTime);
    draw();
    if (frame >= active.frameCount - 1) { seek(active.frameCount - 1); return; }
    schedule();
  }
  function schedule() {
    if (video.requestVideoFrameCallback) frameCallback = video.requestVideoFrameCallback(tick);
    else animation = requestAnimationFrame(tick);
  }
  async function toggle() {
    if (!ready) return;
    if (playing) { stop(); return; }
    if (frame === active.frameCount - 1) {
      seek(0);
    }
    const request = ++playRequest;
    const currentVersion = version;
    await seeker.whenIdle();
    if (!ready || request !== playRequest || currentVersion !== version) return;
    playing = true;
    playbackIcon(buttons.play, 'stop'); buttons.play.title = copy.stop;
    buttons.play.setAttribute('aria-label', copy.stop);
    try { await video.play(); if (playing) schedule(); }
    catch (error) { stop(); console.error(error); }
  }
  video.addEventListener('ended', stop);
  function showError(error) {
    status.textContent = copy.error;
    loadingOverlay.textContent = copy.error;
    player.setAttribute('aria-busy', 'false');
    console.error(error);
  }
  video.addEventListener('error', () => { if (active) { stop(); ready = false; setEnabled(false); showError(new Error('Video could not load')); } });
  slider.addEventListener('input', () => seek(Number(slider.value)));
  buttons.start.onclick = () => seek(0);
  buttons.previous.onclick = () => seek(frame - 1);
  buttons.play.onclick = toggle;
  buttons.next.onclick = () => seek(frame + 1);
  buttons.end.onclick = () => seek(active.frameCount - 1);
  const frameKeys = installFrameKeys({ target: document, blurTarget: window, isReady: () => ready, step: delta => seek(frame + delta), toggle });
  player.addEventListener('keydown', event => {
    if (event.target.matches('input, select, button')) return;
    const actions = { Home: () => seek(0), End: () => seek(active.frameCount - 1) };
    if (actions[event.key]) { event.preventDefault(); if (ready) actions[event.key](); }
  });
  async function pose(url, signal) {
    if (poseCache.has(url)) return poseCache.get(url);
    const data = normalizePrediction(await readJSON(url, signal, 'default', backgroundReady ? 'auto' : 'low'));
    poseCache.set(url, data);
    if (poseCache.size > 8) poseCache.delete(poseCache.keys().next().value);
    return data;
  }
  async function select(clip) {
    const current = ++version;
    controller?.abort(); controller = new AbortController();
    const { signal } = controller;
    stop(); ready = false; setEnabled(false); seeker.reset();
    frameKeys.clear();
    linkedView.reset();
    for (const overlay of overlays) overlay.clear();
    if (videoBlobURL) { URL.revokeObjectURL(videoBlobURL); videoBlobURL = undefined; }
    active = clip; frame = 0; status.textContent = copy.loading; loadingOverlay.textContent = copy.loading;
    renderCredit(clip);
    slider.max = String(clip.frameCount - 1); updateFrameLabel();
    for (const canvas of canvases) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    for (const button of list.querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.key === clip.key));
    function loadVideo(url) { return new Promise((resolve, reject) => {
      let unlockPlayback = false;
      const promptTimer = setTimeout(() => {
        loadButton.hidden = false;
        loadingOverlay.replaceChildren(loadButton);
      }, 3000);
      const cleanup = () => {
        clearTimeout(promptTimer); loadButton.hidden = true; loadButton.onclick = null;
        video.removeEventListener('loadeddata', loaded); video.removeEventListener('error', failed);
        video.removeEventListener('canplay', loaded);
        signal.removeEventListener('abort', aborted);
      };
      const loaded = () => {
        if (video.readyState < 2) return;
        if (unlockPlayback) video.pause();
        video.preload = backgroundReady ? 'auto' : 'metadata'; cleanup(); resolve();
      };
      const failed = () => { cleanup(); reject(new Error('Video could not load')); };
      const aborted = () => { cleanup(); reject(new DOMException('Aborted', 'AbortError')); };
      // Some mobile browsers defer decoding until a direct user gesture.
      loadButton.onclick = () => {
        unlockPlayback = true; backgroundReady = true; video.preload = 'auto';
        video.play().then(loaded).catch(error => { console.warn('Tap-to-load playback was blocked', error); });
      };
      video.addEventListener('loadeddata', loaded, { once: true });
      video.addEventListener('canplay', loaded);
      video.addEventListener('error', failed, { once: true });
      signal.addEventListener('abort', aborted, { once: true });
      // Buffer the selected clip in the background; never preload the full list.
      video.preload = backgroundReady ? 'auto' : 'metadata'; video.src = url; video.load();
    }); }
    const mediaReady = (async () => {
      await loadVideo(clip.video);
      if (current !== version) return;
      if (!video.seekable.length || video.seekable.end(video.seekable.length - 1) <= 0) {
        // Some static preview servers ignore Range requests. A local Blob makes
        // the selected clip seekable without requiring any server-side code.
        const response = await fetch(clip.video, { signal });
        if (!response.ok) throw new Error(`Video request failed: ${response.status}`);
        const blob = await response.blob();
        if (current !== version) return;
        videoBlobURL = URL.createObjectURL(blob);
        await loadVideo(videoBlobURL);
      }
    })();
    try {
      const [prediction] = await Promise.all([pose(clip.pose, signal), mediaReady]);
      if (current !== version) return;
      overlays[0].setPose(prediction, active.width, active.height);
      for (const canvas of canvases) {
        canvas.width = Math.min(720, video.videoWidth);
        canvas.height = Math.round(canvas.width * video.videoHeight / video.videoWidth);
      }
      ready = true; setEnabled(true); status.textContent = ''; draw(); seek(0);
    } catch (error) {
      if (current !== version || error.name === 'AbortError') return;
      showError(error);
    }
  }
  function renderList() {
    list.replaceChildren();
    const filtered = clips.filter(clip => viewSelect.value === 'all' || clip.view === viewSelect.value);
    countLabel.textContent = format(copy.videoCount, { count: filtered.length });
    for (const clip of filtered) {
      const button = make('button', undefined, 'video-item');
      button.type = 'button'; button.dataset.key = clip.key;
      button.setAttribute('aria-pressed', String(active?.key === clip.key));
      const image = make('img'); image.src = clip.thumbnail; image.alt = ''; image.loading = 'lazy'; image.decoding = 'async';
      image.width = 96; image.height = 72;
      const caption = make('span'); caption.append(make('strong', format(copy.clipLabel, clip)), make('small', copy.views[clip.view] || clip.view.replaceAll('-', ' ')));
      button.append(image, caption); button.onclick = () => select(clip); list.append(button);
    }
  }
  viewSelect.onchange = () => {
    renderList();
    if (viewSelect.value !== 'all' && active?.view !== viewSelect.value) {
      const first = clips.find(clip => clip.view === viewSelect.value);
      if (first) select(first);
    }
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  setEnabled(false);
  try {
    clips = [...catalog.clips];
    // In All views, mix camera views by clip ID instead of grouping an entire
    // camera view ahead of the other one.
    clips.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }) || a.view.localeCompare(b.view));
    // Discover views from the data; content.json supplies display labels only.
    for (const key of ['all', ...new Set(clips.map(clip => clip.view))]) {
      const option = make('option', copy.views[key] || key.replaceAll('-', ' '));
      option.value = key; viewSelect.append(option);
    }
    viewSelect.disabled = false;
    renderList();
    if (clips.length) await select(clips[0]);
    else {
      status.textContent = copy.empty;
      loadingOverlay.textContent = copy.empty;
      player.setAttribute('aria-busy', 'false');
    }
  } catch (error) { showError(error); countLabel.textContent = copy.error; }
}
