import React, { useEffect, useState } from 'react';
import { Loader, Search } from 'lucide-react';
import { IdentifiedTrack } from '../types';
import { identifyTrack, fetchIdentifiedLibrary } from '../services/musicBrainz';

const IdentifyPage: React.FC = () => {
  const [form, setForm] = useState({ title: '', artist: '', duration: '' });
  const [library, setLibrary] = useState<IdentifiedTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLibrary = async () => {
    try {
      const data = await fetchIdentifiedLibrary();
      setLibrary(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadLibrary();
  }, []);

  const handleChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [evt.target.name]: evt.target.value }));
  };

  const handleSubmit = async (evt: React.FormEvent) => {
    evt.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await identifyTrack({
        title: form.title || undefined,
        artist: form.artist || undefined,
        duration: form.duration ? Number(form.duration) : undefined,
      });
      setForm({ title: '', artist: '', duration: '' });
      await loadLibrary();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="max-w-4xl mx-auto p-6 md:p-10 space-y-8">
      <header>
        <p className="text-xs uppercase tracking-[0.4em] text-gray-500">Identify</p>
        <h1 className="text-3xl font-bold text-white">Song Identification</h1>
        <p className="text-sm text-gray-400">Use MusicBrainz to enrich your library automatically.</p>
      </header>

      <form onSubmit={handleSubmit} className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-4">
        <div className="grid md:grid-cols-3 gap-4">
          <input
            name="title"
            value={form.title}
            onChange={handleChange}
            placeholder="Track title"
            className="rounded-2xl bg-black/30 border border-white/10 px-4 py-2 text-sm text-white focus:border-cyan-400 outline-none"
          />
          <input
            name="artist"
            value={form.artist}
            onChange={handleChange}
            placeholder="Artist"
            className="rounded-2xl bg-black/30 border border-white/10 px-4 py-2 text-sm text-white focus:border-cyan-400 outline-none"
          />
          <input
            name="duration"
            value={form.duration}
            onChange={handleChange}
            placeholder="Duration (seconds)"
            className="rounded-2xl bg-black/30 border border-white/10 px-4 py-2 text-sm text-white focus:border-cyan-400 outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-2xl bg-cyan-500 text-black px-5 py-2 font-semibold disabled:opacity-50"
        >
          <Search size={16} />
          {loading ? 'Identifying...' : 'Identify'}
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Identified Library</h2>
          {loading && <Loader className="animate-spin text-cyan-300" size={18} />}
        </div>
        <div className="grid gap-4">
          {library.map((item) => (
            <article key={item.id} className="rounded-3xl border border-white/10 bg-white/5 p-4 flex items-center justify-between">
              <div>
                <p className="text-white font-semibold">{item.title}</p>
                <p className="text-sm text-gray-400">{item.artist}{item.album ? ` · ${item.album}` : ''}</p>
              </div>
              <p className="text-xs text-gray-500">{item.genre ?? 'Unknown genre'}</p>
            </article>
          ))}
          {!library.length && (
            <div className="rounded-3xl border border-dashed border-white/15 p-6 text-center text-gray-500">
              No identified songs yet. Submit a query above to populate this list.
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default IdentifyPage;
