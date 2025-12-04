import React from 'react';
import { Track } from '../types';

type Props = {
  tracks: Track[];
  onPlay: (track: Track) => void;
};

export const LibraryArtists: React.FC<Props> = ({ tracks, onPlay }) => {
  const artists = Array.from(new Set(tracks.map((track) => track.artist))).map((artist) => ({
    name: artist,
    tracks: tracks.filter((track) => track.artist === artist),
  }));

  return (
    <section className="max-w-5xl mx-auto p-6 md:p-10 space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.35em] text-gray-500">Vault</p>
        <h1 className="text-3xl font-bold text-white mt-1">Artists</h1>
        <p className="text-sm text-gray-400">{artists.length} artist{artists.length === 1 ? '' : 's'}</p>
      </header>

      <div className="space-y-3">
        {artists.map((artist) => (
          <div key={artist.name} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-white font-semibold">{artist.name}</p>
            <p className="text-xs text-gray-400">{artist.tracks.length} track{artist.tracks.length === 1 ? '' : 's'}</p>
          </div>
        ))}
        {!artists.length && (
          <div className="rounded-2xl border border-dashed border-white/20 p-8 text-center text-gray-500">
            No artists yet.
          </div>
        )}
      </div>
    </section>
  );
};
