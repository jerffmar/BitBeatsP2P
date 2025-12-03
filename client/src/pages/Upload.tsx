import { FormEvent, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Music } from 'lucide-react';
import { parseBlob } from 'music-metadata-browser';
import { api } from '../services/api';

const ACCEPTED_TYPES = ['audio/mpeg', 'audio/flac', 'audio/mp3'];

export const Upload = () => {
  const [file, setFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState({
    title: '',
    artist: '',
    album: '',
    genre: '',
    duration: 0,
  });
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const navigate = useNavigate();

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    const candidate = files[0];
    if (!ACCEPTED_TYPES.includes(candidate.type)) {
      setError('Only MP3 or FLAC files are allowed.');
      return;
    }
    setFile(candidate);
    setProgress(0);
    setError(null);
    setMetadataLoading(true);
    try {
      const meta = await parseBlob(candidate);
      setMetadata({
        title: meta.common.title ?? candidate.name.replace(/\.[^/.]+$/, ''),
        artist: meta.common.artist ?? 'Unknown Artist',
        album: meta.common.album ?? 'Unknown Album',
        genre: meta.common.genre?.[0] ?? 'Unknown',
        duration: Math.round(meta.format.duration ?? 0),
      });
    } catch {
      setMetadata({
        title: candidate.name.replace(/\.[^/.]+$/, ''),
        artist: 'Unknown Artist',
        album: 'Unknown Album',
        genre: 'Unknown',
        duration: 0,
      });
    } finally {
      setMetadataLoading(false);
    }
  }, []);

  const onDrop = (evt: React.DragEvent<HTMLDivElement>) => {
    evt.preventDefault();
    evt.stopPropagation();
    handleFiles(evt.dataTransfer.files);
  };

  const onSubmit = async (evt: FormEvent) => {
    evt.preventDefault();
    if (!file) {
      setError('Drop an audio file first.');
      return;
    }
    const formData = new FormData();
    formData.append('trackFile', file);
    formData.append('title', metadata.title);
    formData.append('artist', metadata.artist);
    formData.append('album', metadata.album);
    formData.append('genre', metadata.genre);
    formData.append('duration', metadata.duration.toString());
    formData.append('userId', '1');
    formData.append('username', 'demo');

    try {
      setUploading(true);
      await api.upload(formData, setProgress);
      navigate('/');
    } catch {
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="upload-page max-w-xl mx-auto py-8">
      <h1 className="text-2xl font-bold text-gray-100 mb-6">Upload a Track</h1>
      <form className="bg-brand-card p-6 rounded-xl border border-gray-700 shadow-xl space-y-6" onSubmit={onSubmit}>
        <div
          className="relative border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-brand-accent transition-colors group cursor-default"
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
          }}
          onDrop={onDrop}
          onClick={(e) => e.preventDefault()}
        >
          {file ? (
            <div className="space-y-2">
              <p className="text-white font-semibold">{file.name}</p>
              <p className="text-sm text-gray-400">Size: {(file.size / (1024 * 1024)).toFixed(2)} MB</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-gray-400 group-hover:text-brand-accent">
              <Music className="w-8 h-8" />
              <span className="text-sm">Drag & drop an MP3/FLAC file into this drop zone.</span>
            </div>
          )}
        </div>

        {file && (
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-sm">
            <p className="font-semibold text-white mb-2">Detected Metadata</p>
            {metadataLoading ? (
              <p className="text-gray-400">Reading tags…</p>
            ) : (
              <dl className="grid grid-cols-2 gap-2 text-gray-300">
                <div><dt className="text-xs uppercase text-gray-500">Title</dt><dd>{metadata.title}</dd></div>
                <div><dt className="text-xs uppercase text-gray-500">Artist</dt><dd>{metadata.artist}</dd></div>
                <div><dt className="text-xs uppercase text-gray-500">Album</dt><dd>{metadata.album}</dd></div>
                <div><dt className="text-xs uppercase text-gray-500">Genre</dt><dd>{metadata.genre}</dd></div>
                <div><dt className="text-xs uppercase text-gray-500">Duration</dt><dd>{metadata.duration ? `${metadata.duration}s` : 'Unknown'}</dd></div>
              </dl>
            )}
          </div>
        )}

        {uploading && (
          <div className="relative h-2 rounded-full bg-gray-700 overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 bg-brand-accent transition-all duration-300" style={{ width: `${progress}%` }} />
            <span className="text-xs text-center text-white block pt-2">{progress}%</span>
          </div>
        )}

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={uploading}
          className="w-full bg-brand-accent text-brand-dark font-bold py-3 px-6 rounded hover:bg-sky-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? 'Uploading…' : 'Upload Track'}
        </button>
      </form>
    </div>
  );
};