import { useCallback, useEffect, useRef, useState } from 'react';
import WebTorrent from 'webtorrent';

export const useTorrentPlayer = (magnetURI: string | null) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const clientRef = useRef<WebTorrent.Instance>();
  const [buffering, setBuffering] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!clientRef.current) clientRef.current = new WebTorrent();
    return () => clientRef.current?.destroy();
  }, []);

  useEffect(() => {
    if (!magnetURI || !clientRef.current || !audioRef.current) return;

    setBuffering(true);
    setProgress(0);
    let torrent: WebTorrent.Torrent | null = null;
    let cancelled = false;

    const client = clientRef.current;
    client.add(magnetURI, (t) => {
      if (cancelled) return;
      torrent = t;

      const audioFile =
        t.files.find((file) => /\.(mp3|flac|wav|ogg)$/i.test(file.name)) ?? t.files[0];
      if (!audioFile) {
        setBuffering(false);
        return;
      }

      audioFile.renderTo(audioRef.current as HTMLAudioElement, { autoplay: true }, (err) => {
        if (err) console.error('WebTorrent render error', err);
      });

      t.on('download', () => {
        if (t.length) setProgress(t.downloaded / t.length);
      });
      t.on('done', () => setProgress(1));
      setBuffering(false);
    });

    return () => {
      cancelled = true;
      setPlaying(false);
      setProgress(0);
      setBuffering(false);
      if (torrent) torrent.destroy();
      client.remove(magnetURI).catch(() => null);
    };
  }, [magnetURI]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setPlaying(true);
    const handlePause = () => setPlaying(false);
    const handleWaiting = () => setBuffering(true);
    const handleCanPlay = () => setBuffering(false);

    audio.addEventListener('playing', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('playing', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, []);

  const play = useCallback(() => audioRef.current?.play(), []);
  const pause = useCallback(() => audioRef.current?.pause(), []);

  return { audioRef, buffering, playing, progress, play, pause };
};