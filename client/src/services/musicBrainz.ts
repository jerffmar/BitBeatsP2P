import { GlobalCatalogEntry } from '../types';

const MUSICBRAINZ_BASE = 'https://musicbrainz.org/ws/2';
const COVER_PLACEHOLDER =
  'https://images.unsplash.com/photo-1511376777868-611b54f68947?auto=format&fit=crop&w=400&q=60';

export type FilterType = 'ALL' | 'SONG' | 'ALBUM' | 'ARTIST';

type RecordingResponse = {
  recordings?: Array<{
    id: string;
    title: string;
    releases?: Array<{
      id: string;
      title: string;
      'cover-art-archive'?: { front?: boolean };
    }>;
    'artist-credit'?: Array<{ name?: string; artist?: { name?: string } }>;
  }>;
};

type ReleaseResponse = {
  releases?: Array<{
    id: string;
    title: string;
    'artist-credit'?: Array<{ name?: string; artist?: { name?: string } }>;
    'cover-art-archive'?: { front?: boolean };
  }>;
};

type ArtistResponse = {
  artists?: Array<{
    id: string;
    name: string;
  }>;
};

type CatalogResult = {
  songs: GlobalCatalogEntry[];
  albums: GlobalCatalogEntry[];
  artists: GlobalCatalogEntry[];
};

const buildCoverUrl = (release?: { id?: string; 'cover-art-archive'?: { front?: boolean } }) =>
  release?.id && release['cover-art-archive']?.front
    ? `https://coverartarchive.org/release/${release.id}/front`
    : undefined;

const normalizeArtistCredit = (credits?: Array<{ name?: string; artist?: { name?: string } }>) =>
  credits?.map((credit) => credit.name || credit.artist?.name).filter(Boolean).join(', ') || 'Unknown Artist';

const requestMusicBrainz = async <T>(endpoint: string, params: Record<string, string | number>): Promise<T | null> => {
  try {
    // Proxy through our backend to avoid CORS issues
    const url = new URL('/api/musicbrainz', window.location.origin);
    url.searchParams.set('endpoint', endpoint);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`MusicBrainz ${endpoint} responded with ${response.status}`);
    return (await response.json()) as T;
  } catch (error) {
    console.error('MusicBrainz request failed:', error);
    return null;
  }
};

const fetchRecordings = async (query: string, offset: number, limit: number) => {
  const data = await requestMusicBrainz<RecordingResponse>('recording', {
    query,
    offset,
    limit,
    inc: 'artist-credits+releases',
  });
  if (!data?.recordings) return [];
  return data.recordings.map((recording) => ({
    id: recording.id, // <-- add required id
    mbid: recording.id,
    title: recording.title,
    artist: normalizeArtistCredit(recording['artist-credit']),
    coverUrl: buildCoverUrl(recording.releases?.[0]) ?? COVER_PLACEHOLDER,
  }));
};

const fetchReleases = async (query: string, offset: number, limit: number) => {
  const data = await requestMusicBrainz<ReleaseResponse>('release', {
    query,
    offset,
    limit,
    inc: 'artist-credits',
  });
  if (!data?.releases) return [];
  return data.releases.map((release) => ({
    id: release.id, // <-- add required id
    mbid: release.id,
    title: release.title,
    artist: normalizeArtistCredit(release['artist-credit']),
    coverUrl: buildCoverUrl(release) ?? COVER_PLACEHOLDER,
  }));
};

const fetchArtists = async (query: string, offset: number, limit: number) => {
  const data = await requestMusicBrainz<ArtistResponse>('artist', {
    query,
    offset,
    limit,
  });
  if (!data?.artists) return [];
  return data.artists.map((artist) => ({
    id: artist.id, // <-- add required id
    mbid: artist.id,
    title: artist.name,
    artist: artist.name,
    coverUrl: COVER_PLACEHOLDER,
  }));
};

export const searchGlobalCatalog = async (
  query: string,
  offset = 0,
  filter: FilterType = 'ALL',
  limit = 8,
): Promise<CatalogResult> => {
  // Guard against empty queries — MusicBrainz returns 400 if query is blank.
  if (!query || !query.trim()) {
    return { songs: [], albums: [], artists: [] };
  }

  const shouldFetchSongs = filter === 'ALL' || filter === 'SONG';
  const shouldFetchAlbums = filter === 'ALL' || filter === 'ALBUM';
  const shouldFetchArtists = filter === 'ALL' || filter === 'ARTIST';

  const [songs, albums, artists] = await Promise.all([
    shouldFetchSongs ? fetchRecordings(query, filter === 'SONG' ? offset : 0, limit) : Promise.resolve([]),
    shouldFetchAlbums ? fetchReleases(query, filter === 'ALBUM' ? offset : 0, limit) : Promise.resolve([]),
    shouldFetchArtists ? fetchArtists(query, filter === 'ARTIST' ? offset : 0, limit) : Promise.resolve([]),
  ]);

  return { songs, albums, artists };
};

