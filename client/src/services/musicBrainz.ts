const MUSICBRAINZ_BASE = 'https://musicbrainz.org/ws/2';
const COVER_PLACEHOLDER =
  'https://images.unsplash.com/photo-1511376777868-611b54f68947?auto=format&fit=crop&w=400&q=60';

export type GlobalCatalogEntry = {
  mbid: string;
  title: string;
  artist: string;
  coverUrl?: string;
};

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
    const url = new URL(`${MUSICBRAINZ_BASE}/${endpoint}`);
    url.searchParams.set('fmt', 'json');
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
