import { GlobalCatalogEntry } from '../types';

export const searchGlobalCatalog = async (query: string, offset: number, filter: string): Promise<{ songs: GlobalCatalogEntry[]; albums: GlobalCatalogEntry[]; artists: GlobalCatalogEntry[] }> => {
  // Stub: return search results
  return { songs: [], albums: [], artists: [] };
};
