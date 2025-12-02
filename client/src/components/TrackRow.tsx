import { useEffect, useState } from 'react';
import { TrackDTO, api } from '../services/api';
import { OfflineManager } from '../services/OfflineManager';

type Props = {
  track: TrackDTO;
  index: number;
  onPlay: (track: TrackDTO) => void;
  isActive: boolean;
};

export const TrackRow = ({ track, index, onPlay, isActive }: Props) => {
  const [liked, setLiked] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    OfflineManager.getFromVault(track.id.toString()).then((url) => {
      if (url) {
        setDownloaded(true);
        URL.revokeObjectURL(url);
      }
    });
  }, [track.id]);

  const toggleLike = async () => {
    setLiked((prev) => !prev);
    try {
      await api.toggleLike(track.id);
    } catch {
      setLiked((prev) => !prev);
    }
  };

  const toggleDownload = async () => {
    setIsDownloading(true);
    try {
      if (downloaded) {
        await OfflineManager.deleteFromVault(track.id.toString());
        setDownloaded(false);
        return;
      }
      const response = await fetch(`/api/stream/${track.id}`);
      const blob = await response.blob();
      await OfflineManager.saveToVault(track.id.toString(), blob);
      setDownloaded(true);
    } catch (err) {
      console.error('Vault error', err);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div
      className={`grid grid-cols-[40px_minmax(0,3fr)_1fr_80px_120px] items-center gap-4 py-3 px-4 rounded hover:bg-white/5 ${
        isActive ? 'bg-white/10' : ''
      }`}
    >
      <button
        onClick={() => onPlay(track)}
        className="text-white/70 hover:text-white flex items-center justify-center"
      >
        {isActive ? '❚❚' : index + 1}
      </button>

      <div className="min-w-0">
        <p className="font-medium truncate">{track.title}</p>
        <p className="text-sm text-white/60 truncate">{track.artist}</p>
      </div>

      <span className="text-white/60 truncate">Singles</span>
      <span className="text-white/60 text-sm">{formatDuration(track.duration)}</span>

      <div className="flex items-center gap-3 justify-end">
        <button
          onClick={toggleLike}
          aria-label="Toggle like"
          className={`text-xl ${liked ? 'text-brand' : 'text-white/50'} transition`}
        >
          ♥
        </button>

        <button
          onClick={toggleDownload}
          disabled={isDownloading}
          className="flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 text-sm text-white/80 hover:border-brand hover:text-brand disabled:opacity-50"
        >
          {isDownloading ? (
            <>
              <span className="animate-spin">⏳</span>
              Saving…
            </>
          ) : downloaded ? (
            <>
              <span>✅</span>
              Saved
            </>
          ) : (
            <>
              <span>☁️</span>
              Download
            </>
          )}
        </button>
      </div>
    </div>
  );
};

const formatDuration = (seconds: number) => {
  if (!seconds) return '–';
  const mins = Math.floor(seconds / 60);
  const secs = String(Math.floor(seconds % 60)).padStart(2, '0');
  return `${mins}:${secs}`;
};
