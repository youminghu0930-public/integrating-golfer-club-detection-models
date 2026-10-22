import { spotlightPoints } from './snapshot-data.js';

// Lower values leave more space around the automatically fitted skeleton.
export const SNAPSHOT_ZOOM_MULTIPLIER = 0.8;

// Center the human bounds, then fit the entire human + club symmetrically around it.
export function skeletonView({ pose, width, height, viewportWidth, viewportHeight, padding = 24 }) {
  const all = pose ? spotlightPoints(pose, pose.joints) : [];
  const body = pose ? spotlightPoints(pose, pose.joints.filter(name => !name.startsWith('golf_club_'))) : [];
  const fit = Math.min(viewportWidth / width, viewportHeight / height);
  if (!all.length || !fit || !viewportWidth || !viewportHeight) return { zoom: 1, x: 0, y: 0 };
  const centerPoints = body.length ? body : all;
  const cx = (Math.min(...centerPoints.map(p => p[0])) + Math.max(...centerPoints.map(p => p[0]))) / 2;
  const cy = (Math.min(...centerPoints.map(p => p[1])) + Math.max(...centerPoints.map(p => p[1]))) / 2;
  const dx = Math.max(1, ...all.map(p => Math.abs(p[0] - cx)));
  const dy = Math.max(1, ...all.map(p => Math.abs(p[1] - cy)));
  const inset = Math.min(padding, viewportWidth * .1, viewportHeight * .1);
  const fittedZoom = Math.min(6, (viewportWidth - 2 * inset) / (2 * dx * fit), (viewportHeight - 2 * inset) / (2 * dy * fit));
  const zoom = Math.max(1, fittedZoom * SNAPSHOT_ZOOM_MULTIPLIER);
  return { zoom, x: -(cx - width / 2) * fit * zoom / viewportWidth,
    y: -(cy - height / 2) * fit * zoom / viewportHeight };
}

