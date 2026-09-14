// js/enroll.js
const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
let currentStudentId = null;
let modelsLoaded = false;

function showStatus(el, message, type) {
  el.textContent = message;
  el.className = `status show ${type}`;
}

document.getElementById('register-btn').addEventListener('click', async () => {
  const name = document.getElementById('name').value.trim();
  const rollNo = document.getElementById('rollNo').value.trim();
  const pin = document.getElementById('pin').value.trim();
  const statusEl = document.getElementById('register-status');

  if (!name || !rollNo || !pin) {
    showStatus(statusEl, 'Please fill in all fields.', 'error');
    return;
  }

  try {
    const res = await fetch('/api/students/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, rollNo, pin })
    });
    const data = await res.json();

    if (!res.ok) {
      showStatus(statusEl, data.error || 'Registration failed', 'error');
      return;
    }

    currentStudentId = data.student.id;
    showStatus(statusEl, `Registered! Student ID saved. Now enroll your face below.`, 'success');
    document.getElementById('face-card').style.display = 'block';
    await startCamera();
  } catch (err) {
    showStatus(statusEl, 'Network error: ' + err.message, 'error');
  }
});

async function startCamera() {
  const video = document.getElementById('video');
  const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
  video.srcObject = stream;

  if (!modelsLoaded) {
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    modelsLoaded = true;
  }
}

document.getElementById('capture-btn').addEventListener('click', async () => {
  const statusEl = document.getElementById('face-status');
  const video = document.getElementById('video');

  if (!currentStudentId) {
    showStatus(statusEl, 'Please register first.', 'error');
    return;
  }

  showStatus(statusEl, 'Detecting face...', 'info');

  const detection = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) {
    showStatus(statusEl, 'No face detected. Try again with better lighting.', 'error');
    return;
  }

  const faceDescriptor = Array.from(detection.descriptor);

  try {
    const res = await fetch(`/api/students/${currentStudentId}/enroll-face`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ faceDescriptor })
    });
    const data = await res.json();

    if (!res.ok) {
      showStatus(statusEl, data.error || 'Failed to save face', 'error');
      return;
    }

    showStatus(statusEl, 'Face enrolled successfully! You can now mark attendance.', 'success');
  } catch (err) {
    showStatus(statusEl, 'Network error: ' + err.message, 'error');
  }
});
