import { spotlightPoints } from './snapshot-data.js';
import { poseConnections } from './pose-overlay.js';

export function projectSnapshotPoint(point, sourceWidth, sourceHeight, width, height, state) {
  const fit = Math.min(width/sourceWidth, height/sourceHeight);
  return { x: width/2+(point[0]-sourceWidth/2)*fit*state.zoom+state.x*width,
    y: height/2+(point[1]-sourceHeight/2)*fit*state.zoom+state.y*height };
}
const inside = (point, box, padding = 0) => point.x >= box.x-padding && point.x <= box.x+box.width+padding && point.y >= box.y-padding && point.y <= box.y+box.height+padding;
export function segmentsCross(a, b, c, d) {
  const orient = (p, q, r) => (q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
  return orient(a,b,c)*orient(a,b,d) < 0 && orient(c,d,a)*orient(c,d,b) < 0;
}
const edges = box => {
  const a = { x:box.x,y:box.y }, b={x:box.x+box.width,y:box.y}, c={x:b.x,y:box.y+box.height}, d={x:a.x,y:c.y};
  return [[a,b],[b,c],[c,d],[d,a]];
};
const overlaps = (a,b) => Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
export function messageOccludes(start, end, box) {
  // Test the open interior, so merely attaching to an edge does not count.
  let near=0, far=1;
  for (const [axis,size] of [['x','width'],['y','height']]) {
    const low=box[axis]+.01, high=box[axis]+box[size]-.01, delta=end[axis]-start[axis];
    if (Math.abs(delta)<1e-9) { if (start[axis]<=low || start[axis]>=high) return false; }
    else {
      const a=(low-start[axis])/delta,b=(high-start[axis])/delta;
      near=Math.max(near,Math.min(a,b)); far=Math.min(far,Math.max(a,b));
      if (far<=near) return false;
    }
  }
  return far-near>1e-8;
}
export function routeArrow(box, target, bones, obstacles = []) {
  return routeArrows(box,[target],bones,obstacles)[0];
}
export function routeArrows(box, targets, bones, obstacles = []) {
  const starts = [{x:box.x+box.width/2,y:box.y},{x:box.x+box.width/2,y:box.y+box.height},{x:box.x,y:box.y+box.height/2},{x:box.x+box.width,y:box.y+box.height/2}];
  return starts.map(start=>{
    const routes=targets.map(target=>{
      const occluded=[box,...obstacles].some(rect=>messageOccludes(start,target,rect));
      const distance=Math.hypot(target.x-start.x,target.y-start.y);
      return {path:[start,target],occluded,distance,score:Number(occluded)*1000000+distance};
    });
    return {routes,occluded:routes.filter(route=>route.occluded).length,distance:routes.reduce((sum,route)=>sum+route.distance,0)};
  }).sort((a,b)=>a.occluded-b.occluded || a.distance-b.distance)[0].routes;
}
export function placeCallout(width, height, boxWidth, boxHeight, targets, points, bones, occupied = []) {
  const w = Math.min(boxWidth,width-16), h = Math.min(boxHeight,height-16);
  const candidates = [8,(width-w)/2,width-w-8].flatMap(x=>[8,(height-h)/2,height-h-8].map(y=>({x,y,width:w,height:h})));
  return candidates.map(box => {
    const routes = routeArrows(box,targets,bones,occupied);
    const obstruction = points.filter(point=>inside(point,box,12)).length*100000
      + bones.filter(([a,b])=>inside(a,box)||inside(b,box)||edges(box).some(([c,d])=>segmentsCross(a,b,c,d))).length*100000
      + occupied.reduce((sum,other)=>sum+overlaps(box,other)*10000,0);
    const arrowScore = routes.reduce((sum,route)=>sum+route.score,0);
    return {box,routes,obstruction,arrowScore,score:obstruction+arrowScore};
  }).sort((a,b)=>a.obstruction-b.obstruction || a.box.y-b.box.y || a.arrowScore-b.arrowScore)[0];
}

export function createSnapshotCallouts(viewport, panel, entry, side) {
  const pose = entry[side], key = 'message';
  const groups = new Map();
  for (const name of entry.joints) {
    const text = entry.explanations?.[name]?.[key]?.trim();
    if (!text || !spotlightPoints(pose,[name]).length) continue;
    if (!groups.has(text)) groups.set(text,[]);
    groups.get(text).push(name);
  }
  if (!groups.size) return () => {};
  const ns = 'http://www.w3.org/2000/svg';
  const arrows = document.createElementNS(ns,'svg'); arrows.classList.add('snapshot-callout-arrows'); arrows.setAttribute('aria-hidden','true');
  viewport.append(arrows);
  const rail = document.createElement('div'); rail.className='snapshot-callout-rail'; panel.append(rail);
  const items = [...groups].map(([text,names])=>{
    const box = document.createElement('p'); box.className='snapshot-callout'; box.textContent=text; rail.append(box);
    return {box,names};
  });
  return state => {
    const width=viewport.clientWidth,height=viewport.clientHeight;
    const project = point=>projectSnapshotPoint(point,entry.width,entry.height,width,height,state);
    const points=spotlightPoints(pose,pose.joints).map(project);
    const bones=poseConnections(1).flatMap(names=>{
      const ends=spotlightPoints(pose,names); return ends.length===2?[[project(ends[0]),project(ends[1])]]:[];
    });
    // Below-image notes are the fallback when there is too little room to avoid the golfer.
    const external=width<250;
    rail.classList.toggle('is-external',external);
    rail.style.top=external?'':`${viewport.offsetTop}px`;
    arrows.setAttribute('viewBox',`0 0 ${width} ${height}`); arrows.replaceChildren();
    const occupied=[];
    items.forEach(({box,names},index)=>{
      const targets=spotlightPoints(pose,names).map(project);
      box.style.width=`${external?width:Math.min(164,width*.45)}px`;
      const measured={width:box.offsetWidth,height:box.offsetHeight};
      let placement;
      if (external) {
        box.style.left='';box.style.top='';
        const anchor={x:width*(index+1)/(items.length+1),y:height-2};
        placement={routes:targets.map(target=>({path:[anchor,target]}))};
      } else {
        placement=placeCallout(width,height,measured.width,measured.height,targets,points,bones,occupied);
        occupied.push(placement.box); box.style.left=`${placement.box.x}px`;box.style.top=`${placement.box.y}px`;
      }
      for (const {path} of placement.routes) {
        const line=document.createElementNS(ns,'path'); line.setAttribute('d',path.map((p,i)=>`${i?'L':'M'}${p.x} ${p.y}`).join(' '));arrows.append(line);
        const end=path.at(-1),previous=path.at(-2),angle=Math.atan2(end.y-previous.y,end.x-previous.x);
        const head=document.createElementNS(ns,'path');
        head.setAttribute('d',`M${end.x-8*Math.cos(angle-.45)} ${end.y-8*Math.sin(angle-.45)} L${end.x} ${end.y} L${end.x-8*Math.cos(angle+.45)} ${end.y-8*Math.sin(angle+.45)}`);arrows.append(head);
      }
    });
  };
}
