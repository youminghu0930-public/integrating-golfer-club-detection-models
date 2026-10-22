// Generate metadata and small previews from data, never duplicate videos or poses.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { snapshotItems } from '../snapshot-data.js';
import { prepareBanner } from './banner-assets.mjs';
import { normalizePrediction } from '../prediction-data.js';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const directories = directory => fs.existsSync(directory) ? fs.readdirSync(directory, { withFileTypes: true }).filter(e => e.isDirectory() && !e.name.startsWith('.')).map(e => e.name).sort() : [];

export function prepareData(root = projectRoot, { probe = probeVideo, preview = makePreview, warn = console.warn } = {}) {
  const options = read(fileURLToPath(new URL('./media-options.json', import.meta.url)));
  if (!Number.isInteger(options.snapshotWebpQuality) || options.snapshotWebpQuality < 0 || options.snapshotWebpQuality > 100) throw new Error('Snapshot WebP quality must be an integer from 0 to 100');
  for (const command of [probe === probeVideo && 'ffprobe', preview === makePreview && 'ffmpeg'].filter(Boolean)) {
    try { execFileSync(command, ['-version'], { stdio: 'ignore' }); }
    catch { throw new Error(`Install FFmpeg (including ${command}) before preparing data.`); }
  }
  const generated = path.join(root, 'materials/data/.generated');
  fs.mkdirSync(generated, { recursive: true });
  const cacheFile = path.join(generated, 'probe-cache.json');
  let oldCache = {};
  try { oldCache = read(cacheFile); } catch { /* Fresh checkout or invalid disposable cache. */ }
  const cache = {};
  const ensurePreview = (source, destination, frame) => {
    if (!fs.existsSync(destination) || fs.statSync(destination).mtimeMs < fs.statSync(source).mtimeMs) preview(source, destination, frame);
  };
  const clips = [];
  for (const view of directories(path.join(root, 'materials/data/vidoes'))) {
    const folder = path.join(root, 'materials/data/vidoes', view);
    for (const filename of fs.readdirSync(folder).filter(name => /\.mp4$/i.test(name)).sort()) {
      const id = path.parse(filename).name, key = `${view}-${id}`;
      const video = `materials/data/vidoes/${view}/${filename}`;
      const prediction = `materials/data/predictions/${view}/${id}.json`;
      if (!fs.existsSync(path.join(root, prediction))) {
        warn(`Skipping ${key}: missing predictions.`); continue;
      }
      try {
        const pose = normalizePrediction(read(path.join(root, prediction)));
        const counts = [pose.pred.length];
        const source = path.join(root, video), stat = fs.statSync(source);
        const signature = `${stat.size}:${stat.mtimeMs}`;
        const metadata = oldCache[video]?.signature === signature ? oldCache[video].metadata : probe(source);
        const hash = oldCache[video]?.signature === signature && oldCache[video].hash
          ? oldCache[video].hash : createHash('sha256').update(fs.readFileSync(source)).digest('hex').slice(0, 12);
        cache[video] = { signature, metadata, hash };
        const frameCount = Math.min(metadata.times.length, ...counts);
        if (!frameCount) throw new Error('No shared frames');
        const thumbnail = `materials/data/.generated/${key}-thumbnail.jpg`;
        ensurePreview(source, path.join(root, thumbnail), null);
        clips.push({ id, key, view, video, pose: prediction, thumbnail, frameCount, videoFrameCount: metadata.times.length,
          poseFrameCounts: counts, width: metadata.width, height: metadata.height, times: metadata.times.slice(0, frameCount) });
      } catch (error) { warn(`Skipping ${key}: ${error.message}`); }
    }
  }
  const snapshots = [];
  const snapshotPoses = new Map();
  const configFile = path.join(root, 'materials/data/predictions/snapshot.json');
  if (fs.existsSync(configFile)) {
    try {
      for (const { clip, frame } of snapshotItems(read(configFile), clips, { onWarning: warn })) {
        const hash = cache[clip.video].hash;
        const image = `materials/data/.generated/${clip.key}-frame-${frame}-${hash}-q${options.snapshotWebpQuality}.webp`;
        try {
          if (!fs.existsSync(path.join(root, image))) preview(path.join(root, clip.video), path.join(root, image), frame, options.snapshotWebpQuality);
          const snapshot = { key: `${clip.key}-${frame}`, image };
          const file = clip.pose;
          if (!snapshotPoses.has(file)) snapshotPoses.set(file, normalizePrediction(read(path.join(root, file))));
          const pose = snapshotPoses.get(file);
          snapshot.prediction = { joints: pose.joints, pred: [pose.pred[frame].slice(0, pose.joints.length)] };
          snapshots.push(snapshot);
        } catch (error) { warn(`Snapshot preview ${clip.key}/${frame}: ${error.message}`); }
      }
    } catch (error) { warn(`Snapshot configuration: ${error.message}`); }
  }
  const catalog = { clips, snapshots };
  try {
    const contentFile = path.join(root, 'materials/content.json');
    if (fs.existsSync(contentFile)) catalog.banner = prepareBanner(root, clips, read(contentFile).page?.banner);
  } catch (error) { warn(`Banner preview unavailable: ${error.message}`); }
  fs.writeFileSync(path.join(root, 'materials/data/catalog.json'), JSON.stringify(catalog));
  fs.writeFileSync(cacheFile, JSON.stringify(cache));
  return catalog;
}

function probeVideo(file) {
  const result = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_frames', '-show_streams', '-show_entries', 'stream=width,height:frame=best_effort_timestamp_time', '-of', 'json', file], { maxBuffer: 32 * 1024 * 1024 }));
  const origin = Number(result.frames[0]?.best_effort_timestamp_time);
  const times = result.frames.map(frame => Number((Number(frame.best_effort_timestamp_time) - origin).toFixed(6)));
  if (!times.length || !times.every(Number.isFinite)) throw new Error('Invalid video frame times');
  return { times, width: result.streams[0].width, height: result.streams[0].height };
}

function makePreview(source, destination, frame, quality = 82) {
  const filter = frame === null ? 'scale=192:192:force_original_aspect_ratio=decrease' : `select=eq(n\\,${frame})`;
  const codec = frame === null ? ['-q:v', '5'] : ['-c:v', 'libwebp', '-quality', String(quality), '-compression_level', '6'];
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', source, '-vf', filter, '-frames:v', '1', ...codec, destination]);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const catalog = prepareData();
  console.log(`Indexed ${catalog.clips.length} videos and ${catalog.snapshots.length} snapshots directly from materials/data/.`);
}
