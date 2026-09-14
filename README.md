# QR-Based Attendance Register (with Face Recognition + Location Check)

A college-project-ready web app that marks student attendance only when **three checks all pass**:

1. **QR code check** — a unique, rotating QR is displayed per subject session (regenerates every 10–60s so a screenshot can't be reused by the whole class).
2. **Face recognition check** — the scanning student's live face is compared against their enrolled face (stops one student marking attendance for another).
3. **Location check** — the student's GPS must be within a configurable radius (e.g. 50m) of the classroom (stops remote/proxy scanning from outside).

Attendance is only marked **present** if all three pass; otherwise it's logged as **rejected** with a reason.

## Tech Stack
- **Backend**: Node.js + Express, `lowdb` (a JSON-file database — no MySQL/MongoDB install needed, perfect for a demo/viva)
- **Frontend**: Plain HTML/CSS/JS (no build step, no npm needed for the frontend)
- **QR generation**: `qrcode` (client-side, via CDN)
- **QR scanning**: `html5-qrcode` (via CDN)
- **Face recognition**: `face-api.js` (via CDN) — runs entirely in the browser using the device camera

## Project Structure
```
qr-attendance-system/
├── backend/
│   ├── server.js          # Express app entry point
│   ├── db.js               # lowdb setup (data.json created automatically)
│   ├── routes/
│   │   ├── students.js     # register / login / enroll face
│   │   ├── sessions.js     # create session, rotate QR token, end session
│   │   └── attendance.js   # the core QR+face+location verification logic
│   ├── utils/
│   │   ├── geo.js          # haversine distance calculation
│   │   └── faceMatch.js    # face descriptor comparison
│   └── package.json
└── public/                 # served as static files by Express
    ├── index.html           # role selection (teacher / student)
    ├── enroll.html          # student registration + face enrollment
    ├── teacher.html         # teacher dashboard: start session, show QR, live attendance
    ├── student.html         # student flow: login -> scan QR -> verify face
    ├── css/style.css
    └── js/{enroll,teacher,student}.js
```

## How to Run

1. **Install Node.js** (v16+) if you don't have it: https://nodejs.org

2. **Install backend dependencies**:
   ```bash
   cd qr-attendance-system/backend
   npm install
   ```

3. **Start the server**:
   ```bash
   npm start
   ```
   You should see: `QR Attendance server running at http://localhost:3000`

4. **Open the app**: go to `http://localhost:3000` in a browser.
   - Because camera + geolocation require a "secure context", `localhost` works fine for local demos.
   - To demo across multiple phones (teacher's laptop + students' phones on the same WiFi), you'll need HTTPS — easiest way is a free tunnel like `ngrok http 3000`, which gives you an `https://` URL that works with camera/GPS permissions on any device.

## Demo Flow (for your viva/presentation)

1. **Student enrolls once**: open `enroll.html` → register (name, roll no, PIN) → capture face.
2. **Teacher starts a session**: open `teacher.html` → enter subject → tap "Set Current Location as Classroom" (stand in the classroom when you do this) → Start Session. A QR code appears and refreshes automatically.
3. **Student marks attendance**: open `student.html` on their phone → log in with roll no + PIN → scan the projected QR → look at camera to verify face → attendance marked (or rejected with a reason).
4. **Teacher sees live results** in the attendance table, and can export as CSV.

## Why This Prevents Proxy Attendance
| Bypass attempt | Blocked by |
|---|---|
| Photo of QR shared in a group chat | QR token expires and rotates every 10–60s |
| Friend scans QR on your behalf | Face recognition won't match your enrolled photo |
| Scanning QR remotely / from outside | GPS distance check rejects it if outside the radius |

## Notes for Your Report
- Face descriptors are 128-dimensional vectors produced by `face-api.js`'s FaceRecognitionNet (based on a ResNet architecture trained for face embeddings). Two faces are considered a match if their Euclidean distance is below `0.6` (tunable in `backend/utils/faceMatch.js`).
- Classroom location is captured once per session using the browser's Geolocation API; distance to student is computed using the Haversine formula (`backend/utils/geo.js`).
- The database (`backend/data.json`) is a flat JSON file for simplicity — swap in MongoDB/PostgreSQL if you want to extend this into a production system.

## Possible Extensions (good "future scope" section for your report)
- SMS/email notification to parents on absence
- Admin panel with attendance analytics and defaulter lists per subject
- Liveness detection (blink detection) to stop someone using a printed photo instead of their real face
- Wi-Fi BSSID matching in addition to GPS for more precise indoor location verification
