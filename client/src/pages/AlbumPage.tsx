import React from 'react';
import { useParams } from 'react-router-dom';
import { Track } from '../types';

type Props = {
  swarmTracks: Track[];
  onPlay: (track: Track) => void;
  currentTrackId: number | null;
};

const AlbumPage: React.FC<Props> = ({ swarmTracks, onPlay, currentTrackId }) => {
  const { id } = useParams();
  const tracks = swarmTracks.filter((track) => track.albumId === id);
  const albumName = tracks[0]?.album || 'Unknown album';

  return (
    <section className="max-w-4xl mx-auto p-6 md:p-10 space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.4em] text-gray-500">Album</p>
        <h1 className="text-4xl font-bold text-white">{albumName}</h1>
        <p className="text-sm text-gray-400">{tracks.length} track{tracks.length === 1 ? '' : 's'} in swarm</p>
      </div>

      {tracks.length === 0 ? (
        <div className="text-center text-gray-500 border border-white/10 rounded-2xl py-16">No torrents for this album yet.</div>
      ) : (
        <div className="space-y-3">
          {tracks.map((track, index) => {
            const isActive = currentTrackId === track.id;
            return (
              <button
                key={track.id}
                onClick={() => onPlay(track)}
                className={`w-full text-left rounded-2xl border px-5 py-4 transition ${
                  isActive ? 'border-cyan-400/60 bg-cyan-400/10' : 'border-white/10 bg-white/5 hover:border-white/30'
                }`}
              >
                <p className="text-xs text-gray-500 mb-1">#{index + 1}</p>
                <p className="text-white font-semibold">{track.title}</p>
                <p className="text-xs text-gray-400">{track.artist}</p>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default AlbumPage;
