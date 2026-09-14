// utils/faceMatch.js
// Compares two 128-length face descriptor arrays (produced by face-api.js in the browser)
// using Euclidean distance. Lower distance = more similar faces.
// A distance below ~0.6 is generally considered "same person" for face-api.js models.

function euclideanDistance(descriptor1, descriptor2) {
  if (
    !Array.isArray(descriptor1) ||
    !Array.isArray(descriptor2) ||
    descriptor1.length !== descriptor2.length
  ) {
    return Infinity;
  }

  let sum = 0;
  for (let i = 0; i < descriptor1.length; i++) {
    const diff = descriptor1[i] - descriptor2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

const FACE_MATCH_THRESHOLD = 0.6; // tune this: lower = stricter

function isSamePerson(descriptor1, descriptor2) {
  const distance = euclideanDistance(descriptor1, descriptor2);
  return { match: distance < FACE_MATCH_THRESHOLD, distance };
}

module.exports = { euclideanDistance, isSamePerson, FACE_MATCH_THRESHOLD };
