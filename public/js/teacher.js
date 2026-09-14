// js/teacher.js
let classroomLat = null;
let classroomLng = null;
let sessionId = null;
let qrPollTimer = null;
let attendancePollTimer = null;

function showStatus(el, message, type) {
  el.textContent = message;
  el.className = `status show ${type}`;
}

document.getElementById('locate-btn').addEventListener('click', () => {
  const statusEl = document.getElementById('locate-status');
  showStatus(statusEl, 'Getting location...', 'info');

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      classroomLat = pos.coords.latitude;
      classroomLng = pos.coords.longitude;
      showStatus(statusEl, `Classroom location set (accuracy ~${Math.round(pos.coords.accuracy)}m)`, 'success');
      document.getElementById('start-btn').disabled = false;
    },
    (err) => showStatus(statusEl, 'Location error: ' + err.message, 'error'),
    { enableHighAccuracy: true }
  );
});

document.getElementById('start-btn').addEventListener('click', async () => {
  const subjectName = document.getElementById('subjectName').value.trim();
  const subjectCode = document.getElementById('subjectCode').value.trim();
  const teacherName = document.getElementById('teacherName').value.trim();
  const tokenIntervalSeconds = Number(document.getElementById('tokenInterval').value);
  const radiusMeters = Number(document.getElementById('radius').value);

  if (!subjectName || classroomLat === null) {
    alert('Please enter a subject name and set the classroom location first.');
    return;
  }

  const res = await fetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subjectName,
      subjectCode,
      teacherName,
      classroomLat,
      classroomLng,
      radiusMeters,
      tokenIntervalSeconds
    })
  });
  const data = await res.json();
  if (!res.ok) {
    alert(data.error || 'Failed to start session');
    return;
  }

  sessionId = data.session.id;
  document.getElementById('setup-card').style.display = 'none';
  document.getElementById('qr-card').style.display = 'block';
  document.getElementById('attendance-card').style.display = 'block';
  document.getElementById('session-title').textContent = `${subjectName} — Session Active`;

  refreshQR();
  qrPollTimer = setInterval(refreshQR, 3000);
  attendancePollTimer = setInterval(refreshAttendance, 3000);
});

async function refreshQR() {
  if (!sessionId) return;

  const res = await fetch(`/api/sessions/${sessionId}/qr`);
  if (!res.ok) return;
  const data = await res.json();

  if (data.qrDataUrl) {
    document.getElementById('qr-image').src = data.qrDataUrl;
  }

  const secondsLeft = Math.max(0, Math.round((data.expiresAt - Date.now()) / 1000));
  document.getElementById('timer-text').textContent = `Refreshes in ~${secondsLeft}s`;
}

async function refreshAttendance() {
  if (!sessionId) return;
  const res = await fetch(`/api/attendance/session/${sessionId}`);
  const data = await res.json();
  const tbody = document.getElementById('attendance-body');
  tbody.innerHTML = '';

  data.records
    .slice()
    .reverse()
    .forEach((r) => {
      const tr = document.createElement('tr');
      const time = new Date(r.timestamp).toLocaleTimeString();
      tr.innerHTML = `
        <td>${r.studentName}</td>
        <td>${r.rollNo}</td>
        <td><span class="badge ${r.status}">${r.status}</span></td>
        <td>${time}</td>
      `;
      tbody.appendChild(tr);
    });
}

document.getElementById('end-btn').addEventListener('click', async () => {
  if (!sessionId) return;
  await fetch(`/api/sessions/${sessionId}/end`, { method: 'POST' });
  clearInterval(qrPollTimer);
  clearInterval(attendancePollTimer);
  document.getElementById('timer-text').textContent = 'Session ended.';
  document.getElementById('end-btn').disabled = true;
});

document.getElementById('export-btn').addEventListener('click', () => {
  if (!sessionId) return;
  window.location.href = `/api/attendance/session/${sessionId}/export`;
});
