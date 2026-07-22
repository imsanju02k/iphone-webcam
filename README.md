# 📷 iPhone WebCam for OBS

Use your iPhone as a **wireless HD webcam** in OBS Studio — no cables, no apps, no USB.  
Works over **any network** (WiFi, hotspot, even cellular) using WebRTC peer-to-peer streaming.

## 🌐 Live Demo

> **[Open Control Panel →](https://imsanju02k.github.io/iphone-webcam/)**  
> *(Live GitHub Pages Control Panel)*

---

## ✨ Features

- **1920×1080 HD** streaming (16:9 landscape or 9:16 portrait)
- **Zero lag** WebRTC peer-to-peer — no server relay for video
- **QR code** — scan from iPhone to connect instantly
- **Works anywhere** — same WiFi, different networks, even mobile data
- **No app** — just Safari on iPhone
- **OBS Browser Source** — drop-in webcam replacement

---

## 🚀 Deploy to GitHub Pages (5 minutes)

### Step 1 — Create a GitHub repo

1. Go to [github.com/new](https://github.com/new)
2. Name it `iphone-webcam` (or anything you like)
3. Set it to **Public**
4. Click **Create repository**

### Step 2 — Push this code

```bash
cd iphone-webcam
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/iphone-webcam.git
git push -u origin main
```

### Step 3 — Enable GitHub Pages

1. Go to your repo → **Settings** → **Pages**
2. Under **Source**, select **GitHub Actions**
3. The workflow will auto-deploy — wait ~1 minute

### Step 4 — Open your live URL

```
https://YOUR-USERNAME.github.io/iphone-webcam/
```

That's it! Scan the QR code with your iPhone to start streaming.

---

## 📱 How to Use

| Step | Action |
|------|--------|
| 1 | Open the GitHub Pages URL on your computer |
| 2 | Scan the QR code with iPhone Safari |
| 3 | Tap **Allow** for camera → tap **Start Streaming** |
| 4 | In OBS: Sources → **+** → **Browser** → paste the OBS URL |
| 5 | Set resolution: `1920×1080` (16:9) or `1080×1920` (9:16) |
| 6 | Click OK — your iPhone stream appears in OBS |

---

## 🖥️ Run Locally (optional)

The `public/` folder contains a local Node.js version with WebSockets signaling — useful for low-latency LAN use.

```bash
npm install
npm start
# Open http://localhost:3000
```

> **Note:** Local version requires HTTPS for iPhone camera access.  
> The GitHub Pages version uses HTTPS automatically — no setup needed.

---

## 🔧 Tech Stack

| Component | Technology |
|-----------|-----------|
| Signaling | [PeerJS](https://peerjs.com/) (free cloud) |
| Video | WebRTC `getUserMedia` + `RTCPeerConnection` |
| Hosting | GitHub Pages (static, HTTPS) |
| QR Code | [QRCode.js](https://github.com/davidshimjs/qrcodejs) |
| Local server | Node.js + Socket.io + Express |

---

## 📐 OBS Resolution Settings

| Mode | Width | Height | FPS |
|------|-------|--------|-----|
| 16:9 Landscape | 1920 | 1080 | 30 |
| 9:16 Portrait | 1080 | 1920 | 30 |

---

## ❓ Troubleshooting

**Camera access denied on iPhone?**  
Settings → Safari → Camera → Allow

**Stream not connecting?**  
- Make sure you tapped **Start Streaming** on iPhone
- Both devices need internet (for PeerJS signaling)
- Try refreshing both pages

**OBS shows black screen?**  
- Tick **"Shutdown source when not visible"** in Browser Source settings
- Make sure the viewer URL includes `?s=YOURSESSIONID`

---

MIT License
