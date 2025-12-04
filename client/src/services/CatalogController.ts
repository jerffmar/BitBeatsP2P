import express, { Request, Response, Router } from 'express';
import prisma from './prisma.server';

const router: Router = express.Router();
const MB_BASE = 'https://musicbrainz.org/ws/2';
const COVER_ARCHIVE = (id: string) => `https://coverartarchive.org/release/${id}/front`;
const COVER_PLACEHOLDER = 'https://images.unsplash.com/photo-1511376777868-611b54f68947?auto=format&fit=crop&w=400&q=60';

// Added: simple in-memory cache for MusicBrainz responses (TTL + max entries)
const MB_CACHE_TTL_MS = Number(process.env.MB_CACHE_TTL_MS ?? 1000 * 60 * 60 * 24); // default 24h
const MB_CACHE_MAX = Number(process.env.MB_CACHE_MAX ?? 1000);

type CacheEntry = { expires: number; value: any };
const mbCache = new Map<string, CacheEntry>();

const getFromCache = (key: string) => {
  const e = mbCache.get(key);
  if (!e) return null;
  if (Date.now() > e.expires) {
    mbCache.delete(key);
    return null;
  }
  return e.value;
};

const setCache = (key: string, value: any) => {
  // purge if over capacity (remove oldest insertion)
  if (mbCache.size >= MB_CACHE_MAX) {
    const firstKey = mbCache.keys().next().value;
    if (firstKey) mbCache.delete(firstKey);
  }
  mbCache.set(key, { expires: Date.now() + MB_CACHE_TTL_MS, value });
};

// Replace fetchJSON with cache-aware version
const fetchJSON = async (url: string) => {
  try {
    const cacheKey = `mb:${url}`;
    const cached = getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    const resp = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'BitBeats/1.0' } });
    if (!resp.ok) {
      console.warn(`Upstream MB returned ${resp.status} for ${url}`);
      return null;
    }
    const json = await resp.json();
    // store a shallow clone to avoid accidental mutations
    setCache(cacheKey, JSON.parse(JSON.stringify(json)));
    return json;
  } catch (err) {
    console.warn('fetchJSON network/error:', err);
    return null;
  }
};

const normalizeArtist = (record: any) => ({
  mbid: record.mbid ?? record.id,
  title: record.name,
  artist: record.name,
  coverUrl: COVER_PLACEHOLDER,
});

const normalizeRelease = (r: any) => ({
  mbid: r.id,
  title: r.title,
  artist: Array.isArray(r['artist-credit']) ? r['artist-credit'].map((a: any) => a.name || a.artist?.name).join(', ') : undefined,
  coverUrl: (r['cover-art-archive']?.front ? COVER_ARCHIVE(r.id) : undefined) ?? COVER_PLACEHOLDER,
  date: r.date,
});

const normalizeRecording = (rec: any) => ({
  mbid: rec.id,
  title: rec.title,
  artist: Array.isArray(rec['artist-credit']) ? rec['artist-credit'].map((a: any) => a.name || a.artist?.name).join(', ') : undefined,
  coverUrl: (rec.releases && rec.releases[0] && rec.releases[0]['cover-art-archive']?.front) ? COVER_ARCHIVE(rec.releases[0].id) : COVER_PLACEHOLDER,
});

