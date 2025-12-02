import { useEffect, useState } from 'react';
import { api, TrackDTO } from '../services/api';

type Props = {
  onSelectTrack: (track: TrackDTO) => void;
  currentTrackId: number | null;
};

export const Library = ({ onSelectTrack, currentTrackId }: Props) => {
  const [tracks, setTracks] = useState<TrackDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getTracks().then(setTracks).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="library-page">Loading tracks…</div>;

  return (
    <div className="library-page">
      <header className="library-header mb-4">
        <h1 className="text-xl font-semibold">Library</h1>
        <p className="text-sm text-white/60">{tracks.length} tracks available</p>
      </header>
      <div className="track-grid grid gap-2">
        {tracks.map((track) => (
          <button
            key={track.id}
            className={`track-card flex items-center justify-between p-4 rounded border border-transparent hover:border-brand-accent transition ${
              currentTrackId === track.id ? 'bg-white/10' : 'bg-white/5'
            }`}
            onClick={() => onSelectTrack(track)}
          >
            <div className="text-left">
              <p className="font-medium">{track.title}</p>
              <p className="text-sm text-white/60">{track.artist}</p>
            </div>
            <span className="text-sm text-brand-accent">
              {currentTrackId === track.id ? 'Playing' : 'Play'}
            </span>
          </button>
        ))}
        {!tracks.length && <p>No uploads yet. Be the first!</p>}
      </div>
    </div>
  );
};
