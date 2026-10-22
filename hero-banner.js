import { normalizePrediction } from './prediction-data.js';
import { createPoseOverlay } from './pose-overlay.js';
import { readCatalog } from './catalog.js';

export function bannerFrameAt(times, time) {
  let low=0,high=times.length-1;
  while (low<high) { const mid=Math.ceil((low+high)/2); if(times[mid]<=time+.00001) low=mid; else high=mid-1; }
  return low;
}
export function bannerClip(clips, key) {
  const matches=clips.filter(clip=>clip.key===key || clip.id===key);
  return matches.length===1?matches[0]:null;
}
const make=(tag,className)=>{const node=document.createElement(tag); if(className)node.className=className; return node;};
async function read(url) {
  const response=await fetch(url);
  if(!response.ok)throw new Error(`Banner asset ${response.status}: ${url}`);
  return response.json();
}
export async function mountBanner(root, settings, copy) {
  const catalog=await readCatalog();
  const clip=bannerClip(catalog.clips,settings.video);
  if(!clip) { root.hidden=true; console.warn(`Banner clip not found or ambiguous: ${settings.video}`); return; }
  const asset=catalog.banner?.key===clip.key ? catalog.banner : null;
  const viewport=make('div','banner-viewport');
  const video=make('video','banner-video');
  video.muted=true; video.defaultMuted=true; video.setAttribute('muted','');
  video.playsInline=true; video.setAttribute('playsinline','');
  video.loop=true; video.preload='auto'; video.poster=asset?.poster??clip.thumbnail;
  video.setAttribute('aria-hidden','true'); video.tabIndex=-1;
  const poster=make('img','banner-poster');
  poster.src=video.poster; poster.alt=''; poster.fetchPriority='high'; poster.decoding='async';
  viewport.append(video,poster);
  const overlay=createPoseOverlay(viewport,1,copy,new Set(),()=>{},{interactive:false});
  const fitOverlay=()=>{
    const contain=Math.min(viewport.clientWidth/clip.width,viewport.clientHeight/clip.height);
    const cover=Math.max(viewport.clientWidth/clip.width,viewport.clientHeight/clip.height);
    if(contain) overlay.setTransform({zoom:cover/contain,x:0,y:0});
  };
  const resize=new ResizeObserver(fitOverlay);resize.observe(viewport);
  const badge=make('p','banner-badge'); badge.textContent=settings.label;
  root.replaceChildren(viewport,badge);
  if(asset?.previewPose) {
    overlay.setPose(asset.previewPose,clip.width,clip.height); fitOverlay(); overlay.render(0);
  }
  let callback, visible=false, loaded=false, wanted=!matchMedia('(prefers-reduced-motion: reduce)').matches;
  const draw=time=>overlay.render(loaded?bannerFrameAt(clip.times,time):0);
  const cancel=()=>{
    if(callback!==undefined) {
      if(video.requestVideoFrameCallback) video.cancelVideoFrameCallback(callback);
      else cancelAnimationFrame(callback);
      callback=undefined;
    }
  };
  const tick=(now,metadata)=>{
    callback=undefined;
    poster.hidden=true;
    draw(metadata?.mediaTime??video.currentTime);
    if(!video.paused) schedule();
  };
  const schedule=()=>{
    cancel();
    callback=video.requestVideoFrameCallback?video.requestVideoFrameCallback(tick):requestAnimationFrame(tick);
  };
  const sync=()=>{
    if(loaded&&visible&&!document.hidden&&wanted) video.play().catch(()=>{});
    else video.pause();
  };
  video.addEventListener('play',schedule);
  video.addEventListener('pause',cancel);
  video.addEventListener('seeked',()=>{if(loaded)draw(video.currentTime);});
  video.addEventListener('loadeddata',()=>{if(loaded)draw(video.currentTime);});
  video.addEventListener('error',()=>{cancel(); poster.hidden=false; draw(0);});
  document.addEventListener('visibilitychange',sync);
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();}); observer.observe(root);
  // Do not download video/poses when opening directly at a lower section.
  await new Promise(resolve=>{
    const visibility=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting)) { visibility.disconnect(); resolve(); }
    });
    visibility.observe(root);
  });
  // Preview and skeleton are already present; fetch motion and poses together.
  // Retain that preview on slow networks, autoplay denial, and reduced motion.
  if (!wanted) return;
  const poseReady=read(asset?.pose??clip.pose);
  video.src=asset?.video??clip.video; video.load();
  const pose=normalizePrediction(await poseReady);
  overlay.setPose(pose,clip.width,clip.height);fitOverlay(); loaded=true;
  draw(0);sync();
}
