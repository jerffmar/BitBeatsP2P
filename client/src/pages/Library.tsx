import { useEffect, useState } from 'react';
import { Loader2, Music } from 'lucide-react';
import { api, TrackDTO } from '../services/api';

type Props = {
  onSelectTrack: (track: TrackDTO) => void;
  currentTrackId: number | null;
};

export const Library = ({ onSelectTrack, currentTrackId }: Props) => {
  const [tracks, setTracks] = useState<TrackDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    api
      .getTracks()
      .then((data) => {
        if (active) setTracks(data);
      })
      .catch((err: any) => {
        if (!active) return;
        const message = err?.response?.data?.error || err?.message || 'Failed to load tracks.';
        setError(message);
      })
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.4em] text-gray-500">Vault</p>
        <h1 className="text-3xl font-bold text-white">Your Seeded Library</h1>
        <p className="text-sm text-gray-400">
          {tracks.length ? `${tracks.length} torrent${tracks.length === 1 ? '' : 's'} online.` : 'No torrents yet.'}
        </p>
      </header>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          Unable to load tracks: {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-gray-300">
          <Loader2 className="animate-spin" size={16} />
          Fetching vault contents…
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {tracks.map((track) => {
            const isActive = currentTrackId === track.id;
            return (
              <button
                key={track.id}
                onClick={() => onSelectTrack(track)}
                className={`rounded-3xl border px-5 py-4 text-left transition ${
                  isActive
                    ? 'border-cyan-400/60 bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 shadow-[0_10px_30px_rgba(34,211,238,0.2)]'
                    : 'border-white/10 bg-white/5 hover:border-white/30'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xl font-semibold text-white truncate">{track.title}</h2>
                  <div className="rounded-full bg-white/10 px-3 py-1 text-xs text-gray-300 flex items-center gap-1">
                    <Music size={12} />
                    {(Number(track.sizeBytes) / (1024 * 1024)).toFixed(1)} MB
                  </div>
                </div>
                <p className="text-sm text-gray-400 truncate">{track.artist}</p>
                <div className="mt-4 text-xs text-gray-500 flex items-center justify-between">
                  <span>{new Date(track.uploadedAt).toLocaleDateString()}</span>
                  <span className="text-cyan-300 font-semibold">{isActive ? 'Playing…' : 'Stream'}</span>
                </div>
              </button>
            );
          })}
          {!tracks.length && (
            <div className="rounded-3xl border border-dashed border-white/10 p-6 text-center text-gray-400">
              Upload a track to populate your vault.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
