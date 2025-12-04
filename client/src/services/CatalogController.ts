import express, { Request, Response, Router } from 'express';
import prisma from './prisma.server';

const router: Router = express.Router();
const MB_BASE = 'https://musicbrainz.org/ws/2';
const COVER_ARCHIVE = (id: string) => `https://coverartarchive.org/release/${id}/front`;
const COVER_PLACEHOLDER = 'https://images.unsplash.com/photo-1511376777868-611b54f68947?auto=format&fit=crop&w=400&q=60';

const fetchJSON = async (url: string) => {
  const resp = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'BitBeats/1.0' } });
  if (!resp.ok) throw new Error(`MB returned ${resp.status}`);
  return await resp.json();
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

    // helper: DB-first search with fallback to MusicBrainz
    if (type === 'ALL' || type === 'ARTIST') {
      const dbArtists = await prisma.mbArtist.findMany({
        where: { name: { contains: q, mode: 'insensitive' } },
        skip: offset,
        take: limit,
        orderBy: { fetchedAt: 'desc' },
      });
      if (dbArtists.length) {
        out.artists = dbArtists.map((a) => ({ mbid: a.mbid, title: a.name, artist: a.name, coverUrl: COVER_PLACEHOLDER }));
      } else {
        // fetch from MB
        const mb = await fetchJSON(`${MB_BASE}/artist?query=${encodeURIComponent(q)}&fmt=json&limit=${limit}`);
        if (mb.artists) {
          out.artists = mb.artists.map(normalizeArtist);
          // persist fetched artists (best-effort)
          for (const a of mb.artists) {
            try {
              await prisma.mbArtist.upsert({
                where: { mbid: a.id },
                update: { name: a.name, data: a },
                create: { mbid: a.id, name: a.name, data: a },
              });
            } catch (e) { /* ignore */ }
          }
        }
      }
    }

    if (type === 'ALL' || type === 'ALBUM') {
      const dbReleases = await prisma.mbRelease.findMany({
        where: { title: { contains: q, mode: 'insensitive' } },
        skip: offset,
        take: limit,
        orderBy: { fetchedAt: 'desc' },
      });
      if (dbReleases.length) {
        out.albums = dbReleases.map((r) => ({ mbid: r.mbid, title: r.title, artist: undefined, coverUrl: r.coverUrl ?? COVER_PLACEHOLDER, date: r.date }));
      } else {
        const mb = await fetchJSON(`${MB_BASE}/release?query=${encodeURIComponent(q)}&fmt=json&limit=${limit}`);
        if (mb.releases) {
          out.albums = mb.releases.map(normalizeRelease);
          for (const r of mb.releases) {
            try {
              await prisma.mbRelease.upsert({
                where: { mbid: r.id },
                update: { title: r.title, date: r.date, data: r },
                create: { mbid: r.id, title: r.title, date: r.date, data: r },
              });
            } catch (e) { /* ignore */ }
          }
        }
      }
    }

    if (type === 'ALL' || type === 'SONG') {
      const dbRecords = await prisma.mbRecording.findMany({
        where: { title: { contains: q, mode: 'insensitive' } },
        skip: offset,
        take: limit,
        orderBy: { fetchedAt: 'desc' },
      });
      if (dbRecords.length) {
        out.songs = dbRecords.map((r) => ({ mbid: r.mbid, title: r.title, artist: r.artistCredit, coverUrl: COVER_PLACEHOLDER }));
      } else {
        const mb = await fetchJSON(`${MB_BASE}/recording?query=${encodeURIComponent(q)}&fmt=json&limit=${limit}&inc=artist-credits+releases`);
        if (mb.recordings) {
          out.songs = mb.recordings.map(normalizeRecording);
          for (const rec of mb.recordings) {
            try {
              await prisma.mbRecording.upsert({
                where: { mbid: rec.id },
                update: { title: rec.title, artistCredit: Array.isArray(rec['artist-credit']) ? rec['artist-credit'].map((a: any)=>a.name||a.artist?.name).join(', ') : undefined, data: rec },
                create: { mbid: rec.id, title: rec.title, artistCredit: Array.isArray(rec['artist-credit']) ? rec['artist-credit'].map((a: any)=>a.name||a.artist?.name).join(', ') : undefined, data: rec },
              });
            } catch (e) { /* ignore */ }
          }
        }
      }
    }

    return res.json(out);
  } catch (err: any) {
    console.error('Catalog search error', err);
    return res.status(502).json({ error: 'Catalog search failed' });
  }
});

// GET /artist/:mbid
router.get('/artist/:mbid', async (req: Request, res: Response) => {
  const mbid = String(req.params.mbid || '');
  if (!mbid) return res.status(400).json({ error: 'missing mbid' });
  try {
    const cached = await prisma.mbArtist.findUnique({ where: { mbid } });
    if (cached) return res.json({ mbid: cached.mbid, name: cached.name, bio: cached.bio, data: cached.data });

    const data = await fetchJSON(`${MB_BASE}/artist/${mbid}?fmt=json&inc=url-rels+release-groups+releases`);
    const wikiRel = (data.relations || []).find((r: any) => r.type?.toLowerCase().includes('wikipedia') || (r.url && r.url.resource && String(r.url.resource).includes('wikipedia.org')));
    let bio: string | undefined;
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
    await prisma.mbArtist.create({ data: { mbid: data.id, name: data.name, sortName: data['sort-name'], country: data.country, bio, data } });
    return res.json({ mbid: data.id, name: data.name, bio, data });
  } catch (err) {
    console.error('Artist fetch error', err);
    return res.status(502).json({ error: 'Artist fetch failed' });
  }
});

// GET /release/:mbid
router.get('/release/:mbid', async (req: Request, res: Response) => {
  const mbid = String(req.params.mbid || '');
  if (!mbid) return res.status(400).json({ error: 'missing mbid' });
  try {
    const cached = await prisma.mbRelease.findUnique({ where: { mbid } });
    if (cached) return res.json({ mbid: cached.mbid, title: cached.title, date: cached.date, coverUrl: cached.coverUrl, data: cached.data });

    const data = await fetchJSON(`${MB_BASE}/release/${mbid}?fmt=json&inc=recordings+artist-credits`);
    const cover = data.id ? COVER_ARCHIVE(data.id) : undefined;
    await prisma.mbRelease.create({ data: { mbid: data.id, title: data.title, date: data.date, status: data.status, coverUrl: cover, data } });
    return res.json({ mbid: data.id, title: data.title, date: data.date, status: data.status, coverUrl: cover, data });
  } catch (err) {
    console.error('Release fetch error', err);
    return res.status(502).json({ error: 'Release fetch failed' });
  }
});

export const CatalogController = { router };
export default router;
