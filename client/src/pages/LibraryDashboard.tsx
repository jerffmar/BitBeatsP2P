import React from 'react';
import { User, Track, LibraryEntry } from '../types';

type Props = {
  user: User;
  tracks: Track[];
  library: Record<string, LibraryEntry>;
  usageMB: number;
  onImport: (file: File, metadata: { title: string; artist: string; album?: string }) => Promise<void>;
};

const LibraryDashboard: React.FC<Props> = ({ user, tracks, library, usageMB, onImport }) => {
  const seededCount = Object.values(library).filter((entry) => entry.status === 'SEEDING').length;
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    onImport(file, { title: file.name, artist: user.username });
  };

  return (
    <section className="max-w-5xl mx-auto p-6 md:p-10 space-y-6">
      <header className="rounded-3xl border border-white/10 bg-white/5 p-6 flex flex-wrap gap-6 justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-gray-500">Vault</p>
          <h1 className="text-3xl font-bold text-white mt-1">{user.username}’s Library</h1>
          <p className="text-sm text-gray-400">{tracks.length} swarm tracks · {seededCount} seeded entries</p>
        </div>
        <label className="px-4 py-3 rounded-2xl border border-white/10 bg-white/5 text-sm font-semibold text-white cursor-pointer hover:border-cyan-400 transition">
          Import Local Audio
          <input type="file" accept="audio/*" className="hidden" onChange={handleImport} />
        </label>
      </header>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-4">
        <p className="text-sm text-gray-400">Storage usage</p>
        <div className="w-full h-3 bg-black/40 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-cyan-400 to-indigo-500" style={{ width: `${Math.min(100, (usageMB / (1024 * 2)) * 100)}%` }} />
        </div>
        <p className="text-xs text-gray-500">{usageMB.toFixed(1)} MB of 2048 MB (soft cap)</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tracks.map((track) => (
          <article key={track.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
            <img src={track.coverUrl} alt={track.title} className="w-full h-44 object-cover rounded-xl border border-white/10" />
            <p className="text-white font-semibold truncate">{track.title}</p>
            <p className="text-xs text-gray-400 truncate">{track.artist}</p>
            <p className="text-[11px] text-gray-500 uppercase tracking-[0.3em]">
              {library[track.id]?.status ?? 'REMOTE'}
            </p>
          </article>
        ))}
        {!tracks.length && (
          <div className="col-span-full rounded-2xl border border-dashed border-white/20 p-8 text-center text-gray-500">
            No tracks yet. Upload or import to populate your vault.
          </div>
        )}
      </div>
    </section>
  );
};

export default LibraryDashboard;
