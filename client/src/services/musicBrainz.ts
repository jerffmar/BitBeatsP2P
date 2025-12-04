export type GlobalCatalogEntry = {
  mbid: string;
  title: string;
  artist: string;
  coverUrl?: string;
};

type SearchResult = {
  songs: GlobalCatalogEntry[];
  albums: GlobalCatalogEntry[];
  artists: GlobalCatalogEntry[];
};

export const searchGlobalCatalog = async (
  query: string,
  offset = 0,
  filter: 'ALL' | 'SONG' | 'ALBUM' | 'ARTIST' = 'ALL',
): Promise<SearchResult> => {
  console.log('Mock MusicBrainz search', { query, offset, filter });
  const makeEntry = (suffix: string): GlobalCatalogEntry => ({
    mbid: `${suffix}-${offset}-${Date.now()}`,
    title: `${query} ${suffix}`,
    artist: `Artist ${suffix}`,
    coverUrl: 'https://images.unsplash.com/photo-1511376777868-611b54f68947?auto=format&fit=crop&w=400&q=60',
  });
  return {
    songs: filter === 'ALBUM' || filter === 'ARTIST' ? [] : [makeEntry('Song A'), makeEntry('Song B')],
    albums: filter === 'SONG' || filter === 'ARTIST' ? [] : [makeEntry('Album A')],
    artists: filter === 'SONG' || filter === 'ALBUM' ? [] : [makeEntry('Artist A')],
  };
};
