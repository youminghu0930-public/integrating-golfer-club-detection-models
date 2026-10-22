// A local static server with byte-range support for browser video seeking.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareData } from './prepare-data.mjs';

const built = process.argv.includes('--dist');
const root = path.resolve(fileURLToPath(new URL(built ? '../dist/' : '../', import.meta.url)));
if (built && !fs.existsSync(path.join(root, 'index.html'))) {
  console.error('Run node scripts/build-site.mjs before previewing dist/.');
  process.exit(1);
}
const args = process.argv.slice(2).filter(argument => argument !== '--dist');
const port = Number(args[0] ?? 8002);
if (args.length > 1 || !/^\d+$/.test(args[0] ?? '8002') || !Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('Usage: node scripts/serve.mjs [--dist] [port: 1–65535]');
  process.exit(1);
}
let dirty = true;
fs.mkdirSync(path.join(root, 'materials/data'), { recursive: true });
if (!built) fs.watch(path.join(root, 'materials/data'), { recursive: true }, (_, filename) => {
  const file = String(filename || '');
  if (file !== 'catalog.json' && !file.startsWith('.generated')) dirty = true;
});
if (!built) fs.watch(path.join(root, 'materials/content.json'), () => { dirty = true; });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
http.createServer((request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
  let filename;
  try {
    const url = new URL(request.url, 'http://localhost');
    const relative = decodeURIComponent(url.pathname);
    if (!built && relative === '/materials/data/catalog.json' && dirty) {
      const catalog = prepareData(root);
      dirty = false;
      console.log(`Data refreshed: ${catalog.clips.length} videos, ${catalog.snapshots.length} snapshots.`);
    }
    filename = path.resolve(root, `.${relative.endsWith('/') ? `${relative}index.html` : relative}`);
    if (!filename.startsWith(`${root}${path.sep}`) && filename !== path.join(root, 'index.html')) throw new Error('Invalid path');
    if (!fs.statSync(filename).isFile()) throw new Error('Not a file');
  } catch { response.writeHead(404).end(); return; }
  const size = fs.statSync(filename).size;
  const headers = { 'Content-Type': types[path.extname(filename).toLowerCase()] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' };
  let start = 0, end = size - 1;
  if (request.headers.range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
    if (!match || (!match[1] && !match[2])) { response.writeHead(416, { 'Content-Range': `bytes */${size}` }).end(); return; }
    start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
    end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    if (start > end || start >= size) { response.writeHead(416, { 'Content-Range': `bytes */${size}` }).end(); return; }
    headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
  }
  headers['Content-Length'] = Math.max(0, end - start + 1);
  response.writeHead(request.headers.range ? 206 : 200, headers);
  if (request.method === 'HEAD' || !size) { response.end(); return; }
  const stream = fs.createReadStream(filename, { start, end });
  stream.on('error', () => response.destroy());
  response.on('close', () => stream.destroy());
  stream.pipe(response);
})
.on('error', error => {
  console.error(error.code === 'EADDRINUSE'
    ? `Port ${port} is in use. Try another port: node scripts/serve.mjs ${port + 1}`
    : `Could not start preview: ${error.message}`);
  process.exitCode = 1;
})
.listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}`));
