// src/db.ts

import { Track, SocialPost, Bounty, ListenParty } from '../types';
import { apiClient } from './api';

type TrackMetadataInput = {
    title: string;
    artist: string;
    album: string;
    duration: number;
    audioUrl: string;
    coverUrl?: string;
    license?: string;
    tags?: string[];
    artistSignature?: string;
};

type Unsubscribe = () => void;

const TRACK_STORE_KEY = 'bitbeats:published-tracks';
const postListeners = new Set<(post: SocialPost) => void>();
const trackListeners = new Set<(track: Track) => void>();
const bountyListeners = new Set<(bounty: Bounty) => void>();
const partyListeners = new Set<(party: ListenParty) => void>();
const creditListeners = new Map<string, Set<(credits: number) => void>>();
const creditTotals = new Map<string, number>();

const readStoredTracks = (): Track[] => {
    try {
        const raw = localStorage.getItem(TRACK_STORE_KEY);
        if (!raw) return [];
        return JSON.parse(raw) as Track[];
    } catch (err) {
        console.warn('Failed to read stored tracks', err);
        return [];
    }
};
const writeStoredTracks = (tracks: Track[]) => {
    try {
        localStorage.setItem(TRACK_STORE_KEY, JSON.stringify(tracks));
    } catch (err) {
        console.warn('Failed to persist tracks', err);
    }
};

export const initDB = () => {
    if (typeof window !== 'undefined') {
        console.log('[db] initialized mock realtime bus');
        // Rehydrate persisted tracks and notify subscribers (async to allow subscribers to attach)
        const persisted = readStoredTracks();
        if (persisted.length) {
            setTimeout(() => {
                persisted.forEach((t) => trackListeners.forEach((cb) => cb(t)));
            }, 50);
        }
    }
};

export const subscribeToPosts = (cb: (post: SocialPost) => void): Unsubscribe => {
    postListeners.add(cb);
    return () => postListeners.delete(cb);
};

export const publishPost = async (author: string, content: string, trackId?: string) => {
    const payload: SocialPost = {
        id: crypto.randomUUID?.() ?? `post-${Date.now()}`,
        author,
        content,
        trackId,
        timestamp: Date.now(),
    };
    postListeners.forEach((listener) => listener(payload));
};

export const subscribeToTracks = (cb: (track: Track) => void): Unsubscribe => {
    trackListeners.add(cb);
    return () => trackListeners.delete(cb);
};

export const publishTrackMetadata = async (metadata: TrackMetadataInput) => {
    const track: Track = {
        id: crypto.randomUUID?.() ?? `track-${Date.now()}`,
        title: metadata.title,
        artist: metadata.artist,
        album: metadata.album,
        audioUrl: metadata.audioUrl,
        coverUrl:
            metadata.coverUrl ??
            'https://images.unsplash.com/photo-1511376777868-611b54f68947?auto=format&fit=crop&w=600&q=60',
        duration: metadata.duration ?? 0,
        sizeMB: 0,
    };

    // Try to send to backend API if available
    try {
        await apiClient.post('/api/tracks', {
            title: metadata.title,
            artist: metadata.artist,
            album: metadata.album,
            duration: metadata.duration,
            magnetURI: metadata.audioUrl,
            coverUrl: metadata.coverUrl,
            tags: metadata.tags ?? [],
            signature: metadata.artistSignature ?? null,
        });
        // If backend accepts, also notify local listeners conservatively
        trackListeners.forEach((listener) => listener(track));
        return;
    } catch (err) {
        // fallback to local persistence
        console.warn('publishTrackMetadata: backend unavailable, persisting locally', err);
    }

    // Persist to local store
    const existing = readStoredTracks();
    existing.unshift(track);
    writeStoredTracks(existing.slice(0, 200)); // cap to recent 200
    trackListeners.forEach((listener) => listener(track));
};

export const subscribeToBounties = (cb: (bounty: Bounty) => void): Unsubscribe => {
    bountyListeners.add(cb);
    return () => bountyListeners.delete(cb);
};

export const createBounty = async (mbid: string, query: string, reward: number) => {
    const bounty: Bounty = {
        id: crypto.randomUUID?.() ?? `bounty-${Date.now()}`,
        mbid,
        query,
        reward,
        requesterCount: 1 + Math.floor(Math.random() * 4),
    };
    bountyListeners.forEach((listener) => listener(bounty));
};

export const subscribeToParties = (cb: (party: ListenParty) => void): Unsubscribe => {
    partyListeners.add(cb);
    return () => partyListeners.delete(cb);
};

export const createParty = async (host: string, trackId: string) => {
    const party: ListenParty = {
        id: crypto.randomUUID?.() ?? `party-${Date.now()}`,
        host,
        currentTrackId: trackId,
        participants: 5 + Math.floor(Math.random() * 20),
    };
    partyListeners.forEach((listener) => listener(party));
};

export const subscribeToCredits = (userId: string, cb: (credits: number) => void): Unsubscribe => {
    const set = creditListeners.get(userId) ?? new Set();
    set.add(cb);
    creditListeners.set(userId, set);
    return () => {
        const listeners = creditListeners.get(userId);
        if (!listeners) return;
        listeners.delete(cb);
        if (!listeners.size) creditListeners.delete(userId);
    };
};

export const updateCredits = (userId: string, delta: number) => {
    const total = Math.max(0, (creditTotals.get(userId) ?? 0) + delta);
    creditTotals.set(userId, total);
    creditListeners.get(userId)?.forEach((listener) => listener(total));
};
