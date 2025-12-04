type RecordingSearchInput = {
  title?: string;
  artist?: string;
  duration?: number;
  fingerprint?: string;
};

export type RecordingMatch = {
  mbid: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  genre?: string;
};

export class MusicBrainzService {
  private readonly baseUrl = 'https://musicbrainz.org/ws/2';
  private readonly userAgent = 'BitBeats/1.0 (contact@bitbeats.local)';

  async searchRecording(params: RecordingSearchInput): Promise<RecordingMatch[]> {
    const queryParts = [];
    if (params.title) queryParts.push(`recording:"${params.title}"`);
    if (params.artist) queryParts.push(`artist:"${params.artist}"`);
    if (params.duration) queryParts.push(`dur:${Math.round(params.duration)}`);
    if (!queryParts.length && params.fingerprint) {
      queryParts.push(`discid:${params.fingerprint}`);
    }
    if (!queryParts.length) return [];

    const url = new URL(`${this.baseUrl}/recording`);
    url.searchParams.set('query', queryParts.join(' AND '));
    url.searchParams.set('limit', '5');
    url.searchParams.set('fmt', 'json');

    const response = await fetch(url, { headers: { 'User-Agent': this.userAgent } });
    if (!response.ok) {
      throw new Error(`MusicBrainz request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as any;
    return (payload.recordings ?? []).map((record: any) => ({
      mbid: record.id,
      title: record.title,
      artist: record['artist-credit']?.[0]?.name ?? 'Unknown Artist',
      album: record.releases?.[0]?.title,
      duration: record.length ? Math.round(record.length / 1000) : undefined,
      genre: record.tags?.[0]?.name,
    }));
  }
}
