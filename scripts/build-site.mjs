// Package only current data and site code, never the legacy assets directory.
import fs from 'node:fs';
import path from 'node:path';
import { prepareData, projectRoot } from './prepare-data.mjs';
import { writeFastStart } from './faststart.mjs';
import { createHash } from 'node:crypto';
import { encodeDeliveryVideo } from './video-delivery.mjs';
import { siteFiles } from './site-files.mjs';

const catalog = prepareData();
const destination = path.join(projectRoot, 'dist');
// Each build gets a clean output so removed sources cannot survive deployment.
fs.rmSync(destination, { recursive: true, force: true });
fs.mkdirSync(destination, { recursive: true });
const options = JSON.parse(fs.readFileSync(path.join(projectRoot, 'scripts/media-options.json'), 'utf8'));
const encoded = new Set(), reports = [];
if (options.compressVideos) {
  if (!Number.isInteger(options.videoCrf) || options.videoCrf < 0 || options.videoCrf > 51) throw new Error('Invalid video CRF');
  for (const [index, clip] of catalog.clips.entries()) {
    const source = path.join(projectRoot, clip.video);
    const originalBytes = fs.statSync(source).size;
    const hash = createHash('sha256').update(fs.readFileSync(source)).update(`h264-slow-crf${options.videoCrf}-v1`).digest('hex').slice(0, 12);
    const relative = `materials/data/.generated/videos/${clip.key}-${hash}.mp4`;
    const cached = path.join(projectRoot, relative), reportFile = `${cached}.json`;
    fs.mkdirSync(path.dirname(cached), { recursive: true });
    try {
      let report;
      try {
        report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
        if (report.originalBytes !== originalBytes || report.encodedBytes !== fs.statSync(cached).size || !report.frames) report = undefined;
      } catch { report = undefined; /* No validated cached encoding. */ }
      if (!report) {
        console.log(`Encoding ${index+1}/${catalog.clips.length}: ${clip.key}`);
        report = encodeDeliveryVideo(source, cached, options.videoCrf);
        fs.writeFileSync(reportFile, JSON.stringify(report));
      }
      if (report.encodedBytes < originalBytes) {
        const target = path.join(destination, relative);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(cached, target);
        clip.video = relative; encoded.add(relative);
        reports.push({ key: clip.key, ...report, deliveryBytes: report.encodedBytes, compressed: true });
      } else reports.push({ key: clip.key, ...report, deliveryBytes: originalBytes, compressed: false, reason: 'Not smaller than original' });
    } catch (error) {
      console.warn(`Keeping lossless fast-start ${clip.key}: ${error.message}`);
      reports.push({ key: clip.key, originalBytes, deliveryBytes: originalBytes, compressed: false, reason: error.message });
    }
  }
}
const files = siteFiles(projectRoot, catalog);
const videos = new Set(catalog.clips.map(clip => clip.video));
let remuxed = 0;
for (const file of files) {
  const target = path.join(destination, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (encoded.has(file)) continue;
  if (videos.has(file)) remuxed += Number(writeFastStart(path.join(projectRoot, file), target));
  else if (file.endsWith('.json')) {
    // Strip formatting only: joint values and source files remain untouched.
    fs.writeFileSync(target, JSON.stringify(JSON.parse(fs.readFileSync(path.join(projectRoot, file), 'utf8'))));
  } else fs.copyFileSync(path.join(projectRoot, file), target);
}
fs.writeFileSync(path.join(destination, 'materials/data/catalog.json'), JSON.stringify(catalog));
if (reports.length) {
  const totals = reports.reduce((sum, report) => ({ originalBytes: sum.originalBytes+report.originalBytes, deliveryBytes: sum.deliveryBytes+report.deliveryBytes }), { originalBytes: 0, deliveryBytes: 0 });
  fs.writeFileSync(path.join(projectRoot, 'materials/data/.generated/video-delivery-report.json'), JSON.stringify({ ...totals, clips: reports }, null, 2));
  console.log(`Compressed ${encoded.size}/${catalog.clips.length} videos: ${totals.originalBytes} → ${totals.deliveryBytes} bytes; frame alignment verified.`);
}
console.log(`Built dist/ from ${catalog.clips.length} actual data clips; legacy assets excluded.`);
console.log(`Fast-start metadata moved for ${remuxed} videos without re-encoding; original data untouched.`);
