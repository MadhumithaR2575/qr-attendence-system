// server.js
const express = require('express');
const cors = require('cors');
const path = require('path');

const studentRoutes = require('./routes/students');
const sessionRoutes = require('./routes/sessions');
const attendanceRoutes = require('./routes/attendance');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '5mb' })); // face descriptors + base64-ish payloads can be sizeable

// API routes
app.use('/api/students', studentRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/attendance', attendanceRoutes);

// Serve the frontend (plain HTML/JS, no build step needed)
app.use(express.static(path.join(__dirname, '..', 'public')));

app.listen(PORT, () => {
  console.log(`QR Attendance server running at http://localhost:${PORT}`);
});
