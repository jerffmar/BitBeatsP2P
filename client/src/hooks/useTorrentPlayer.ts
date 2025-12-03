import { useCallback, useEffect, useRef, useState } from 'react';
import WebTorrent from 'webtorrent';

type TorrentStats = {
  numPeers: number;
  downloadSpeed: number;
  uploadSpeed: number;
  progress: number;
};

const defaultStats: TorrentStats = {
  numPeers: 0,
  downloadSpeed: 0,
  uploadSpeed: 0,
  progress: 0,
};

export const useTorrentPlayer = () => {
  const clientRef = useRef<WebTorrent.Instance>();
  const torrentRef = useRef<WebTorrent.Torrent | null>(null);
  const [stats, setStats] = useState<TorrentStats>(defaultStats);
  const [error, setError] = useState<string | null>(null);
  const [isBuffering, setIsBuffering] = useState(false);

  useEffect(() => {
    clientRef.current = new WebTorrent({
      dht: false,
      tracker: {
        rtcConfig: {
          iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
        },
      },
    });
    return () => clientRef.current?.destroy();
  }, []);

  const play = useCallback((magnetURI: string, audioEl?: HTMLAudioElement | null) => {
    if (!clientRef.current || !audioEl) return;
    setIsBuffering(true);
    setError(null);

    if (torrentRef.current) {
      torrentRef.current.destroy();
      torrentRef.current = null;
    }

    clientRef.current.add(magnetURI, (torrent) => {
      torrentRef.current = torrent;

      const updateStats = () =>
        setStats({
          numPeers: torrent.numPeers,
          downloadSpeed: torrent.downloadSpeed,
          uploadSpeed: torrent.uploadSpeed,
          progress: torrent.progress,
        });

      torrent.on('download', updateStats);
      torrent.on('upload', updateStats);
      torrent.on('wire', updateStats);
      torrent.on('done', () => {
        setIsBuffering(false);
        updateStats();
      });

      const audioFile = torrent.files.find((file) => /\.(mp3|flac|wav|ogg)$/i.test(file.name)) ?? torrent.files[0];
      if (!audioFile) {
        setError('No playable audio file found in torrent.');
        setIsBuffering(false);
        return;
      }

      audioFile.renderTo(audioEl, { autoplay: true }, (err) => {
        if (err) setError(err.message);
        setIsBuffering(false);
      });

      updateStats();
    });
  }, []);

  return { play, stats, error, isBuffering };
};
