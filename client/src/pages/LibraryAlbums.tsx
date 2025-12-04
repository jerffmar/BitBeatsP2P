import React from 'react';
import { Track } from '../types';

type Props = {
  tracks: Track[];
  onPlay: (track: Track) => void;
};

export const LibraryAlbums: React.FC<Props> = ({ tracks, onPlay }) => {
  const albums = Array.from(new Set(tracks.map((track) => track.album))).map((album) => ({
    name: album,
    tracks: tracks.filter((track) => track.album === album),
  }));

  return (
    <section className="max-w-5xl mx-auto p-6 md:p-10 space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.35em] text-gray-500">Vault</p>
        <h1 className="text-3xl font-bold text-white mt-1">Albums</h1>
        <p className="text-sm text-gray-400">{albums.length} album{albums.length === 1 ? '' : 's'}</p>
      </header>

      <div className="space-y-3">
        {albums.map((album) => (
          <div key={album.name} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-white font-semibold">{album.name}</p>
            <p className="text-xs text-gray-400">{album.tracks.length} track{album.tracks.length === 1 ? '' : 's'}</p>
          </div>
        ))}
        {!albums.length && (
          <div className="rounded-2xl border border-dashed border-white/20 p-8 text-center text-gray-500">
            No albums yet.
          </div>
        )}
      </div>
    </section>
  );
};
