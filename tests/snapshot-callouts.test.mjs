import test from 'node:test';
import assert from 'node:assert/strict';
import { projectSnapshotPoint, segmentsCross, placeCallout, routeArrow, routeArrows, messageOccludes } from '../snapshot-callouts.js';

test('annotation anchors follow linked zoom, pan, and image letterboxing', () => {
  assert.deepEqual(projectSnapshotPoint([360,640],720,1280,400,440,{zoom:2,x:.1,y:-.1}),{x:240,y:176});
});
test('annotation boxes avoid a skeleton occupying the center', () => {
  const points=[{x:200,y:100},{x:200,y:220},{x:200,y:340}];
  const bones=[[points[0],points[1]],[points[1],points[2]]];
  const placement=placeCallout(400,440,140,70,[points[1]],points,bones);
  assert.equal(placement.obstruction,0);
  assert.ok(placement.box.y>=0 && placement.box.y+placement.box.height<=440);
});
test('arrow routing prefers a clear path around a non-target bone', () => {
  const bone=[{x:100,y:20},{x:100,y:140}];
  const {path}=routeArrow({x:10,y:160,width:60,height:40},{x:180,y:170},[bone]);
  assert.ok(path.slice(1).every((end,i)=>!segmentsCross(path[i],end,...bone)));
  assert.deepEqual(path.at(-1),{x:180,y:170});
});

test('arrows stay straight and retain offscreen joint coordinates', () => {
  const target={x:-120,y:600};
  const {path}=routeArrow({x:10,y:10,width:100,height:60},target,[]);
  assert.equal(path.length,2);
  assert.deepEqual(path[1],target);
  const projected=projectSnapshotPoint([0,1280],720,1280,400,440,{zoom:6,x:0,y:0});
  assert.ok(projected.x<0 && projected.y>440);
  assert.deepEqual(routeArrow({x:10,y:10,width:100,height:60},projected,[]).path.at(-1),projected);
});

test('callouts prefer clear upper space even when the joint is lower down', () => {
  const target={x:200,y:390};
  const placement=placeCallout(400,440,140,70,[target],[target],[]);
  assert.equal(placement.box.y,8);
});

test('upper-space preference does not put a box over the skeleton', () => {
  const points=[{x:0,y:40},{x:400,y:40}];
  const placement=placeCallout(400,440,140,70,[{x:200,y:390}],points,[[...points]]);
  assert.ok(placement.box.y>8);
  assert.equal(placement.obstruction,0);
});

test('all arrows belonging to a message share one attachment point', () => {
  const targets=[{x:20,y:200},{x:200,y:50},{x:-100,y:500}];
  const routes=routeArrows({x:100,y:100,width:80,height:50},targets,[]);
  assert.equal(routes.length,3);
  routes.forEach((route,index)=>{
    assert.equal(route.path.length,2);
    assert.deepEqual(route.path[0],routes[0].path[0]);
    assert.deepEqual(route.path[1],targets[index]);
  });
});

test('attachment selection first minimizes the number of arrows hidden by messages', () => {
  const box={x:100,y:100,width:100,height:100};
  const routes=routeArrows(box,[{x:0,y:80},{x:300,y:80}],[]);
  assert.deepEqual(routes[0].path[0],{x:150,y:100});
  assert.ok(routes.every(route=>!route.occluded));
});

test('equal-occlusion attachments use the shortest total distance to all joints', () => {
  const routes=routeArrows({x:100,y:100,width:100,height:100},[{x:20,y:300},{x:30,y:320}],[]);
  assert.deepEqual(routes[0].path[0],{x:150,y:200});
});

test('message occlusion counts interior traversal, not edge attachment', () => {
  const box={x:100,y:100,width:100,height:100};
  assert.equal(messageOccludes({x:150,y:200},{x:150,y:300},box),false);
  assert.equal(messageOccludes({x:150,y:100},{x:150,y:300},box),true);
});
