import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

export function videoTiming(file) {
  const result = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_frames', '-show_streams', '-show_entries', 'stream=width,height,time_base:frame=best_effort_timestamp_time', '-of', 'json', file], { maxBuffer: 32 * 1024 * 1024 }));
  const start = Number(result.frames[0]?.best_effort_timestamp_time);
  return { width: result.streams[0].width, height: result.streams[0].height, timeBase: result.streams[0].time_base,
    times: result.frames.map(frame => Number(frame.best_effort_timestamp_time)-start) };
}

export function encodeDeliveryVideo(source, destination, crf = 23) {
  if (!Number.isInteger(crf) || crf < 0 || crf > 51) throw new Error('Invalid H.264 CRF');
  const original = videoTiming(source);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', source, '-map', '0:v:0', '-map', '0:a?',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-pix_fmt', 'yuv420p',
    '-fps_mode', 'passthrough', '-enc_time_base:v', original.timeBase.replace('/', ':'),
    '-c:a', 'copy', '-movflags', '+faststart', destination]);
  const output = videoTiming(destination);
  const aligned = output.width === original.width && output.height === original.height && output.times.length === original.times.length
    && original.times.every((time, i) => Number.isFinite(time) && Math.abs(time-output.times[i]) < .00001);
  if (!aligned) throw new Error('Encoding rejected: resolution, frame count or frame timing changed');
  return { originalBytes: fs.statSync(source).size, encodedBytes: fs.statSync(destination).size, frames: output.times.length };
}
