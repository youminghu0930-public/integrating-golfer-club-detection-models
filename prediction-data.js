// Source files omit the shaft-midpoint name; the coordinate order is confirmed by the owner.
export function normalizePrediction(data) {
  if (!Array.isArray(data?.joints) || !Array.isArray(data?.pred)) throw new Error('Invalid prediction: expected joints and pred arrays');
  const joints = [...data.joints];
  const grip = joints.indexOf('golf_club_grip');
  if (!joints.includes('golf_club_shaft_midpoint') && grip >= 0 && joints[grip + 1] === 'golf_club_heel'
      && data.pred.length && data.pred.every(frame => Array.isArray(frame) && frame.length === joints.length + 1)) {
    joints.splice(grip + 1, 0, 'golf_club_shaft_midpoint');
  }
  if (data.pred.some(frame => !Array.isArray(frame) || frame.length !== joints.length)) {
    throw new Error('Prediction coordinates do not match the joint definitions');
  }
  return { ...data, joints };
}
