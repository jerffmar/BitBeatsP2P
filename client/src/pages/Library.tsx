import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Play, Pause, Download, Loader2 } from 'lucide-react';
import { api, TrackDTO } from '../services/api';
import { PlayerContextType } from '../App';

export const Library: React.FC = () => {
    const { currentTrack, isPlaying, playTrack } = useOutletContext<PlayerContextType>();
    const [tracks, setTracks] = useState<TrackDTO[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api
            .getTracks()
            .then(setTracks)
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="library-page">Loading tracks…</div>;

    return (
        <div className="library-page">
            <header className="library-header">
                <h1>Library</h1>
                <p>{tracks.length} tracks available</p>
            </header>
            <div className="track-grid">
                {tracks.map((track) => (
                    <button
                        key={track.id}
                        className={`track-card ${currentTrackId === track.id ? 'active' : ''}`}
                        onClick={() => playTrack(track)}
                    >
                        <div className="track-card__meta">
                            <span className="track-card__title">{track.title}</span>
                            <span className="track-card__artist">{track.artist}</span>
                        </div>
                        <span className="track-card__cta">
                            {currentTrackId === track.id ? 'Playing' : 'Play'}
                        </span>
                    </button>
                ))}
                {!tracks.length && <p>No uploads yet. Be the first!</p>}
            </div>
        </div>
    );
};