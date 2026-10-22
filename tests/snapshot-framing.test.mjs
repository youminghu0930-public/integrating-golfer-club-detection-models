import test from 'node:test';
import assert from 'node:assert/strict';
import { skeletonView } from '../snapshot-framing.js';
import { projectSnapshotPoint } from '../snapshot-callouts.js';

for (const [viewportWidth,viewportHeight] of [[820,440],[340,440]]) {
  test(`full skeleton fits and human stays centered at ${viewportWidth}px`, () => {
    const pose={joints:['top_head','left_ankle','right_ankle','golf_club_grip','golf_club_head'],pred:[[[350,300],[300,1100],[450,1100],[400,650],[700,150]]]};
    const state=skeletonView({pose,width:720,height:1280,viewportWidth,viewportHeight});
    const center=projectSnapshotPoint([375,700],720,1280,viewportWidth,viewportHeight,state);
    assert.ok(Math.abs(center.x-viewportWidth/2)<1e-8);
    assert.ok(Math.abs(center.y-viewportHeight/2)<1e-8);
    for(const point of pose.pred[0]) {
      const projected=projectSnapshotPoint(point,720,1280,viewportWidth,viewportHeight,state);
      assert.ok(projected.x>=23.99&&projected.x<=viewportWidth-23.99);
      assert.ok(projected.y>=23.99&&projected.y<=viewportHeight-23.99);
    }
  });
}
test('missing geometry defaults to the full image',()=>{
  assert.deepEqual(skeletonView({pose:{joints:[],pred:[[]]},width:720,height:1280,viewportWidth:340,viewportHeight:440}),{zoom:1,x:0,y:0});
});


test('automatic framing honors the template minimum even with out-of-frame joints', () => {
  const state=skeletonView({pose:{joints:['nose','golf_club_head'],pred:[[[360,640],[-1000,-1000]]]},width:720,height:1280,viewportWidth:320,viewportHeight:440});
  assert.equal(state.zoom,1);
});
