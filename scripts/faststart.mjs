import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

// Read top-level MP4 headers only; never scan/decode the media payload.
export function mp4Boxes(file) {
  const descriptor = fs.openSync(file, 'r'), boxes = [], header = Buffer.alloc(16);
  try {
    const length = fs.fstatSync(descriptor).size;
    let offset = 0;
    while (offset + 8 <= length) {
      const read = fs.readSync(descriptor, header, 0, Math.min(16, length-offset), offset);
      let size = header.readUInt32BE(0), minimum = 8;
      if (size === 1) { if (read < 16) throw new Error('Truncated MP4 header'); size = Number(header.readBigUInt64BE(8)); minimum = 16; }
      if (size === 0) size = length-offset;
      if (!Number.isSafeInteger(size) || size < minimum || offset+size > length) throw new Error('Invalid MP4 box size');
      boxes.push({ type: header.toString('ascii', 4, 8), offset, size });
      offset += size;
    }
    return boxes;
  } finally { fs.closeSync(descriptor); }
}

export function writeFastStart(source, destination) {
  const boxes = mp4Boxes(source);
  const metadata = boxes.find(box => box.type === 'moov'), media = boxes.find(box => box.type === 'mdat');
  if (!metadata || !media) throw new Error(`Missing MP4 metadata/media: ${source}`);
  if (metadata.offset < media.offset) { fs.copyFileSync(source, destination); return false; }
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', source, '-map', '0', '-c', 'copy', '-movflags', '+faststart', destination]);
  return true;
}
