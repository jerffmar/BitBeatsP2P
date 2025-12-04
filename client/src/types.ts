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
