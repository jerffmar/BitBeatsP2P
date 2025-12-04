// client/src/pages/LibraryDashboard.tsx

import React, { useState, useCallback } from 'react';
import { User, LibraryEntry, Track } from '../types';

interface Props {
  user: User;
  library: Record<string, LibraryEntry>;
  tracks: Track[];
  usageMB: number;
  onImport: (file: File, metadata: { title: string; artist: string; album?: string }) => Promise<void>;
}

const LibraryDashboard: React.FC<Props> = ({ onImport }) => {
  // Dados simulados
  const storageUsed = 3.5; // GB
  const maxQuota = 10; // GB
  const usagePercent = (storageUsed / maxQuota) * 100;

  const quadPreviewData = [
    { title: "Álbuns Curtidos", count: 12, color: "bg-red-500" },
    { title: "Artistas Seguidos", count: 5, color: "bg-blue-500" },
    { title: "Faixas no Vault", count: 45, color: "bg-green-500" },
    { title: "Faixas Enviadas", count: 8, color: "bg-yellow-500" },
  ];

  // Upload widget state
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [uploading, setUploading] = useState(false);

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
  }, []);

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

  const doImport = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      await onImport(selectedFile, { title: title || selectedFile.name, artist: artist || 'Unknown Artist', album });
      // optimistic clear
      setSelectedFile(null);
      setTitle('');
      setArtist('');
      setAlbum('');
      alert('Upload started. Identification will run automatically.');
    } catch (err: any) {
      console.error('Import failed', err);
      alert(`Upload failed: ${err?.message || 'unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold text-white mb-8">Sua Biblioteca BitBeats</h1>

      {/* Storage Usage Bar */}
      <div className="mb-10 bg-gray-800 p-6 rounded-lg shadow-xl">
        <h2 className="text-xl font-semibold text-gray-300 mb-3">Uso de Armazenamento (Seeding)</h2>
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-400">
            {storageUsed} GB de {maxQuota} GB usados
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
            <p className="text-sm text-gray-400 mt-1">Drag & drop an audio file here or browse. The app will analyze and attempt to identify it.</p>
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
                  <div className="flex gap-2 mt-3">
                    <button onClick={doImport} disabled={uploading} className="bg-cyan-500 text-black px-4 py-2 rounded-lg">
                      {uploading ? 'Uploading…' : 'Upload & Identify'}
                    </button>
                    <button onClick={() => { setSelectedFile(null); setTitle(''); setArtist(''); setAlbum(''); }} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg">
                      Cancel
                    </button>
                  </div>
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
          <div key={index} className={`p-6 rounded-lg shadow-xl ${item.color} bg-opacity-20 border-l-4 border-${item.color.split('-')[1]}-500`}>
            <p className="text-sm font-medium text-gray-400">{item.title}</p>
            <p className="text-4xl font-extrabold text-white mt-1">{item.count}</p>
          </div>
        ))}
      </div>

      {/* TODO: Lista de faixas e outras informações da biblioteca */}
    </div>
  );
};

export default LibraryDashboard;
