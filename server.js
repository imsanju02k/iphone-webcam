const express    = require('express');
const http       = require('http');
const https      = require('https');
const socketIo   = require('socket.io');
const QRCode     = require('qrcode');
const selfsigned = require('selfsigned');
const os         = require('os');
const path       = require('path');

// ── Config ───────────────────────────────────────────────────────────────────
const HTTP_PORT  = 3000;
const HTTPS_PORT = 3443;

function getLocalIP() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

const LOCAL_IP   = getLocalIP();
const HTTP_BASE  = `http://${LOCAL_IP}:${HTTP_PORT}`;
const HTTPS_BASE = `https://${LOCAL_IP}:${HTTPS_PORT}`;

// ── HTTPS cert (required by iOS Safari for getUserMedia) ─────────────────────
const pems = selfsigned.generate(
  [{ name: 'commonName', value: 'iphone-webcam.local' }],
  { days: 365, keySize: 2048, algorithm: 'sha256' }
);

// ── Servers ──────────────────────────────────────────────────────────────────
const app         = express();
const httpServer  = http.createServer(app);
const httpsServer = https.createServer({ key: pems.private, cert: pems.cert }, app);

// Two Socket.io instances — one per server.
// ⚠️  iPhone camera.html connects to HTTPS (3443).
//     Control panel + OBS viewer connect to HTTP (3000).
//     Signaling MUST relay directly via socket object references
//     (socket.emit on a socket from a different io instance works fine!).
const ioSSL  = socketIo(httpsServer, { cors: { origin: '*' } });
const ioHTTP = socketIo(httpServer,  { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ── REST: info + QR ──────────────────────────────────────────────────────────
app.get('/api/info', async (_req, res) => {
  const cameraUrl = `${HTTPS_BASE}/camera.html`;
  const viewerUrl = `${HTTP_BASE}/viewer.html`;
  const qrCode    = await QRCode.toDataURL(cameraUrl, {
    width: 300, margin: 2,
    color: { dark: '#0f172a', light: '#f8fafc' }
  });
  res.json({ localIP: LOCAL_IP, cameraUrl, viewerUrl, qrCode,
             httpPort: HTTP_PORT, httpsPort: HTTPS_PORT });
});

// ── Signaling ─────────────────────────────────────────────────────────────────
// rooms: roomId → { camera: Socket|null, viewers: Map<socketId, Socket> }
//
// KEY DESIGN: all emit() calls use direct socket object references, NOT
// room-based socket.to() routing. This makes it instance-agnostic — a socket
// on ioSSL can freely emit to a socket on ioHTTP and vice versa.
// ──────────────────────────────────────────────────────────────────────────────
const rooms = new Map();

function getRoom(id) {
  if (!rooms.has(id)) rooms.set(id, { camera: null, viewers: new Map() });
  return rooms.get(id);
}

function onConnection(socket) {
  console.log(`[+] ${socket.id}`);

  // ── Camera joins ────────────────────────────────────────────────────────────
  socket.on('camera:join', ({ roomId }) => {
    const room = getRoom(roomId);
    room.camera = socket;
    console.log(`[Camera] ${socket.id} room=${roomId} viewers=${room.viewers.size}`);

    // Tell each waiting viewer the camera is ready; tell camera about each viewer
    room.viewers.forEach((vs, vid) => {
      vs.emit('viewer:camera_ready');
      socket.emit('camera:viewer_joined', { viewerSocketId: vid });
    });
  });

  // ── Viewer joins ─────────────────────────────────────────────────────────────
  socket.on('viewer:join', ({ roomId }) => {
    const room = getRoom(roomId);
    room.viewers.set(socket.id, socket);
    console.log(`[Viewer] ${socket.id} room=${roomId} camera=${!!room.camera}`);

    if (room.camera) {
      // Notify viewer that camera exists, and notify camera about this viewer
      socket.emit('viewer:camera_ready');
      room.camera.emit('camera:viewer_joined', { viewerSocketId: socket.id });
    }
  });

  // ── Camera → specific viewer: SDP offer ──────────────────────────────────────
  socket.on('webrtc:offer', ({ roomId, toViewerId, offer }) => {
    const viewer = rooms.get(roomId)?.viewers.get(toViewerId);
    if (viewer) {
      console.log(`[SDP Offer] camera→${toViewerId}`);
      viewer.emit('webrtc:offer', { offer, fromCameraId: socket.id });
    }
  });

  // ── Viewer → camera: SDP answer ──────────────────────────────────────────────
  socket.on('webrtc:answer', ({ roomId, answer }) => {
    const cam = rooms.get(roomId)?.camera;
    if (cam) {
      console.log(`[SDP Answer] ${socket.id}→camera`);
      cam.emit('webrtc:answer', { answer, fromViewerId: socket.id });
    }
  });

  // ── ICE candidates: route to specific target socket ──────────────────────────
  socket.on('webrtc:ice', ({ roomId, toId, candidate }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    if (room.camera?.id === toId) {
      room.camera.emit('webrtc:ice', { candidate, fromId: socket.id });
    } else {
      room.viewers.get(toId)?.emit('webrtc:ice', { candidate, fromId: socket.id });
    }
  });

  // ── Disconnect cleanup ────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[-] ${socket.id}`);
    for (const [roomId, room] of rooms.entries()) {
      if (room.camera?.id === socket.id) {
        room.viewers.forEach(v => v.emit('peer:disconnected'));
        room.camera = null;
        if (!room.viewers.size) rooms.delete(roomId);
        return;
      }
      if (room.viewers.has(socket.id)) {
        room.viewers.delete(socket.id);
        room.camera?.emit('viewer:left', { viewerSocketId: socket.id });
        if (!room.camera && !room.viewers.size) rooms.delete(roomId);
        return;
      }
    }
  });
}

ioSSL.on('connection',  onConnection);
ioHTTP.on('connection', onConnection);

// ── Start ─────────────────────────────────────────────────────────────────────
httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
  httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║          📷  iPhone WebCam for OBS — 4K Mode          ║');
    console.log('╠══════════════════════════════════════════════════════╣');
    console.log(`║  Control Panel  →  http://localhost:${HTTP_PORT}                ║`);
    console.log(`║  iPhone (HTTPS) →  ${HTTPS_BASE}/camera.html  ║`);
    console.log(`║  OBS Viewer     →  ${HTTP_BASE}/viewer.html   ║`);
    console.log('╠══════════════════════════════════════════════════════╣');
    console.log('║  iPhone: tap "Advanced → Visit Website" on cert warn   ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');
  });
});
