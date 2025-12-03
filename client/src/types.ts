export interface Track {
  id: string;
  mbid?: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  audioUrl: string;
  duration: number;
  sizeMB: number;
  tags?: string[];
  license?: string;
  networkHealth?: number;
}

export interface LibraryEntry {
  trackId: string;
  status: 'REMOTE' | 'DOWNLOADING' | 'SEEDING';
  progress: number;
  addedAt: number;
  lastPlayed: number;
  localPath?: string;
}

export interface UserStats {
  downloadedBytes: number;
  uploadedBytes: number;
  ratio: number;
  reputation: string;
  credits: number;
}

export interface StorageConfig {
  maxUsageGB: number;
  evictionStrategy: 'SMART_RARITY' | 'LRU';
  ghostSeeding: boolean;
}

export interface User {
  id: string;
  username: string;
  handle: string;
}

export interface SocialPost {
  id: string;
  author: string;
  content: string;
  timestamp: number;
  trackId?: string;
}

export interface GlobalCatalogEntry {
  mbid: string;
  title: string;
  artist: string;
  coverUrl?: string;
  year?: string;
  type: 'song' | 'album' | 'artist';
}

export interface Bounty {
  id: string;
  mbid: string;
  query: string;
  reward: number;
  status: 'OPEN' | 'FULFILLED';
  requesterCount: number;
}

export interface ListenParty {
  id: string;
  host: string;
  currentTrackId: string;
  participants: number;
  startedAt: number;
}

export interface SearchResults {
  songs: GlobalCatalogEntry[];
  albums: GlobalCatalogEntry[];
  artists: GlobalCatalogEntry[];
}

export interface DetailedMetadata extends GlobalCatalogEntry {
  album?: string;
  tags?: string[];
}
