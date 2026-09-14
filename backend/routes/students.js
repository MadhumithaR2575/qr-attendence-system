// routes/students.js
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const router = express.Router();

// Register a new student (name, roll number, pin). Face descriptor added later via /enroll-face.
router.post('/register', (req, res) => {
  const { name, rollNo, pin } = req.body;
  if (!name || !rollNo || !pin) {
    return res.status(400).json({ error: 'name, rollNo and pin are required' });
  }

  const existing = db.get('students').find({ rollNo }).value();
  if (existing) {
    return res.status(409).json({ error: 'A student with this roll number already exists' });
  }

  const student = {
    id: uuidv4(),
    name,
    rollNo,
    pin,
    faceDescriptor: null,
    createdAt: new Date().toISOString()
  };

  db.get('students').push(student).write();
  res.json({ student: { ...student, pin: undefined } });
});

// Login with rollNo + pin -> returns student record (without pin)
router.post('/login', (req, res) => {
  const { rollNo, pin } = req.body;
  const student = db.get('students').find({ rollNo, pin }).value();
  if (!student) {
    return res.status(401).json({ error: 'Invalid roll number or PIN' });
  }
  res.json({ student: { ...student, pin: undefined } });
});

// Save the face descriptor captured client-side by face-api.js (128 floats)
router.post('/:id/enroll-face', (req, res) => {
  const { id } = req.params;
  const { faceDescriptor } = req.body;

  if (!Array.isArray(faceDescriptor) || faceDescriptor.length !== 128) {
    return res.status(400).json({ error: 'faceDescriptor must be an array of 128 numbers' });
  }

  const student = db.get('students').find({ id }).value();
  if (!student) return res.status(404).json({ error: 'Student not found' });

  db.get('students').find({ id }).assign({ faceDescriptor }).write();
  res.json({ success: true });
});

// List all students (for teacher view / debugging)
router.get('/', (req, res) => {
  const students = db.get('students').value().map((s) => ({ ...s, pin: undefined }));
  res.json({ students });
});

module.exports = router;
