import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { mp4Boxes, writeFastStart } from '../scripts/faststart.mjs';

test('fast-start preserves decoded frames, timestamps, audio, and source bytes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'golf-faststart-test-'));
  const source = path.join(root, 'original.mp4'), output = path.join(root, 'web.mp4');
  try {
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=32x32:rate=5:duration=1', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', source]);
    const original = fs.readFileSync(source);
    const boxes = mp4Boxes(source);
    assert.ok(boxes.find(b => b.type === 'moov').offset > boxes.find(b => b.type === 'mdat').offset);
    assert.equal(writeFastStart(source, output), true);
    const optimized = mp4Boxes(output);
    assert.ok(optimized.find(b => b.type === 'moov').offset < optimized.find(b => b.type === 'mdat').offset);
    assert.deepEqual(fs.readFileSync(source), original);
    const hashes = file => execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-map', '0:v:0', '-f', 'framemd5', '-'], { encoding: 'utf8' });
    assert.equal(hashes(output), hashes(source));
    const metadata = file => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_frames', '-show_entries', 'stream=codec_type,width,height:frame=best_effort_timestamp_time', '-of', 'json', file], { encoding: 'utf8' }));
    assert.deepEqual(metadata(output), metadata(source));
    assert.equal(writeFastStart(output, path.join(root, 'already-fast.mp4')), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
