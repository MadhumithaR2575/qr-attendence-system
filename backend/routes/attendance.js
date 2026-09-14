// routes/attendance.js
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { haversineDistanceMeters } = require('../utils/geo');
const { isSamePerson, FACE_MATCH_THRESHOLD } = require('../utils/faceMatch');

const router = express.Router();

// Mark attendance. This is the core anti-proxy check: QR token + face match + geolocation.
// body: { sessionId, studentId, token, faceDescriptor: [128 floats], lat, lng }
router.post('/', (req, res) => {
  const { sessionId, studentId, token, faceDescriptor, lat, lng } = req.body;

  if (!sessionId || !studentId || !token || lat === undefined || lng === undefined) {
    return res.status(400).json({ error: 'sessionId, studentId, token, lat, lng are required' });
  }

  const session = db.get('sessions').find({ id: sessionId }).value();
  if (!session || !session.active) {
    return res.status(400).json({ error: 'Session is not active' });
  }

  const student = db.get('students').find({ id: studentId }).value();
  if (!student) {
    return res.status(404).json({ error: 'Student not found' });
  }

  // 1. Prevent duplicate attendance in the same session
  const already = db.get('attendance').find({ sessionId, studentId }).value();
  if (already) {
    return res.status(409).json({ error: 'Attendance already marked for this session', record: already });
  }

  const record = {
    id: uuidv4(),
    sessionId,
    studentId,
    studentName: student.name,
    rollNo: student.rollNo,
    timestamp: new Date().toISOString(),
    status: 'rejected',
    reason: '',
    faceDistance: null,
    locationDistanceMeters: null
  };

  // 2. Check QR token is current and not expired
  if (token !== session.currentToken || Date.now() > session.tokenExpiresAt) {
    record.reason = 'QR code expired or invalid - please rescan';
    db.get('attendance').push(record).write();
    return res.status(400).json({ error: record.reason, record });
  }

  // 3. Check location is within classroom radius
  const distance = haversineDistanceMeters(session.classroomLat, session.classroomLng, Number(lat), Number(lng));
  record.locationDistanceMeters = Math.round(distance);
  if (distance > session.radiusMeters) {
    record.reason = `Outside classroom range (${Math.round(distance)}m away, allowed ${session.radiusMeters}m)`;
    db.get('attendance').push(record).write();
    return res.status(400).json({ error: record.reason, record });
  }

  // 4. Check face matches the student's enrolled face
  if (!student.faceDescriptor) {
    record.reason = 'Student has not enrolled their face yet';
    db.get('attendance').push(record).write();
    return res.status(400).json({ error: record.reason, record });
  }

  if (!Array.isArray(faceDescriptor) || faceDescriptor.length !== 128) {
    record.reason = 'No valid face detected during scan';
    db.get('attendance').push(record).write();
    return res.status(400).json({ error: record.reason, record });
  }

  const { match, distance: faceDistance } = isSamePerson(student.faceDescriptor, faceDescriptor);
  record.faceDistance = Number(faceDistance.toFixed(4));
  if (!match) {
    record.reason = `Face did not match enrolled student (distance ${record.faceDistance}, threshold ${FACE_MATCH_THRESHOLD})`;
    db.get('attendance').push(record).write();
    return res.status(400).json({ error: record.reason, record });
  }

  // All checks passed
  record.status = 'present';
  record.reason = 'All checks passed';
  db.get('attendance').push(record).write();
  res.json({ success: true, record });
});

// List attendance records for a session
router.get('/session/:sessionId', (req, res) => {
  const records = db.get('attendance').filter({ sessionId: req.params.sessionId }).value();
  res.json({ records });
});

// Export attendance for a session as CSV
router.get('/session/:sessionId/export', (req, res) => {
  const records = db.get('attendance').filter({ sessionId: req.params.sessionId }).value();
  const header = 'Name,RollNo,Status,Timestamp,Reason,FaceDistance,LocationDistanceMeters\n';
  const rows = records
    .map((r) =>
      [r.studentName, r.rollNo, r.status, r.timestamp, r.reason, r.faceDistance, r.locationDistanceMeters]
        .map((v) => `"${v ?? ''}"`)
        .join(',')
    )
    .join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="attendance-${req.params.sessionId}.csv"`);
  res.send(header + rows);
});

module.exports = router;
