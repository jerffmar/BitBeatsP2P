export interface User {
  id: string;
  username: string;
  handle: string;
}

export interface Stats {
  credits: number;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  magnetURI?: string;
  sizeBytes?: number;
  sizeMB?: number; // Added
  coverUrl?: string;
  audioUrl: string;
}

export interface LibraryEntry {
  id: string;
  dateAdded: number;
  trackId: string;
  status: 'SEEDING' | 'REMOTE' | 'DOWNLOADING';
  progress: number;
  addedAt: number;
  lastPlayed?: number;
}

export interface UserStats {
  credits: number;
  downloadedBytes: number;
  uploadedBytes: number;
  ratio: number;
  reputation: string;
}

export interface StorageConfig {
  path?: string;
  limit?: number;
  maxUsageGB: number;
  evictionStrategy: string;
  ghostSeeding: boolean;
}

export interface SocialPost {
  id: string;
  content: string;
  author: string;
  timestamp: number;
}

export interface GlobalCatalogEntry {
  id: string;
  mbid: string;
  title: string;
  artist: string;
  coverUrl?: string;
}

// New: Artist and Release/Album DTOs used by the UI/musicbrainz client
export interface ArtistDetail {
  mbid: string;
  name: string;
  sortName?: string;
  bio?: string;
  country?: string;
  lifeSpan?: { begin?: string; end?: string; ended?: boolean };
  releases?: ReleaseSummary[];
}

export interface ReleaseSummary {
  mbid: string;
  title: string;
  date?: string;
  type?: string; // 'Album' | 'Single' etc
  coverUrl?: string;
}

export interface ReleaseDetail {
  mbid: string;
  title: string;
  date?: string;
  status?: string;
  disambiguation?: string;
  coverUrl?: string;
  artistCredit?: string;
  tracks?: Array<{ position?: string; title: string; length?: number }>;
}

export interface Bounty {
  id: string;
  amount: number;
  query: string;
  requesterCount: number;
  reward: number;
}

export interface ListenParty {
  id: string;
  name: string;
  host: string;
  currentTrackId?: string;
  participants: number;
}