/**
 * Fetch artist by MBID with relations (including urls & releases).
 * Attempts to build a short bio using a Wikipedia relation when available.
 */
export const getArtistById = async (mbid: string): Promise<import('../types').ArtistDetail | null> => {
  if (!mbid) return null;
  const data = await requestMusicBrainz<any>(`artist/${mbid}`, { inc: 'url-rels+release-groups+releases' });
  if (!data || !data.id) return null;

  const name: string = data.name;
  let bio: string | undefined;

  // Try to find a Wikipedia url relation
  const wikiRel = (data.relations || []).find((r: any) =>
    r.type?.toLowerCase().includes('wikipedia') ||
    (r.url && r.url.resource && String(r.url.resource).includes('wikipedia.org')),
  );

  if (wikiRel && wikiRel.url && wikiRel.url.resource) {
    try {
      // extract page title from URL and ask Wikipedia REST summary
      const url = new URL(wikiRel.url.resource);
      const title = decodeURIComponent(url.pathname.replace(/^\/wiki\//, ''));
      const wpResp = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
      if (wpResp.ok) {
        const wpJson = await wpResp.json();
        if (typeof wpJson.extract === 'string') bio = wpJson.extract;
      }
    } catch (e) {
      // ignore wiki fetch errors
    }
  }

  // Build simple list of releases (release-groups/releases returned by inc)
  const releases: import('../types').ReleaseSummary[] = [];
  if (Array.isArray(data['releases'])) {
    for (const r of data['releases']) {
      releases.push({
        mbid: r.id,
        title: r.title,
        date: r.date,
        type: r['release-group']?.primary_type || undefined,
        coverUrl: buildCoverUrl(r) ?? COVER_PLACEHOLDER,
      });
    }
  }
  // Also try release-groups if available (avoids duplicates)
  if (Array.isArray(data['release-groups'])) {
    for (const rg of data['release-groups']) {
      releases.push({
        mbid: rg.id,
        title: rg.title,
        date: rg['first-release-date'],
        type: rg['primary-type'],
        coverUrl: rg.id ? `https://coverartarchive.org/release-group/${rg.id}/front` : COVER_PLACEHOLDER,
      });
    }
  }

  // dedupe by mbid and prefer ones with covers/dates
  const seen = new Map<string, import('../types').ReleaseSummary>();
  for (const r of releases) {
    if (!r.mbid) continue;
    const prev = seen.get(r.mbid);
    if (!prev) seen.set(r.mbid, r);
    else {
      // merge fields preferring cover/date
      seen.set(r.mbid, { ...prev, ...r, coverUrl: prev.coverUrl || r.coverUrl, date: prev.date || r.date });
    }
  }

  const merged = Array.from(seen.values()).sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.localeCompare(a.date);
  });

  return {
    mbid: data.id,
    name,
    sortName: data['sort-name'],
    bio,
    country: data.country,
    lifeSpan: data['life-span'],
    releases: merged,
  };
};

/**
 * Fetch a release (album) and its recordings (tracklist)
 */
export const getReleaseById = async (mbid: string): Promise<import('../types').ReleaseDetail | null> => {
  if (!mbid) return null;
  const data = await requestMusicBrainz<any>(`release/${mbid}`, { inc: 'recordings+artist-credits' });
  if (!data || !data.id) return null;

  // collect tracks across media
  const tracks: Array<{ position?: string; title: string; length?: number }> = [];
  if (Array.isArray(data.media)) {
    for (const media of data.media) {
      if (Array.isArray(media.tracks)) {
        for (const t of media.tracks) {
          tracks.push({
            position: t.position != null ? String(t.position) : t.number,
            title: t.title,
            length: typeof t.length === 'number' ? t.length : (t.length ? Number(t.length) : undefined),
          });
        }
      }
    }
  }

  const cover = data.id ? `https://coverartarchive.org/release/${data.id}/front` : undefined;

  return {
    mbid: data.id,
    title: data.title,
    date: data.date,
    status: data.status,
    disambiguation: data.disambiguation,
    coverUrl: cover ?? COVER_PLACEHOLDER,
    artistCredit: Array.isArray(data['artist-credit']) ? data['artist-credit'].map((ac) => ac.name || ac.artist?.name).join(', ') : undefined,
    tracks,
  };
};

/**
 * Search recent releases by artist name (used to build mosaics when artist profile is poor)
 */
export const getReleasesByArtistName = async (artistName: string, limit = 8) => {
  if (!artistName) return [];
  // Use release search query by artist name; results may include duplicates but it's ok for mosaic
  const q = `artist:${artistName}`;
  const data = await requestMusicBrainz<any>('release', { query: q, limit, inc: 'artist-credits' });
  if (!data?.releases) return [];
  return data.releases
    .map((r: any) => ({
      mbid: r.id,
      title: r.title,
      date: r.date,
      coverUrl: buildCoverUrl(r) ?? COVER_PLACEHOLDER,
    }))
    .slice(0, limit);
};
