// Joint names in the source are authoritative; never insert or shift coordinates.
export function normalizePrediction(data) {
  if (!Array.isArray(data?.joints) || !Array.isArray(data?.pred)) throw new Error('Invalid prediction: expected joints and pred arrays');
  const joints = [...data.joints];
  if (data.pred.some(frame => !Array.isArray(frame) || frame.length !== joints.length)) {
    throw new Error('Prediction coordinates do not match the joint definitions');
  }
  return { ...data, joints };
}
