import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getArtistById, getReleasesByArtistName } from '../services/musicBrainz';
import { ArtistDetail, ReleaseSummary } from '../types';

interface Props {
  swarmTracks: import('../types').Track[];
  onPlay: (track: import('../types').Track) => Promise<void>;
  currentTrackId: string | null;
}

const ArtistPage = (_props: Props) => {
  const { id: mbid } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [artist, setArtist] = useState<ArtistDetail | null>(null);
  const [mosaic, setMosaic] = useState<ReleaseSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (!mbid) {
          setArtist(null);
          setLoading(false);
          return;
        }
        const a = await getArtistById(mbid);
        if (cancelled) return;
        if (a) {
          setArtist(a);
          // If artist has little descriptive data (no bio), build mosaic from releases by name
          if (!a.bio || (a.releases || []).length === 0) {
            const byName = await getReleasesByArtistName(a.name, 4);
            if (!cancelled) setMosaic(byName.slice(0, 4));
          }
        } else {
          // Artist not found — attempt to build mosaic by searching releases with the MBID as name fallback (rare)
          const byName = await getReleasesByArtistName(mbid, 4);
          if (!cancelled) setMosaic(byName.slice(0, 4));
        }
      } catch (err) {
        console.warn('Failed to load artist page', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mbid]);

  if (loading) return <div className="p-8">Loading artist…</div>;

  const releases = artist?.releases ?? [];

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-start gap-6 mb-6">
        <div className="w-40 h-40 rounded-lg overflow-hidden bg-gray-900 flex items-center justify-center border border-white/5">
          {/* If artist cover exists use first release cover, otherwise mosaic */}
          {artist && (artist.releases && artist.releases[0]?.coverUrl) ? (
            <img src={artist.releases[0].coverUrl} alt={artist.name} className="w-full h-full object-cover" />
          ) : mosaic.length > 0 ? (
            <div className="grid grid-cols-2 gap-1 w-full h-full">
              {mosaic.slice(0, 4).map((r) => (
                <img key={r.mbid} src={r.coverUrl} alt={r.title} className="w-full h-full object-cover" />
              ))}
            </div>
          ) : (
            <div className="text-gray-500 text-sm uppercase tracking-wide">Artist</div>
          )}
        </div>

        <div className="flex-1">
          <h1 className="text-3xl font-bold text-white">{artist?.name ?? 'Unknown Artist'}</h1>
          {artist?.bio ? (
            <p className="text-sm text-gray-300 mt-3">{artist.bio}</p>
          ) : (
            <p className="text-sm text-gray-500 mt-3 italic">No biography available. Showing recent releases instead.</p>
          )}

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => {}}
              className="bg-brand-500 px-4 py-2 rounded-lg text-black font-semibold"
            >
              Donate (PIX)
            </button>
            <button
              onClick={() => navigate(`/search?artist=${encodeURIComponent(artist?.name ?? '')}`)}
              className="bg-white/10 px-4 py-2 rounded-lg text-white"
            >
              Search more
            </button>
          </div>
        </div>
      </div>

      <section className="mt-6">
        <h2 className="text-xl font-semibold text-white mb-3">Albums & Singles</h2>
        {releases.length === 0 ? (
          <div className="text-gray-500">No releases found for this artist.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {releases.map((rel) => (
              <div key={rel.mbid} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="aspect-square rounded-lg overflow-hidden mb-3 bg-gray-900">
                  <img src={rel.coverUrl} alt={rel.title} className="w-full h-full object-cover" />
                </div>
                <p className="font-semibold text-white truncate">{rel.title}</p>
                <p className="text-xs text-gray-400">{rel.date ?? rel.type}</p>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => navigate(`/album/${rel.mbid}`)} className="bg-white/10 px-3 py-2 rounded-md text-white/90">
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default ArtistPage;
