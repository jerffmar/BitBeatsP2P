export interface Track {
    id: string;
    title: string;
    artist: string;
    magnetURI: string;
    webSeedUrl: string;
    sizeBytes: string;
    uploadedAt: string;
}

export interface PlayerState {
    isPlaying: boolean;
    currentTrack: Track | null;
    volume: number;
}