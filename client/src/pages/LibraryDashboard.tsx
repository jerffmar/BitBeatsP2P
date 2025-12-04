// client/src/pages/LibraryDashboard.tsx

import React, { useState, useCallback, useEffect } from 'react';
import clsx from 'clsx';
import { Trash2 } from 'lucide-react';
import { User, LibraryEntry, Track } from '../types';

interface Props {
  user: User;
  library: Record<string, LibraryEntry>;
  tracks: Track[];
  usageMB: number;
  onImport: (file: File, metadata: { title: string; artist: string; album?: string }, onProgress?: (p: number) => void) => Promise<void>;
  onDeleteTrack?: (trackId: string) => Promise<void>;
}

const LibraryDashboard: React.FC<Props> = ({ onImport, tracks, library, usageMB, onDeleteTrack }) => {
  // derive storage from real usageMB prop instead of mock
  const maxQuota = 10; // GB (keep a sane default)
  const storageUsedGB = Number((usageMB / 1024).toFixed(2));
  const usagePercent = Math.min(100, (storageUsedGB / maxQuota) * 100);

  // derive quad preview counts from props instead of static mock numbers
  const albumCount = new Set(tracks.map((t) => t.album || 'Unknown')).size;
  const artistCount = new Set(tracks.map((t) => t.artist || 'Unknown')).size;
  const vaultCount = Object.keys(library).length;
  const uploadedCount = tracks.length;

  const quadPreviewData = [
    { title: "Álbuns Curtidos", count: albumCount, color: "bg-red-500" },
    { title: "Artistas Seguidos", count: artistCount, color: "bg-blue-500" },
    { title: "Faixas no Vault", count: vaultCount, color: "bg-green-500" },
    { title: "Faixas Enviadas", count: uploadedCount, color: "bg-yellow-500" },
  ];

  // Upload widget state
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [view, setView] = useState<'tracks' | 'artists' | 'albums'>('tracks');

  const inferMetadataFromFilename = (name: string) => {
    const base = name.replace(/\.[^/.]+$/, '');
    // try "Artist - Title" or "Title - Artist", prefer Artist - Title
    const parts = base.split(/\s*-\s*/);
    if (parts.length >= 2) {
      // choose the most likely mapping: if first part looks like an artist (has spaces or capitalized words), use it
      return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() };
    }
    return { artist: 'Unknown Artist', title: base.trim() };
  };

  const handleFiles = useCallback(async (file: File) => {
    const inferred = inferMetadataFromFilename(file.name);
    setSelectedFile(file);
    setTitle(inferred.title);
    setArtist(inferred.artist);
    setAlbum('');
    // note: actual upload is triggered by the effect below when selectedFile changes
  }, []);

  useEffect(() => {
    if (!selectedFile) return;
    let cancelled = false;
    (async () => {
      // auto-start import immediately after selection
      setUploadMessage(null);
      setUploading(true);
      setUploadProgress(0);
      try {
        await onImport(
          selectedFile,
          { title: title || selectedFile.name, artist: artist || 'Unknown Artist', album },
          (p: number) => {
            if (cancelled) return;
            setUploadProgress(p);
          },
        );
        if (!cancelled) {
          setUploadMessage('Upload enviado ao servidor e processo de seed iniciado.');
          // optimistic clear (allow user to continue)
          setSelectedFile(null);
          setTitle('');
          setArtist('');
          setAlbum('');
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error('Import failed', err);
          setUploadMessage(typeof err === 'string' ? err : err?.message || 'Upload falhou');
        }
      } finally {
        if (!cancelled) {
          setUploading(false);
          // keep progress visible shortly
          setTimeout(() => setUploadProgress(0), 700);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile]); // only run when a new file is chosen

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await handleFiles(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const browseFile = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await handleFiles(file);
  };

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold text-white mb-8">Sua Biblioteca BitBeats</h1>

      {/* Storage Usage Bar */}
      <div className="mb-10 bg-gray-800 p-6 rounded-lg shadow-xl">
        <h2 className="text-xl font-semibold text-gray-300 mb-3">Uso de Armazenamento (Seeding)</h2>
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-400">
            {storageUsedGB} GB de {maxQuota} GB usados
          </span>
          <span className="text-sm font-bold text-white">{usagePercent.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-3">
          <div
            className="h-3 rounded-full bg-purple-600 transition-all duration-500"
            style={{ width: `${usagePercent}%` }}
          ></div>
        </div>
      </div>

      {/* Upload / Identify Widget */}
      <div className="mb-8">
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className={`w-full border-2 rounded-2xl p-6 flex flex-col md:flex-row gap-6 items-center justify-between transition-colors ${
            dragActive ? 'border-cyan-400 bg-white/5' : 'border-white/10 bg-white/2'
          }`}
        >
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-lg font-semibold text-white">Upload & Identify</h3>
            <p className="text-sm text-gray-400 mt-1">Drop or browse an audio file. The app will upload and attempt to auto-identify it.</p>
            <div className="mt-4 flex items-center gap-3 justify-center md:justify-start">
              <button onClick={browseFile} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg">
                Browse file
              </button>
              <span className="text-xs text-gray-500">or drop file onto this area</span>
            </div>
            <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileChange} />
          </div>

          <div className="w-full md:w-1/2">
            {selectedFile ? (
              <div className="bg-white/5 p-4 rounded-lg">
                <p className="text-sm text-gray-300 mb-2">File: <span className="font-medium text-white">{selectedFile.name}</span></p>
                <div className="grid grid-cols-1 gap-2">
                  <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full px-3 py-2 rounded-md bg-black/20 text-white border border-white/5" />
                  <input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Artist" className="w-full px-3 py-2 rounded-md bg-black/20 text-white border border-white/5" />
                  <input value={album} onChange={(e) => setAlbum(e.target.value)} placeholder="Album (optional)" className="w-full px-3 py-2 rounded-md bg-black/20 text-white border border-white/5" />
                  <div className="flex gap-2 mt-3 items-center">
                    <button onClick={() => { setSelectedFile(null); setTitle(''); setArtist(''); setAlbum(''); }} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg">
                      Cancel
                    </button>
                  </div>

                  {/* upload progress visual */}
                  {uploading && (
                    <div className="mt-3">
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div className="h-2 rounded-full bg-cyan-500 transition-all" style={{ width: `${uploadProgress}%` }} />
                      </div>
                      <div className="text-xs text-gray-400 mt-1">{uploadProgress}%</div>
                    </div>
                  )}

                  {/* inline message */}
                  {uploadMessage && <div className="mt-3 text-sm text-gray-200">{uploadMessage}</div>}
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-400 italic">No file selected.</div>
            )}
          </div>
        </div>
      </div>

      {/* Quad-Preview Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {quadPreviewData.map((item, index) => (
          <div key={index} className={`p-6 rounded-lg shadow-xl ${item.color} bg-opacity-20 border-l-4`} role="region" aria-label={item.title}>
            <p className="text-sm font-medium text-gray-400">{item.title}</p>
            <p className="text-4xl font-extrabold text-white mt-1">{item.count}</p>
          </div>
        ))}
      </div>

      {/* Library lists: Tracks / Artists / Albums */}
      <div className="mt-10">
        <div className="flex gap-2 mb-4">
          <button className={clsx('px-3 py-2 rounded-md', view === 'tracks' ? 'bg-white/10' : 'bg-transparent')} onClick={() => setView('tracks')}>Tracks</button>
          <button className={clsx('px-3 py-2 rounded-md', view === 'artists' ? 'bg-white/10' : 'bg-transparent')} onClick={() => setView('artists')}>Artists</button>
          <button className={clsx('px-3 py-2 rounded-md', view === 'albums' ? 'bg-white/10' : 'bg-transparent')} onClick={() => setView('albums')}>Albums</button>
        </div>

        {view === 'artists' && (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from(new Set(tracks.map((t) => t.artist || 'Unknown'))).map((artistName) => (
              <div key={artistName} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="font-semibold text-white truncate">{artistName}</p>
                <p className="text-xs text-gray-400 mt-1">{tracks.filter((t) => t.artist === artistName).length} tracks</p>
              </div>
            ))}
          </div>
        )}

        {view === 'albums' && (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from(new Set(tracks.map((t) => t.album || 'Unknown'))).map((albumName) => (
              <div key={albumName} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="font-semibold text-white truncate">{albumName}</p>
                <p className="text-xs text-gray-400 mt-1">{tracks.filter((t) => t.album === albumName).length} tracks</p>
              </div>
            ))}
          </div>
        )}

        {view === 'tracks' && (
          <div className="space-y-3 mt-4">
            {tracks.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-lg p-3 bg-white/5 border border-white/6">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{t.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{t.artist} • {t.album}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">{t.sizeMB ? `${t.sizeMB.toFixed(1)} MB` : ''}</span>
                  <button
                    title="Delete track"
                    onClick={async () => {
                      if (!confirm(`Delete "${t.title}" from your library? This will remove the file and stop seeding.`)) return;
                      try {
                        if (typeof onDeleteTrack === 'function') await onDeleteTrack(t.id);
                      } catch (err) {
                        console.error('Failed to delete track', err);
                        alert('Failed to delete track.');
                      }
                    }}
                    className="p-2 rounded-md bg-white/5 hover:bg-red-600/20"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LibraryDashboard;
