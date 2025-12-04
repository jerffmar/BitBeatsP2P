import { GlobalCatalogEntry, ReleaseSummary } from '../types';

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

const requestCatalogSearch = async <T>(params: Record<string, string | number>) => {
  try {
    const url = new URL('/api/catalog/search', window.location.origin);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    const resp = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
    if (!resp.ok) throw new Error(`Catalog search failed ${resp.status}`);
    return (await resp.json()) as T;
  } catch (err) {
    console.warn('Catalog search failed, falling back to MusicBrainz proxy', err);
    return null;
  }
};

const fetchRecordings = async (query: string, offset: number, limit: number) => {
  // Try server DB first
  const catalog = await requestCatalogSearch<{ songs: any[] }>({ q: query, type: 'SONG', offset, limit });
  if (catalog?.songs && catalog.songs.length) return catalog.songs;
  // fallback: use existing client-side MB proxy if server returned nothing
  const data = await requestMusicBrainz<RecordingResponse>('recording', {
    query,
    offset,
    limit,
    inc: 'artist-credits+releases',
  });
  if (!data?.recordings) return [];
  return data.recordings.map((recording) => ({
    mbid: recording.id,
    title: recording.title,
    artist: normalizeArtistCredit(recording['artist-credit']),
    coverUrl: buildCoverUrl(recording.releases?.[0]) ?? COVER_PLACEHOLDER,
  }));
};

const fetchReleases = async (query: string, offset: number, limit: number) => {
  const catalog = await requestCatalogSearch<{ albums: any[] }>({ q: query, type: 'ALBUM', offset, limit });
  if (catalog?.albums && catalog.albums.length) return catalog.albums;
  const data = await requestMusicBrainz<ReleaseResponse>('release', {
    query,
    offset,
    limit,
    inc: 'artist-credits',
  });
  if (!data?.releases) return [];
  return data.releases.map((release) => ({
    mbid: release.id,
    title: release.title,
    artist: normalizeArtistCredit(release['artist-credit']),
    coverUrl: buildCoverUrl(release) ?? COVER_PLACEHOLDER,
  }));
};

const fetchArtists = async (query: string, offset: number, limit: number) => {
  const catalog = await requestCatalogSearch<{ artists: any[] }>({ q: query, type: 'ARTIST', offset, limit });
  if (catalog?.artists && catalog.artists.length) return catalog.artists;
  const data = await requestMusicBrainz<ArtistResponse>('artist', {
    query,
    offset,
    limit,
  });
  if (!data?.artists) return [];
  return data.artists.map((artist) => ({
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
export const getArtistById = async (mbid: string) => {
  try {
    const resp = await fetch(`/api/catalog/artist/${mbid}`);
    if (!resp.ok) throw new Error('artist fetch failed');
    return await resp.json();
  } catch (err) {
    console.warn('getArtistById failed', err);
    return null;
  }
};

/**
 * Fetch a release (album) and its recordings (tracklist)
 */
export const getReleaseById = async (mbid: string) => {
  try {
    const resp = await fetch(`/api/catalog/release/${mbid}`);
    if (!resp.ok) throw new Error('release fetch failed');
    return await resp.json();
  } catch (err) {
    console.warn('getReleaseById failed', err);
    return null;
  }
};

/**
 * Get recent releases for a given artist name.
 * Tries server catalog (DB cached) first, falls back to MusicBrainz proxy.
 */
export const getReleasesByArtistName = async (artistName: string, limit = 4): Promise<ReleaseSummary[]> => {
  if (!artistName || !artistName.trim()) return [];
  // 1) server-side catalog search (DB first)
  try {
    const catalog = await requestCatalogSearch<{ albums: any[] }>({ q: artistName, type: 'ALBUM', offset: 0, limit });
    if (catalog?.albums && catalog.albums.length) {
      return catalog.albums.slice(0, limit).map((a: any) => ({
        mbid: a.mbid ?? a.id,
        title: a.title,
        date: a.date ?? a.releaseDate,
        type: a.type ?? undefined,
        coverUrl: a.coverUrl ?? a.cover ?? COVER_PLACEHOLDER,
      }));
    }
  } catch (err) {
    console.warn('Catalog search (artist releases) failed, falling back to MusicBrainz:', err);
  }

  // 2) fallback: MusicBrainz release search by artist name
  try {
    const data = await requestMusicBrainz<ReleaseResponse>('release', {
      query: `artist:${artistName}`,
      offset: 0,
      limit,
      inc: 'artist-credits',
    });
    if (!data?.releases) return [];
    return data.releases.slice(0, limit).map((r) => ({
      mbid: r.id,
      title: r.title,
      date: (r as any).date,
      type: (r as any)['primary-type'] || undefined,
      coverUrl: buildCoverUrl(r) ?? COVER_PLACEHOLDER,
    }));
  } catch (err) {
    console.warn('MusicBrainz release lookup failed:', err);
    return [];
  }
};