// GET /search?q=&type=ALL|SONG|ALBUM|ARTIST&offset=&limit=
router.get('/search', async (req: Request, res: Response) => {
  const q = String(req.query.q || '').trim();
  const type = String(req.query.type || 'ALL').toUpperCase();
  const offset = Number(req.query.offset || 0);
  const limit = Math.min(40, Number(req.query.limit || 8));

  if (!q) return res.json({ songs: [], albums: [], artists: [] });

  try {
    const out = { songs: [] as any[], albums: [] as any[], artists: [] as any[] };

    // DB-first artist search
    if (type === 'ALL' || type === 'ARTIST') {
      const dbArtists = await prisma.mbArtist.findMany({
        where: { name: { contains: q, mode: 'insensitive' } },
        skip: offset,
        take: limit,
        orderBy: { fetchedAt: 'desc' },
      });
      if (dbArtists.length) {
        out.artists = dbArtists.map((a) => {
          let parsedData = undefined;
          try { parsedData = a.data ? JSON.parse(a.data) : undefined; } catch { parsedData = a.data; }
          return { mbid: a.mbid, title: a.name, artist: a.name, coverUrl: COVER_PLACEHOLDER, data: parsedData };
        });
      } else {
        // fallback to MusicBrainz (best-effort)
        const mb = await fetchJSON(`${MB_BASE}/artist?query=${encodeURIComponent(q)}&fmt=json&limit=${limit}`);
        if (mb?.artists) {
          out.artists = mb.artists.map(normalizeArtist);
          // persist fetched artists (serialize payload)
          for (const a of mb.artists) {
            try {
              await prisma.mbArtist.upsert({
                where: { mbid: a.id },
                update: { name: a.name, data: JSON.stringify(a) },
                create: { mbid: a.id, name: a.name, data: JSON.stringify(a) },
              });
            } catch (e) { /* ignore persistence errors */ }
          }
        }
      }
    }

    // DB-first album search
    if (type === 'ALL' || type === 'ALBUM') {
      const dbReleases = await prisma.mbRelease.findMany({
        where: { title: { contains: q, mode: 'insensitive' } },
        skip: offset,
        take: limit,
        orderBy: { fetchedAt: 'desc' },
      });
      if (dbReleases.length) {
        out.albums = dbReleases.map((r) => {
          let parsedData = undefined;
          try { parsedData = r.data ? JSON.parse(r.data) : undefined; } catch { parsedData = r.data; }
          return { mbid: r.mbid, title: r.title, artist: undefined, coverUrl: r.coverUrl ?? COVER_PLACEHOLDER, date: r.date, data: parsedData };
        });
      } else {
        const mb = await fetchJSON(`${MB_BASE}/release?query=${encodeURIComponent(q)}&fmt=json&limit=${limit}`);
        if (mb?.releases) {
          out.albums = mb.releases.map(normalizeRelease);
          for (const r of mb.releases) {
            try {
              await prisma.mbRelease.upsert({
                where: { mbid: r.id },
                update: { title: r.title, date: r.date, data: JSON.stringify(r) },
                create: { mbid: r.id, title: r.title, date: r.date, data: JSON.stringify(r) },
              });
            } catch (e) { /* ignore persistence errors */ }
          }
        }
      }
    }

    // DB-first recording/song search
    if (type === 'ALL' || type === 'SONG') {
      const dbRecords = await prisma.mbRecording.findMany({
        where: { title: { contains: q, mode: 'insensitive' } },
        skip: offset,
        take: limit,
        orderBy: { fetchedAt: 'desc' },
      });
      if (dbRecords.length) {
        out.songs = dbRecords.map((r) => {
          let parsedData = undefined;
          try { parsedData = r.data ? JSON.parse(r.data) : undefined; } catch { parsedData = r.data; }
          return { mbid: r.mbid, title: r.title, artist: r.artistCredit, coverUrl: COVER_PLACEHOLDER, data: parsedData };
        });
      } else {
        const mb = await fetchJSON(`${MB_BASE}/recording?query=${encodeURIComponent(q)}&fmt=json&limit=${limit}&inc=artist-credits+releases`);
        if (mb?.recordings) {
          out.songs = mb.recordings.map(normalizeRecording);
          for (const rec of mb.recordings) {
            try {
              await prisma.mbRecording.upsert({
                where: { mbid: rec.id },
                update: { title: rec.title, artistCredit: Array.isArray(rec['artist-credit']) ? rec['artist-credit'].map((a: any)=>a.name||a.artist?.name).join(', ') : undefined, data: JSON.stringify(rec) },
                create: { mbid: rec.id, title: rec.title, artistCredit: Array.isArray(rec['artist-credit']) ? rec['artist-credit'].map((a: any)=>a.name||a.artist?.name).join(', ') : undefined, data: JSON.stringify(rec) },
              });
            } catch (e) { /* ignore persistence errors */ }
          }
        }
      }
    }

    return res.json(out);
  } catch (err: any) {
    console.error('Catalog search error (unexpected):', err);
    // degrade gracefully: return empty lists instead of 502 so UI can continue to function
    return res.json({ songs: [], albums: [], artists: [] });
  }
});

