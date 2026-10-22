export function snapshotItems(config, clips, { onWarning } = {}) {
  const entries = [];
  for (const [video, frames] of Object.entries(config)) {
    const matches = clips.filter(clip => clip.key === video || clip.id === video);
    if (matches.length !== 1) {
      const error = `Snapshot video ${video}: expected one matching clip, found ${matches.length}. Use a view-specific key if ambiguous.`;
      if (onWarning) { onWarning(error); continue; }
      throw new Error(error);
    }
    const clip = matches[0];
    for (const [value, sample] of Object.entries(frames)) {
      const legacy = Array.isArray(sample);
      const definitions = !legacy && sample?.joints;
      // Accept the project's compact {joint: message} form and annotated form.
      const compact = !legacy && !definitions ? Object.fromEntries(Object.entries(sample || {}).filter(([key, value]) => !['title','message_box'].includes(key) && typeof value === 'string')) : null;
      const joints = legacy ? sample : Array.isArray(definitions) ? definitions : definitions && typeof definitions === 'object' ? Object.keys(definitions) : Object.keys(compact || {});
      const frame = Number(value);
      const error = !Number.isInteger(frame) || frame < 0 || frame >= clip.frameCount
        ? `Invalid snapshot frame ${video}/${value}`
        : !Array.isArray(joints) || !joints.length || joints.some(joint => typeof joint !== 'string')
          ? `Snapshot ${video}/${value} needs at least one joint name` : null;
      if (error) {
        if (onWarning) { onWarning(error); continue; }
        throw new Error(error);
      }
      const entry = { clip, frame, joints: [...new Set(joints)] };
      if (!legacy) {
        entry.title = typeof sample.title === 'string' ? sample.title : '';
        entry.explanations = Object.fromEntries(joints.map(name => [name, {
          message: compact?.[name] ?? (typeof definitions?.[name] === 'string' ? definitions[name] : definitions?.[name]?.message) ?? sample.message_box?.message ?? (typeof sample.message_box === 'string' ? sample.message_box : ''),
        }]));
      }
      entries.push(entry);
    }
  }
  return entries;
}

export function spotlightPoints(pose, names) {
  return names.flatMap(name => {
    const index = pose.joints.indexOf(name);
    const point = index < 0 ? null : pose.pred[0]?.[index];
    return point && Number.isFinite(point[0]) && Number.isFinite(point[1]) && (point[2] === undefined || point[2] >= 0) && (point[0] !== 0 || point[1] !== 0) ? [point.slice(0, 2)] : [];
  });
}

export function snapshotFocus(entry) {
  const average = points => ({ x: points.reduce((sum, point) => sum+point[0], 0)/points.length, y: points.reduce((sum, point) => sum+point[1], 0)/points.length });
  const centers = ['prediction'].flatMap(side => {
    const points = entry[side] ? spotlightPoints(entry[side], entry.joints) : [];
    return points.length ? [average(points)] : [];
  });
  return centers.length ? average(centers.map(point => [point.x, point.y])) : null;
}
