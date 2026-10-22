import fs from 'node:fs';
import path from 'node:path';

// Never copy materials/ recursively: it contains source videos and local caches.
export function siteFiles(root, catalog) {
  const files = new Set(['index.html', 'styles.css', '.nojekyll', 'materials/content.json', 'materials/data/catalog.json']);
  for (const filename of fs.readdirSync(root)) if (filename.endsWith('.js')) files.add(filename);
  for (const filename of ['materials/data/credits.json', 'materials/data/predictions/snapshot.json']) if (fs.existsSync(path.join(root, filename))) files.add(filename);
  for (const clip of catalog.clips) for (const file of [clip.video, clip.thumbnail, clip.pose]) files.add(file);
  for (const snapshot of catalog.snapshots) files.add(snapshot.image);
  if (catalog.banner) for (const file of [catalog.banner.video, catalog.banner.pose, catalog.banner.poster].filter(Boolean)) files.add(file);
  return files;
}
