# BitBeats Monolith

BitBeats is a decentralized hybrid P2P music platform where the Node.js backend both seeds uploaded tracks via `webtorrent-hybrid` and serves the React PWA frontend. Browsers consume torrents with WebRTC and fall back to HTTP range streams while optionally storing tracks in OPFS (“The Vault”) for offline playback.

## Architecture at a Glance

| Layer        | Stack / Files                                                                                           | Highlights                                                                                                 |
|--------------|----------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------|
| Runtime      | Node.js 20 + Express (`src/server.ts`)                                                                   | Single process serves API + static assets                                                                  |
| Database     | SQLite via Prisma (`prisma/schema.prisma`, `src/db.ts`)                                                  | Models: User, Track, Genre, PlaybackHistory, Artist, Album                                                 |
| Storage      | Local FS uploads (`src/services/DiskManager.ts`)                                                         | 10 GB quota per user, BigInt accounting                                                                    |
| Torrent Core | `webtorrent-hybrid` seeding (`src/services/SeedService.ts`) & browser `webtorrent` hook (`client/src/...`) | Server seeds + WebSeed fallback (`/api/stream/:trackId`), client monitors peers/speeds                     |
| Frontend     | React + Vite + Tailwind (`client/`)                                                                      | PWA enforcement via `InstallGate`, dashboards, discovery, upload flows                                     |
| Offline      | OPFS Vault (`client/src/services/OPFSManager.ts`)                                                        | Download-to-vault & replay without bandwidth                                                               |
| Deployment   | Bare-metal bash (`deploy.sh`)                                                                            | Swap, Node 20, PM2, Prisma migrate, React build, Nginx reverse proxy w/ self-signed TLS                    |

## Repository Layout

```
src/
  controllers/TrackController.ts   # Upload + HTTP streaming with Range support
  services/
    DiskManager.ts
    SeedService.ts
  db.ts                            # Prisma client
client/
  src/
    App.tsx, pages/, hooks/, services/
    components/InstallGate.tsx
  vite.config.ts                   # Node polyfills + PWA plugin + proxy
deploy.sh                          # Ubuntu 24.04 provisioning & PM2 bootstrapping
prisma/schema.prisma               # SQLite data model
```

## Prerequisites

- Node.js 20.x (server + tooling)
- npm 10+
- SQLite (bundled)
- Ubuntu 24.04 Minimal for production deployments with sudo privileges
- Nginx (configured by `deploy.sh`)

## Environment Variables (`.env`)

```
DATABASE_URL="file:./prod.db"
UPLOAD_DIR="./uploads"
MAX_USER_QUOTA_GB=10
SEED_RETENTION_DAYS=90
PORT=3000
```

## Installation & Scripts

```bash
npm install                 # Installs root + triggers client install + Prisma generate
npm run client:install      # (via postinstall) installs client deps
npm run client:build        # Builds React bundle
npm run dev                 # ts-node-dev server (API + static serving)
npm start                   # ts-node server (prod-ish)
npm run db:migrate          # prisma migrate dev --name init
npm run db:seed             # executes prisma/seed.ts (if present)
```

Client-only workflow:

```bash
cd client
npm run dev
npm run build
```

## Backend Highlights

- `TrackController`:
  - Multer file uploads (`POST /api/upload`)
  - Quota enforcement via `DiskManager.checkQuota`
  - Seeds via `SeedService.startSeeding` and persists `magnetURI` + `webSeedUrl`
  - `GET /api/stream/:trackId` supports HTTP 206 Range for WebSeed fallback
- `SeedService`:
  - Singleton `webtorrent-hybrid` client
  - Adds HTTP WebSeed URL (e.g., `http://HOST:PORT/api/stream/:id`) into torrent metadata
- `DiskManager`:
  - Ensures upload directory
  - Moves temp files to permanent path + updates Prisma storage usage
  - Handles deletions and quota calculations with `BigInt`

## Frontend Highlights

- PWA gatekeeping (`InstallGate`) restricts player UI unless `display-mode: standalone`.
- `useTorrentPlayer` hook (two variants) handles torrent playback stats, buffering, and error reporting.
- UI pages:
  - `LibraryDashboard` with quota bar + quad widgets
  - `Discovery` carousel placeholders
  - `Upload` flow with drag/drop, progress, and API integration
- `OPFSManager` wraps Origin Private File System for offline vault storage.

## Deployment (Bare Metal)

1. Copy repo to Ubuntu 24.04 Minimal VPS and run:

   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```

2. Script actions:
   - Updates apt, installs build essentials, Node 20, PM2, Nginx, Certbot
   - Creates 2 GB swapfile
   - Installs project deps, ensures `dotenv`, builds client, runs Prisma migrate
   - Configures Nginx reverse proxy with self-signed cert targeting `127.0.0.1:3000`
   - Boots app via PM2 using local `tsx`, sets startup, and performs health check
   - Prints PM2 status/log commands scoped to the real user

3. Access via `https://<SERVER_IP>/` (accept self-signed cert) or update DNS + certificates manually.

