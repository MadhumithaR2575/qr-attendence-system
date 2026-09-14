// db.js
// Simple JSON-file database using lowdb (v1, synchronous API).
// Good enough for a college project demo - no external DB server needed.

const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');

const adapter = new FileSync(path.join(__dirname, 'data.json'));
const db = low(adapter);

// Set default structure if the file is empty
db.defaults({
  students: [],   // { id, name, rollNo, pin, faceDescriptor: [128 floats] | null }
  subjects: [],   // { id, name, code }
  sessions: [],   // { id, subjectId, teacherName, classroomLat, classroomLng, radiusMeters,
                  //   currentToken, tokenExpiresAt, tokenIntervalSeconds, active, createdAt }
  attendance: []  // { id, sessionId, studentId, timestamp, status, reason, faceDistance, locationDistanceMeters }
}).write();

module.exports = db;
