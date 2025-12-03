import React from 'react';
import { Flame, Headphones, Music, Play, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TrackDTO } from '../services/api';

type Props = {
  featuredTracks: TrackDTO[];
  onSelectTrack: (track: TrackDTO) => void;
  loading: boolean;
};

const vibeCollections = [
  {
    title: 'Latency-Free Focus',
    description: 'Lo-fi and instrumentals stored locally for zero-buffer sessions.',
    accent: 'from-purple-500/30 to-indigo-500/20',
  },
  {
    title: 'Night Run Synths',
    description: 'Retro wave torrents curated by the swarm.',
    accent: 'from-cyan-400/20 to-emerald-500/20',
  },
  {
    title: 'Vault Warmers',
    description: 'Most downloaded tracks in the last 48h.',
    accent: 'from-orange-500/20 to-rose-500/20',
  },
];

const Discovery: React.FC<Props> = ({ featuredTracks, onSelectTrack, loading }) => {
  const hasTracks = featuredTracks.length > 0;

  return (
    <div className="space-y-10 p-6 md:p-10">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/20 via-transparent to-indigo-700/20 p-8">
        <div className="max-w-2xl space-y-4">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-cyan-200">
            <Sparkles size={14} /> Hybrid P2P
          </p>
          <h1 className="text-4xl md:text-5xl font-black text-white leading-tight">
            Explore the BitBeats Swarm
          </h1>
          <p className="text-gray-200/80 text-lg">
            Fresh torrents, vault-ready downloads, and HTTP fallbacks—designed from the BitBeatsPWA
            experience you loved.
          </p>
          <div className="flex items-center gap-4">
            <Link
              to="/upload"
              className="rounded-full bg-white text-black px-6 py-2 text-sm font-semibold shadow-lg hover:opacity-90 transition"
            >
              Seed a Track
            </Link>
            <p className="text-sm text-gray-300 flex items-center gap-2">
              <Headphones size={16} /> Offline vault friendly
            </p>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Flame className="text-orange-400" size={20} />
            Freshly Seeded
          </h2>
          {hasTracks && (
            <span className="text-xs font-semibold text-gray-400">
              {featuredTracks.length} files ready for playback
            </span>
          )}
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="rounded-2xl border border-white/5 bg-white/5 p-4 animate-pulse h-36" />
            ))}
          </div>
        ) : hasTracks ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {featuredTracks.map((track) => (
              <button
                key={track.id}
                onClick={() => onSelectTrack(track)}
                className="group rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 p-5 text-left transition hover:border-cyan-400/40 hover:shadow-[0_10px_40px_rgba(14,165,233,0.15)]"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs uppercase tracking-[0.4em] text-gray-500">Ready</span>
                  <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs text-gray-200">
                    <Music size={14} />
                    {(Number(track.sizeBytes) / (1024 * 1024)).toFixed(1)} MB
                  </div>
                </div>
                <h3 className="text-xl font-bold text-white truncate">{track.title}</h3>
                <p className="text-sm text-gray-400 truncate">{track.artist}</p>
                <div className="mt-6 flex items-center justify-between text-xs text-gray-400">
                  <span>Magnet ready</span>
                  <span className="flex items-center gap-1 text-cyan-300 font-semibold">
                    <Play size={14} className="transition group-hover:translate-x-1" />
                    Stream
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center text-gray-400">
            No tracks in the swarm yet. <Link to="/upload" className="text-cyan-300 underline">Be the first to seed.</Link>
          </div>
        )}
      </section>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {vibeCollections.map((collection) => (
          <div
            key={collection.title}
            className={`rounded-3xl border border-white/10 bg-gradient-to-br ${collection.accent} p-6`}
          >
            <p className="text-xs uppercase tracking-[0.4em] text-gray-400 mb-3">Curated</p>
            <h3 className="text-xl font-bold text-white mb-2">{collection.title}</h3>
            <p className="text-sm text-gray-200/80 mb-6">{collection.description}</p>
            <button className="text-xs font-semibold text-white flex items-center gap-2">
              Queue mix
              <Play size={12} />
            </button>
          </div>
        ))}
      </section>
    </div>
  );
};

export default Discovery;
