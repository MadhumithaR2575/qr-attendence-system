// routes/sessions.js
const express = require('express');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const router = express.Router();

// Keep interval timers in memory (per session) so tokens rotate automatically.
const activeTimers = {};

function generateToken() {
  return crypto.randomBytes(8).toString('hex');
}

function rotateToken(sessionId, intervalSeconds) {
  const token = generateToken();
  const expiresAt = Date.now() + intervalSeconds * 1000;
  db.get('sessions').find({ id: sessionId }).assign({ currentToken: token, tokenExpiresAt: expiresAt }).write();
}

// Create a new attendance session for a subject.
// body: { subjectName, subjectCode, teacherName, classroomLat, classroomLng, radiusMeters, tokenIntervalSeconds }
router.post('/', (req, res) => {
  const {
    subjectName,
    subjectCode,
    teacherName,
    classroomLat,
    classroomLng,
    radiusMeters = 50,
    tokenIntervalSeconds = 30
  } = req.body;

  if (!subjectName || classroomLat === undefined || classroomLng === undefined) {
    return res.status(400).json({ error: 'subjectName, classroomLat and classroomLng are required' });
  }

  // find or create subject
  let subject = db.get('subjects').find({ name: subjectName, code: subjectCode }).value();
  if (!subject) {
    subject = { id: uuidv4(), name: subjectName, code: subjectCode || '' };
    db.get('subjects').push(subject).write();
  }

  const session = {
    id: uuidv4(),
    subjectId: subject.id,
    subjectName: subject.name,
    teacherName: teacherName || 'Teacher',
    classroomLat: Number(classroomLat),
    classroomLng: Number(classroomLng),
    radiusMeters: Number(radiusMeters),
    tokenIntervalSeconds: Number(tokenIntervalSeconds),
    currentToken: null,
    tokenExpiresAt: null,
    active: true,
    createdAt: new Date().toISOString()
  };

  db.get('sessions').push(session).write();

  // start rotating the QR token immediately, then every N seconds
  rotateToken(session.id, session.tokenIntervalSeconds);
  activeTimers[session.id] = setInterval(
    () => rotateToken(session.id, session.tokenIntervalSeconds),
    session.tokenIntervalSeconds * 1000
  );

  const created = db.get('sessions').find({ id: session.id }).value();
  res.json({ session: created });
});

// Get current QR token/payload for a session (teacher page polls this to redraw the QR code)
router.get('/:id/qr', (req, res) => {
  const session = db.get('sessions').find({ id: req.params.id }).value();
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (!session.active) return res.status(400).json({ error: 'Session has ended' });

  res.json({
    sessionId: session.id,
    token: session.currentToken,
    expiresAt: session.tokenExpiresAt
  });
});

// Get session details
router.get('/:id', (req, res) => {
  const session = db.get('sessions').find({ id: req.params.id }).value();
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json({ session });
});

// List all sessions (most recent first)
router.get('/', (req, res) => {
  const sessions = db.get('sessions').value().slice().reverse();
  res.json({ sessions });
});

// End a session (stops QR rotation)
router.post('/:id/end', (req, res) => {
  const session = db.get('sessions').find({ id: req.params.id }).value();
  if (!session) return res.status(404).json({ error: 'Session not found' });

  if (activeTimers[session.id]) {
    clearInterval(activeTimers[session.id]);
    delete activeTimers[session.id];
  }

  db.get('sessions').find({ id: session.id }).assign({ active: false, currentToken: null }).write();
  res.json({ success: true });
});

module.exports = router;
