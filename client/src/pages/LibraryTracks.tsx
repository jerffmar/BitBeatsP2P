import React from 'react';
import { Track } from '../types';

type Props = {
  tracks: Track[];
  currentTrackId: string | null;
  onPlay: (track: Track) => void;
};

const LibraryTracks: React.FC<Props> = ({ tracks, currentTrackId, onPlay }) => {
  return (
    <section className="max-w-5xl mx-auto p-6 md:p-10 space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.35em] text-gray-500">Vault</p>
        <h1 className="text-3xl font-bold text-white mt-1">Tracks</h1>
        <p className="text-sm text-gray-400">{tracks.length} track{tracks.length === 1 ? '' : 's'}</p>
      </header>

      <div className="space-y-3">
        {tracks.map((track) => {
          const isActive = currentTrackId === track.id;
          return (
            <button
              key={track.id}
              onClick={() => onPlay(track)}
              className={`w-full text-left rounded-2xl border px-5 py-4 transition ${
                isActive ? 'border-cyan-400/60 bg-cyan-400/10' : 'border-white/10 bg-white/5 hover:border-white/30'
              }`}
            >
              <p className="text-white font-semibold">{track.title}</p>
              <p className="text-xs text-gray-400">{track.artist} · {track.album}</p>
            </button>
          );
        })}
        {!tracks.length && (
          <div className="rounded-2xl border border-dashed border-white/20 p-8 text-center text-gray-500">
            No tracks yet.
          </div>
        )}
      </div>
    </section>
  );
};

export default LibraryTracks;