// GET /artist/:mbid
router.get('/artist/:mbid', async (req: Request, res: Response) => {
  const mbid = String(req.params.mbid || '');
  if (!mbid) return res.status(400).json({ error: 'missing mbid' });
  try {
    const cached = await prisma.mbArtist.findUnique({ where: { mbid } });
    if (cached) {
      let parsed = undefined;
      try { parsed = cached.data ? JSON.parse(cached.data) : undefined; } catch { parsed = cached.data; }
      return res.json({ mbid: cached.mbid, name: cached.name, bio: cached.bio, data: parsed });
    }

    const data = await fetchJSON(`${MB_BASE}/artist/${mbid}?fmt=json&inc=url-rels+release-groups+releases`);
    if (!data) {
      // no cached and upstream failed -> respond 404 to let client fallback to other strategies
      return res.status(404).json({ error: 'Artist not found or upstream unavailable' });
    }

    let bio: string | undefined;
    const wikiRel = (data.relations || []).find((r: any) => r.type?.toLowerCase().includes('wikipedia') || (r.url && r.url.resource && String(r.url.resource).includes('wikipedia.org')));
    if (wikiRel?.url?.resource) {
      try {
        const url = new URL(wikiRel.url.resource);
        const title = decodeURIComponent(url.pathname.replace(/^\/wiki\//, ''));
        const wp = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
        if (wp.ok) {
          const j = await wp.json();
          bio = j.extract;
        }
      } catch {}
    }

    // persist as string (SQLite-friendly)
    try {
      await prisma.mbArtist.create({ data: { mbid: data.id, name: data.name, sortName: data['sort-name'], country: data.country, bio, data: JSON.stringify(data) } });
    } catch (e) { /* ignore persistence errors */ }

    return res.json({ mbid: data.id, name: data.name, bio, data });
  } catch (err) {
    console.error('Artist fetch error (unexpected):', err);
    return res.status(500).json({ error: 'Artist fetch failed' });
  }
});

// GET /release/:mbid
router.get('/release/:mbid', async (req: Request, res: Response) => {
  const mbid = String(req.params.mbid || '');
  if (!mbid) return res.status(400).json({ error: 'missing mbid' });
  try {
    const cached = await prisma.mbRelease.findUnique({ where: { mbid } });
    if (cached) {
      let parsed = undefined;
      try { parsed = cached.data ? JSON.parse(cached.data) : undefined; } catch { parsed = cached.data; }
      return res.json({ mbid: cached.mbid, title: cached.title, date: cached.date, coverUrl: cached.coverUrl, data: parsed });
    }

    const data = await fetchJSON(`${MB_BASE}/release/${mbid}?fmt=json&inc=recordings+artist-credits`);
    if (!data) {
      return res.status(404).json({ error: 'Release not found or upstream unavailable' });
    }

    const cover = data.id ? COVER_ARCHIVE(data.id) : undefined;
    try {
      await prisma.mbRelease.create({ data: { mbid: data.id, title: data.title, date: data.date, status: data.status, coverUrl: cover, data: JSON.stringify(data) } });
    } catch (e) { /* ignore persistence errors */ }

    return res.json({ mbid: data.id, title: data.title, date: data.date, status: data.status, coverUrl: cover, data });
  } catch (err) {
    console.error('Release fetch error (unexpected):', err);
    return res.status(500).json({ error: 'Release fetch failed' });
  }
});

export const CatalogController = { router };
export default router;
