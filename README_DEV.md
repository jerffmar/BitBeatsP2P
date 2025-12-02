# BitBeats Monolith – Developer Guide

## 1. Project Overview
Hybrid P2P Music Streaming Monolith that combines a Node.js/Express API, Prisma + SQLite persistence, WebTorrent-powered seeding, and a React/Vite front-end in a single repository.

![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white)
![WebTorrent](https://img.shields.io/badge/WebTorrent-Hybrid-FF2E63)

## 2. Prerequisites
- **Node.js v18 or v20** (required for `webtorrent-hybrid` and modern Vite features)
- **Git**
- **Native build toolchain** for `node-gyp` (Python 3, `make`, `g++`/MSVC). `webtorrent-hybrid` pulls native dependencies that compile during install.

## 3. Installation (Step-by-Step)
```bash
# 1. Clone the repository
git clone <your-fork-or-clone-url> bitbeats
cd bitbeats

# 2. Install all dependencies (root + client)
npm run install-all
```
The custom `install-all` script first installs root packages, then installs the Vite client dependencies under `./client`.

**node-gyp Troubleshooting**
- Linux: `sudo apt install build-essential python3 make g++`
- macOS: `xcode-select --install`
- Windows: Install “Windows Build Tools” (`npm install --global --production windows-build-tools`) or run `npm config set msvs_version 2022`.
Re-run `npm run install-all` after build tools are available.

## 4. Database Setup
```bash
# Apply initial schema
npx prisma migrate dev --name init

# Optional: inspect/edit data
npx prisma studio
```
The SQLite file (`prisma/dev.db`) is generated automatically. `prisma studio` provides a GUI to browse Users, Tracks, and History records.

## 5. Running the App
### Development Mode
Use separate terminals so hot-reloads stay fast.

**Terminal A – Backend + WebTorrent**
```bash
npx ts-node src/server.ts
# (Install ts-node globally or add it as a devDependency if not present.)
```

**Terminal B – Frontend (Vite Dev Server)**
```bash
cd client
npm run dev
```
Vite proxies `/api` requests to `http://localhost:3000`, so uploads/streams work without extra config.

### Production Mode
```bash
# 1. Build Prisma client + React bundle
npm run build

# 2. Launch the server (serves API + static client)
npm start
```
`npm start` runs `node dist/server.js`, which exposes Express APIs, `/uploads` web seeds, and the React build from `client/dist`.

## 6. PWA & Mobile Testing
- Service Workers, WebTorrent’s browser features, and OPFS require **HTTPS or localhost**.
- For on-device testing, keep `localhost` (Android Chrome treats it as secure) or tunnel via tools like `ngrok`, `Cloudflare Tunnel`, or `localtunnel` to provide a secure context over HTTPS.
- Ensure the tunnel forwards port 3000 so both the API and bundled React app remain reachable.
