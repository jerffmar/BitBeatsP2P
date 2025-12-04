import React from 'react';
import { Track, LibraryEntry } from '../types';

type Props = {
  tracks: Track[];
  library: Record<string, LibraryEntry>;
  onPlay: (track: Track) => void;
  loading: boolean;
  userHandle: string;
};

const DiscoveryPage: React.FC<Props> = ({ tracks, library, onPlay, loading, userHandle }) => (
  <section className="max-w-5xl mx-auto p-6 md:p-10 space-y-6">
    <header className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-400">Hello, @{userHandle}</p>
        <h1 className="text-3xl font-bold text-white">Discovery</h1>
      </div>
      <span className="text-xs text-gray-500 bg-white/5 px-3 py-1 rounded-full">
        {Object.keys(library).length} vault entries
      </span>
    </header>

    {loading ? (
      <div className="text-center text-gray-500 border border-white/10 rounded-2xl py-16">Loading swarm…</div>
    ) : tracks.length === 0 ? (
      <div className="text-center text-gray-500 border border-white/10 rounded-2xl py-16">
        No tracks available yet. Upload or join a swarm to begin.
      </div>
    ) : (
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {tracks.map((track) => (
          <button
            key={track.id}
            className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left hover:border-cyan-400 transition"
            onClick={() => onPlay(track)}
          >
            <img src={track.coverUrl} alt={track.title} className="h-40 w-full object-cover rounded-xl mb-3" />
            <p className="text-white font-semibold truncate">{track.title}</p>
            <p className="text-xs text-gray-400 truncate">{track.artist}</p>
          </button>
        ))}
      </div>
    )}
  </section>
);

export default DiscoveryPage;
