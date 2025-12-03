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

## Roadmap / TODO

- Implement MusicBrainz metadata matching, playback history tracking, recommendations, and PIX donation QR.
- Add cron-based seed retention cleanup (90 days).
- Flesh out landing/login flows accessible outside PWA mode.
- Harden OPFS progress indicators and upload API progress callbacks.
