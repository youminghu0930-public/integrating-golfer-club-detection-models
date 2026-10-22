import { normalizePrediction } from '../prediction-data.js';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

// Decorative playback has its own small, silent asset; comparison sources stay intact.
export function prepareBanner(root, clips, settings) {
  if (!settings?.video || settings.enabled === false) return null;
  const matches = clips.filter(clip => clip.key === settings.video || clip.id === settings.video);
  if (matches.length !== 1) return null;
  const clip = matches[0];
  const source = path.join(root, clip.video);
  const poseSource = path.join(root, clip.pose);
  const hash = createHash('sha256').update(fs.readFileSync(source)).update(fs.readFileSync(poseSource))
    .update('banner-480-crf30-unified-v3').digest('hex').slice(0, 12);
  const base = `materials/data/.generated/banner-${clip.key}-${hash}`;
  const video = `${base}.mp4`, pose = `${base}.json`, poster = `${base}-first.webp`;
  const data = normalizePrediction(JSON.parse(fs.readFileSync(poseSource, 'utf8')));
  if (!fs.existsSync(path.join(root, poster))) {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', source, '-vf', 'scale=480:-2',
      '-frames:v', '1', '-c:v', 'libwebp', '-quality', '82', path.join(root, poster)]);
  }
  if (!fs.existsSync(path.join(root, video))) {
    const temporary = path.join(root, `${base}.tmp.mp4`);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', source, '-map', '0:v:0', '-an',
      '-vf', 'scale=480:-2', '-c:v', 'libx264', '-preset', 'fast', '-crf', '30',
      '-pix_fmt', 'yuv420p', '-fps_mode', 'passthrough', '-enc_time_base:v', '1:1000000', '-movflags', '+faststart', temporary]);
    fs.renameSync(temporary, path.join(root, video));
  }
  if (!fs.existsSync(path.join(root, pose))) {
    fs.writeFileSync(path.join(root, pose), JSON.stringify({ joints: data.joints, pred: data.pred.slice(0, clip.frameCount) }));
  }
  return { key: clip.key, video, pose, poster, previewPose: { joints: data.joints, pred: [data.pred[0]] } };
}
