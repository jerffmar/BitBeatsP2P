import { FormEvent, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Music } from 'lucide-react';
import { api } from '../services/api';

const ACCEPTED_TYPES = ['audio/mpeg', 'audio/flac', 'audio/mp3'];

export const Upload = () => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [duration, setDuration] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    const candidate = files[0];
    if (!ACCEPTED_TYPES.includes(candidate.type)) {
      setError('Only MP3 or FLAC files are allowed.');
      return;
    }
    setFile(candidate);
    setTitle(candidate.name.replace(/\.[^/.]+$/, ''));
    setError(null);
  }, []);

  const onDrop = (evt: React.DragEvent<HTMLLabelElement>) => {
    evt.preventDefault();
    evt.stopPropagation();
    handleFiles(evt.dataTransfer.files);
  };

  const onSubmit = async (evt: FormEvent) => {
    evt.preventDefault();
    if (!file || !title || !artist) {
      setError('File, title, and artist are required.');
      return;
    }

    const formData = new FormData();
    formData.append('trackFile', file);
    formData.append('title', title);
    formData.append('artist', artist);
    formData.append('duration', duration || '0');
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
        <label
          className={`relative border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-brand-accent transition-colors group ${file ? 'has-file' : ''}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
        >
          <input type="file" accept=".mp3,.flac" hidden onChange={(e) => handleFiles(e.target.files)} />
          {file ? (
            <p className="text-white">{file.name}</p>
          ) : (
            <div className="flex flex-col items-center gap-2 text-gray-400 group-hover:text-brand-accent">
              <Music className="w-8 h-8" />
              <span className="text-sm">Drag & drop an MP3/FLAC file or click to browse.</span>
            </div>
          )}
        </label>

        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-brand-dark border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-accent"
        />
        <input
          type="text"
          placeholder="Artist"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          className="w-full bg-brand-dark border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-accent"
        />
        <input
          type="number"
          min="0"
          placeholder="Duration (seconds)"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          className="w-full bg-brand-dark border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-accent"
        />

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