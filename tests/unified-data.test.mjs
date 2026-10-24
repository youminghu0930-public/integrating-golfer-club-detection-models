import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { normalizePrediction } from '../prediction-data.js';
import { snapshotItems, snapshotFocus } from '../snapshot-data.js';
import { poseConnections } from '../pose-overlay.js';
import { prepareData } from '../scripts/prepare-data.mjs';
import { siteFiles } from '../scripts/site-files.mjs';

const raw = { joints: ['nose','golf_club_grip','golf_club_shaft','golf_club_heel','golf_club_head'], pred: [[[1,2],[10,20],[20,30],[30,40],[40,50]]] };
test('explicit shaft name preserves coordinate order without mutating source', () => {
  const original = JSON.stringify(raw), pose = normalizePrediction(raw);
  assert.deepEqual(pose.joints.slice(-4), ['golf_club_grip','golf_club_shaft','golf_club_heel','golf_club_head']);
  assert.deepEqual(pose.pred[0][pose.joints.indexOf('golf_club_heel')], [30,40]);
  assert.equal(JSON.stringify(raw),original);
  assert.deepEqual(normalizePrediction(pose),pose);
  assert.throws(()=>normalizePrediction({...raw,pred:[[[1,2]]]}), /do not match/);
  assert.ok(poseConnections(1).some(([a,b])=>a==='golf_club_shaft'&&b==='golf_club_heel'));
});
test('compact snapshot messages and annotated messages focus on the actual club point', () => {
  const clip={id:'0027',key:'down-the-line-0027',frameCount:2};
  const [item]=snapshotItems({'0027':{0:{golf_club_heel:'Hard example'}}},[clip]);
  assert.deepEqual(item.joints,['golf_club_heel']);
  assert.equal(item.explanations.golf_club_heel.message,'Hard example');
  assert.deepEqual(snapshotFocus({...item,prediction:normalizePrediction(raw)}),{x:30,y:40});
  const [annotated]=snapshotItems({'0027':{1:{title:'Blur',joints:['golf_club_head'],message_box:'Club remains detected'}}},[clip]);
  assert.equal(annotated.explanations.golf_club_head.message,'Club remains detected');
});
test('single-source catalog packages only matched clips and normalizes compact snapshots', () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'unified-golf-'));
  const write=(name,value='')=>{const p=path.join(root,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,value);};
  try {
    write('materials/data/vidoes/face-on/0027.MP4','video');
    write('materials/data/vidoes/face-on/unmatched.MP4','video');
    write('materials/data/predictions/face-on/0027.json',JSON.stringify(raw));
    write('materials/data/snapshot.json',JSON.stringify({'0027':{0:{golf_club_heel:'Hard example'},9:['nose']}}));
    const options={probe:()=>({times:[0,.033],width:100,height:200}),preview:(_,p)=>fs.writeFileSync(p,'image'),warn:()=>{}};
    const c=prepareData(root,options);
    assert.equal(c.clips.length,1);assert.equal(c.clips[0].frameCount,1);
    assert.equal(c.snapshots.length,1);
    assert.equal(c.snapshots[0].prediction.joints.length,5);
    assert.deepEqual(c.snapshots[0].prediction.pred[0][3],[30,40]);
    const files=siteFiles(root,c);
    assert.ok(files.has(c.clips[0].pose));
    assert.ok(files.has('materials/data/snapshot.json'));
    assert.ok(!files.has('materials/data/vidoes/face-on/unmatched.MP4'));
    fs.unlinkSync(path.join(root,c.clips[0].pose));
    assert.equal(prepareData(root,options).clips.length,0);
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});

test('snapshot images are regenerated when missing, reused when fresh, and refreshed after source changes', () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'unified-static-snapshots-'));
  const write=(name,value)=>{const target=path.join(root,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,value);};
  let extracted=0;
  const options={probe:()=>({times:[0],width:100,height:200}),preview:(_,target,frame)=>{if(frame!==null)extracted++;fs.writeFileSync(target,'image');},warn:()=>{}};
  try {
    write('materials/data/vidoes/face-on/clip.MP4','video');
    write('materials/data/predictions/face-on/clip.json',JSON.stringify(raw));
    write('materials/data/snapshot.json',JSON.stringify({clip:{0:{golf_club_heel:'Example'}}}));
    const first=prepareData(root,options);
    assert.equal(first.snapshots[0].image,'materials/data/snapshots/face-on/clip/0.jpg');
    assert.equal(extracted,1);
    prepareData(root,options);assert.equal(extracted,1);
    fs.unlinkSync(path.join(root,first.snapshots[0].image));
    prepareData(root,options);assert.equal(extracted,2);
    write('materials/data/vidoes/face-on/clip.MP4','changed video');
    prepareData(root,options);assert.equal(extracted,3);
    const fast=JSON.parse(fs.readFileSync(path.join(root,'materials/data/snapshot-catalog.json')));
    assert.equal(fast.snapshots.length,1);
    assert.equal(fast.snapshots[0].video,undefined);
    assert.equal(fast.snapshots[0].times,undefined);
    assert.deepEqual(fast.snapshots[0].prediction.pred[0][3],[30,40]);
    assert.ok(siteFiles(root,first).has('materials/data/snapshot-catalog.json'));
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});
