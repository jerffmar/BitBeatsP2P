# Copilot Instructions for BitBeatsP2P

These notes help an AI coding agent quickly become productive in this repository. Focus on concrete, discoverable patterns, commands, and integration points rather than general advice.

1. Big-picture architecture
- **Monolith**: single Node process serves API + static React PWA. Server entry: `client/src/server.ts`.
- **Torrent core**: server seeds uploads using `webtorrent-hybrid` (`client/src/services/SeedService.ts`). Clients use `webtorrent` in the browser (`client/package.json` / `client/src/services/torrent.ts`).
- **Storage & DB**: files stored on disk via `DiskManager` (`client/src/services/DiskManager.ts`), metadata in SQLite through Prisma (`prisma/schema.prisma`, `client/src/services/prisma.server.ts`).
- **WebSeed fallback**: server exposes HTTP Range endpoint at `/api/stream/:trackId` implemented in `client/src/services/TrackController.ts` — SeedService injects that URL as a WebSeed.

2. Key developer workflows (commands)
- Install (root): `npm install` — runs `client:install` and `npx prisma generate` via `postinstall`.
- Dev server (backend + hot reload): `npm run dev` (uses `ts-node-dev` to run `client/src/server.ts`).
- Client dev: `cd client && npm run dev` (Vite).
- Build client: `npm run client:build` (root script calls `scripts/client-build.cjs`).
- Start production-ish server: `npm start` (runs `tsx server.ts`).
- Prisma: `npm run db:migrate` and `npm run db:seed`.

3. Project-specific patterns and conventions
- Files are uploaded via Multer to `temp_uploads/` then moved to permanent storage with `DiskManager.saveFile(userId, tempPath, originalName)`.
- Deduplication: server computes SHA-256 for uploaded file and compares to sidecar `.sha256` files next to stored tracks (see `computeFileSHA256` and sidecar write logic in `TrackController`).
- Sizes/use of BigInt: DB `size` columns use BigInt; code calls `.toString()` when serializing for APIs (see `listTracks`).
- Hardcoded/demo behavior: `TrackController` currently uses `userId = 1` for uploads — treat as a known TODO when adding auth enforcement.
- Auto-migration: server attempts a simple auto-repair (`prisma db push`) if it detects a missing schema (see `ensureDatabaseSchema` in `client/src/server.ts`).

4. Integration & platform notes
- `webtorrent-hybrid` has native build dependencies; production deploys install `build-essential`, `python3`, `g++` (see `deploy.sh`). On Windows/WSL ensure build toolchain is available when installing native modules.
- Server serves static files from `client/dist` (set by `clientDistPath` in `client/src/server.ts`). Ensure you run `npm run client:build` before `npm start` in production.
- The MusicBrainz proxy exists at `/api/musicbrainz` (server-side fetch with `User-Agent` header). Use this instead of calling MusicBrainz directly from the browser to avoid CORS.

5. Files & locations to inspect for implementing features
- Server entry: `client/src/server.ts` (routes, CORS, static serving)
- Upload & streaming: `client/src/services/TrackController.ts` (Multer, Range 206 support)
- Seeding: `client/src/services/SeedService.ts` (webtorrent-hybrid singleton)
- Disk management: `client/src/services/DiskManager.ts` (quota checks, save/delete)
- Client PWA & playback: `client/src/services/torrent.ts`, `client/src/services/useTorrentPlayer.ts`, `client/src/services/OPFSManager.ts` (OPFS vault)
- DB: `prisma/schema.prisma`, `client/src/services/prisma.server.ts`

8. Audio fingerprinting note
- The project uses a JS-based fingerprint implemented in `client/src/services/audioEngine.ts` for local deduplication and basic identification. It's fast and runs in-browser (Web Audio API -> compact fingerprint -> SHA-256) and is sufficient for dedupe sidecars and client-side matching.
- For acoustical fingerprint compatibility (Chromaprint/AcoustID) or wider interoperability, integrate `ffmpeg-wasm` + Chromaprint client-side or perform server-side fingerprinting (run ffmpeg + Chromaprint on a worker or sidecar service) and store Chromaprint hashes in the `Track` metadata.
- Practical guidance: prefer the JS fingerprint for UX flows (instant dedupe) and use server-side Chromaprint for canonical cross-site matching or public identification features.

6. Common troubleshooting hints (concrete)
- If Prisma complains about missing models, server will try `prisma db push`; run `npm run db:migrate` locally if that fails.
- If `webtorrent-hybrid` install fails, install native build tools or run in WSL/Ubuntu like the `deploy.sh` environment.
- If client static bundle 404s occur, ensure `client/dist` exists (`npm run client:build`).

7. Priorities for contributors / agents
- Preserve dedupe + sidecar behavior when changing upload flow (these avoid repeated storage).
- When modifying torrent seeding, respect that `SeedService.startSeeding` returns `{ magnetURI, webSeedUrl }` used to update DB.
- Keep Range support in `stream/:trackId` intact — clients and webseed consumers depend on 206 semantics.

If anything here is unclear or you want this adapted for a specific automation (e.g., GitHub Actions, code-gen rules, or a stricter security checklist), tell me which area to expand and I'll iterate.
