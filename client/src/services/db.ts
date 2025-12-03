import { Track, SocialPost, Bounty, ListenParty } from '../types';

export const initDB = (): void => {
  // Stub: initialize database
};

export const subscribeToPosts = (callback: (post: SocialPost) => void): (() => void) => {
  // Stub: subscribe to posts
  return () => {};
};

export const publishPost = (author: string, content: string, trackId?: string): void => {
  // Stub: publish post
};

export const createBounty = (mbid: string, query: string, reward: number): void => {
  // Stub: create bounty
};

export const subscribeToBounties = (callback: (bounty: Bounty) => void): (() => void) => {
  // Stub: subscribe to bounties
  return () => {};
};

export const publishTrackMetadata = (metadata: any): void => {
  // Stub: publish track metadata
};

export const subscribeToTracks = (callback: (track: Track) => void): (() => void) => {
  // Stub: subscribe to tracks
  return () => {};
};

export const subscribeToParties = (callback: (party: ListenParty) => void): (() => void) => {
  // Stub: subscribe to parties
  return () => {};
};

export const createParty = (host: string, currentTrackId: string): void => {
  // Stub: create party
};

export const subscribeToCredits = (userId: string, callback: (credits: number) => void): (() => void) => {
  // Stub: subscribe to credits
  return () => {};
};
