// js/student.js
const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

let currentStudent = null;
let scannedSessionId = null;
let scannedToken = null;
let html5QrCode = null;
let modelsLoaded = false;

function showStatus(el, message, type) {
  el.textContent = message;
  el.className = `status show ${type}`;
}

document.getElementById('login-btn').addEventListener('click', async () => {
  const rollNo = document.getElementById('rollNo').value.trim();
  const pin = document.getElementById('pin').value.trim();
  const statusEl = document.getElementById('login-status');

  try {
    const res = await fetch('/api/students/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rollNo, pin })
    });
    const data = await res.json();

    if (!res.ok) {
      showStatus(statusEl, data.error || 'Login failed', 'error');
      return;
    }

    currentStudent = data.student;
    showStatus(statusEl, `Welcome, ${currentStudent.name}!`, 'success');
    document.getElementById('scan-card').style.display = 'block';
    startQRScanner();
  } catch (err) {
    showStatus(statusEl, 'Network error: ' + err.message, 'error');
  }
});

function startQRScanner() {
  html5QrCode = new Html5Qrcode('qr-reader');
  const statusEl = document.getElementById('scan-status');

  html5QrCode
    .start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: 220 },
      async (decodedText) => {
        try {
          const payload = JSON.parse(decodedText);
          scannedSessionId = payload.sessionId;
          scannedToken = payload.token;

          await html5QrCode.stop();
          showStatus(statusEl, 'QR code scanned! Proceed to face verification.', 'success');
          document.getElementById('face-card').style.display = 'block';
          await startCamera();
        } catch (e) {
          showStatus(statusEl, 'Invalid QR code format.', 'error');
        }
      },
      () => {
        // ignore per-frame scan failures (happens continuously while searching for a code)
      }
    )
    .catch((err) => {
      showStatus(statusEl, 'Camera error: ' + err, 'error');
    });
}

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

document.getElementById('verify-btn').addEventListener('click', async () => {
  const statusEl = document.getElementById('face-status');
  const video = document.getElementById('video');

  if (!currentStudent || !scannedSessionId || !scannedToken) {
    showStatus(statusEl, 'Please complete login and QR scan first.', 'error');
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

  showStatus(statusEl, 'Getting your location...', 'info');

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const faceDescriptor = Array.from(detection.descriptor);

      try {
        const res = await fetch('/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: scannedSessionId,
            studentId: currentStudent.id,
            token: scannedToken,
            faceDescriptor,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          })
        });
        const data = await res.json();

        if (!res.ok) {
          showStatus(statusEl, `Rejected: ${data.error}`, 'error');
          return;
        }

        showStatus(statusEl, 'Attendance marked successfully! ✅', 'success');
      } catch (err) {
        showStatus(statusEl, 'Network error: ' + err.message, 'error');
      }
    },
    (err) => showStatus(statusEl, 'Location error: ' + err.message, 'error'),
    { enableHighAccuracy: true }
  );
});
