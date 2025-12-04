import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getReleaseById } from '../services/musicBrainz';
import { ReleaseDetail } from '../types';

interface Props {
  swarmTracks: import('../types').Track[];
  onPlay: (track: import('../types').Track) => Promise<void>;
  currentTrackId: string | null;
}

const AlbumPage = (_props: Props) => {
  const { id: mbid } = useParams<{ id: string }>();
  const [release, setRelease] = useState<ReleaseDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (!mbid) {
          setRelease(null);
          setLoading(false);
          return;
        }
        const r = await getReleaseById(mbid);
        if (!cancelled) setRelease(r);
      } catch (err) {
        console.warn('Failed to load release', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mbid]);

  if (loading) return <div className="p-8">Loading album…</div>;
  if (!release) return <div className="p-8">Album not found.</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-start gap-6">
        <div className="w-48 h-48 rounded-lg overflow-hidden bg-gray-900 border border-white/5">
          <img src={release.coverUrl} alt={release.title} className="w-full h-full object-cover" />
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-white">{release.title}</h1>
          <p className="text-sm text-gray-400 mt-2">{release.artistCredit}</p>
          <p className="text-sm text-gray-400 mt-1">{release.date} · {release.status}</p>
          {release.disambiguation && <p className="text-sm text-gray-300 mt-3">{release.disambiguation}</p>}
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-white mb-4">Tracklist</h2>
        <div className="space-y-2">
          {release.tracks && release.tracks.length > 0 ? (
            release.tracks.map((t, idx) => (
              <div key={idx} className="flex items-center justify-between rounded-lg p-3 bg-white/5 border border-white/6">
                <div>
                  <p className="text-sm font-medium text-white">{t.position ? `${t.position}. ` : ''}{t.title}</p>
                  {t.length != null && <p className="text-xs text-gray-400 mt-0.5">{Math.floor((t.length/1000)/60)}:{String(Math.floor((t.length/1000)%60)).padStart(2,'0')}</p>}
                </div>
                <div className="text-xs text-gray-400">Preview</div>
              </div>
            ))
          ) : (
            <div className="text-gray-500">No track information available.</div>
          )}
        </div>
      </section>
    </div>
  );
};

export default AlbumPage;
