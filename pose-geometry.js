export function clippedBone(a, b, radius) {
  const dx = b[0]-a[0], dy = b[1]-a[1], length = Math.hypot(dx, dy);
  if (length <= radius*2) return null;
  const x = radius*dx/length, y = radius*dy/length;
  return [[a[0]+x,a[1]+y],[b[0]-x,b[1]-y]];
}
// Transform source geometry inside a fixed-resolution SVG, never a scaled SVG texture.
export function overlayTransform(width, height, viewportWidth, viewportHeight, state) {
  const scale = Math.min(viewportWidth/width, viewportHeight/height);
  if (!scale) return '';
  return `translate(${width/2 + state.x*viewportWidth/scale} ${height/2 + state.y*viewportHeight/scale}) scale(${state.zoom}) translate(${-width/2} ${-height/2})`;
}
