import { GlobalCatalogEntry, IdentifiedTrack } from '../types';

type IdentifyPayload = {
  title?: string;
  artist?: string;
  duration?: number;
  fingerprint?: string;
};

const request = async <T>(input: RequestInfo, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error ?? 'MusicBrainz request failed');
  }
  return body as T;
};

export const identifyTrack = (payload: IdentifyPayload) =>
  request<{ match: IdentifiedTrack; alternatives: IdentifiedTrack[] }>('/api/identify', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const fetchIdentifiedLibrary = () =>
  request<IdentifiedTrack[]>('/api/library/identified');

export const searchGlobalCatalog = async (query: string, offset: number, filter: string): Promise<{ songs: GlobalCatalogEntry[]; albums: GlobalCatalogEntry[]; artists: GlobalCatalogEntry[] }> => {
  // Stub: return search results
  return { songs: [], albums: [], artists: [] };
};
