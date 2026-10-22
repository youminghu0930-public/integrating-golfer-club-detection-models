import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { encodeDeliveryVideo, videoTiming } from '../scripts/video-delivery.mjs';
import { mp4Boxes } from '../scripts/faststart.mjs';

test('delivery encoding preserves resolution and every frame timestamp at fractional frame rate', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'golf-trial-test-'));
  const source = path.join(root, 'source.mp4'), output = path.join(root, 'trial.mp4');
  try {
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=64x96:rate=30000/1001:duration=1', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', '-c:v', 'libx264', '-crf', '10', '-pix_fmt', 'yuv420p', '-c:a', 'aac', source]);
    const original = fs.readFileSync(source), timing = videoTiming(source);
    const report = encodeDeliveryVideo(source, output);
    assert.equal(report.frames, timing.times.length);
    assert.deepEqual(videoTiming(output), timing);
    assert.deepEqual(fs.readFileSync(source), original);
    const audioHash = file => execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-map', '0:a:0', '-c:a', 'copy', '-f', 'hash', '-'], { encoding: 'utf8' });
    assert.equal(audioHash(output), audioHash(source));
    const boxes = mp4Boxes(output);
    assert.ok(boxes.find(b => b.type === 'moov').offset < boxes.find(b => b.type === 'mdat').offset);
    assert.throws(() => encodeDeliveryVideo(source, output, 100), /CRF/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