## Troubleshooting

- **Prisma issues:** delete `node_modules`, rerun `npm install`, `npx prisma generate`.
- **Torrent deps:** ensure `build-essential`, `python3`, `make`, `g++` installed (handled in deploy script).
- **Missing modules (case-sensitive FS):** `deploy.sh` creates symlinks to reconcile Windows/macOS vs Linux casing.
- **PM2 env vars:** HOST/PORT injected via `env` when starting the process—verify with `pm2 show bitbeats`.

## Pending Mock Implementations (current status)

- `analyzeAudio(file)` — client/src/services/audioEngine.ts
  - Status: IMPLEMENTED. The client now decodes audio via the Web Audio API (AudioContext), mixes to mono, computes a compact perceptual fingerprint (windowed RMS + small DFT magnitudes), hashes it (SHA-256) and returns a WAV ArrayBuffer plus duration and fingerprint.
  - Notes: This is a JS-based fingerprint that is robust for local deduplication and initial identification. For acoustical fingerprint compatibility (e.g., Chromaprint/AcoustID) integrate ffmpeg-wasm + Chromaprint or run server-side fingerprinting.

- `normalizeAndTranscode(buffer)` — client/src/services/audioEngine.ts
  - Status: IMPLEMENTED. Uses Web Audio to decode, resample to a target sample rate, normalize peaks, and emit a WAV ArrayBuffer suitable for seeding/playback.
  - Next steps: Optionally move heavy transcoding to a server-side ffmpeg worker for large files or battery-constrained clients.

- `signUpload(file, fingerprint)` — client/src/services/p2pNetwork.ts + client/src/services/auth.ts
  - Status: PARTIALLY IMPLEMENTED on client. A WebCrypto-based ECDSA keypair is generated/persisted and signUpload produces a signed payload. Server-side verification / identity management is not implemented.
  - Next steps: implement server-side signature verification and associate identity keys to User records (Prisma), or integrate a PKI/identity service.

- `connectToPeer / sendMessage / discoverLocalPeers` — client/src/services/p2pNetwork.ts
  - Status: PARTIALLY IMPLEMENTED FOR DEMO. Local BroadcastChannel-based signaling exists for same-origin demos; discoverLocalPeers delegates to client torrent service. Real WebRTC signaling / STUN/TURN and cross-client discovery are not implemented.
  - Next steps: add a signaling channel (WebSocket or peer server) and integrate proper peer discovery and NAT traversal (STUN/TURN).

- `saveToVault / loadFromVault / getStoredBytes` — client/src/services/storage.ts
  - Status: PARTIALLY IMPLEMENTED. OPFS/File System Access API path attempted with fallback to base64 localStorage. Works in browsers without full OPFS support but not optimized for large files or streaming.
  - Next steps: implement streaming writes/reads to OPFS (WritableStream), add eviction policy hooks, and avoid base64 fallback for large media.

- `initTorrentClient / seedFile / addTorrent` — client/src/services/torrent.ts
  - Status: STILL A MOCK / ENV-SENSITIVE. App handles failures and falls back to blob playback; server-side seeding is implemented via webtorrent-hybrid (SeedService) but client torrent logic may be a stub or fragile across browsers.
  - Next steps: provide a robust browser `webtorrent` client bundle (polyfills), validate `bittorrent-dht` shim behavior, and add graceful feature-detection to enable/disable DHT/WebRTC features.

- `publishTrackMetadata` & realtime helpers — client/src/services/db.ts
  - Status: PARTIALLY IMPLEMENTED. publishTrackMetadata attempts to POST to backend and falls back to a local in-memory store persisted to localStorage; server endpoints exist but full realtime plumbing (SSE/WebSocket) and persisted metadata indexing are incomplete.
  - Next steps: add server endpoints for ingesting metadata, persist metadata in Prisma (Track fields), and implement a realtime broadcast (SSE or WebSocket) for clients.

- Server-side deduplication / hashing
  - Status: IMPLEMENTED. TrackController now computes SHA-256 for uploads, checks size-based candidates and .sha256 sidecars, and avoids duplicate saves/seeding when matches exist.

- Server-side seeding (SeedService) and HTTP Range stream endpoint
  - Status: IMPLEMENTED (basic). SeedService integrates webtorrent-hybrid and TrackController provides /api/stream/:trackId with 206 support. Verify production robustness, error handling, and retention/cron behavior.

- Quota & DiskManager
  - Status: IMPLEMENTED (basic). DiskManager quota checks used during upload; BigInt accounting in DB is used. Verify cross-platform paths and permission edge cases.
