// client/src/hooks/useTorrentPlayer.ts

import { useState, useEffect, useRef, useCallback } from 'react';
import WebTorrent from 'webtorrent';
import { OPFSManager } from '../services/OPFSManager';

// Inicializa o cliente WebTorrent (apenas no navegador)
const client = new WebTorrent({
  dht: false,
  tracker: {
    rtcConfig: {
      iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
    },
  },
});

client.on('error', (err) => {
  console.error('WebTorrent Client Error:', err.message);
});

interface UseTorrentPlayerResult {
  isPlaying: boolean;
  isBuffering: boolean;
  progress: number; // 0 a 100
  play: (magnetURI: string, trackId: number) => void;
  pause: () => void;
  downloadToVault: (magnetURI: string, trackId: number) => Promise<void>;
}

export const useTorrentPlayer = (): UseTorrentPlayerResult => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentTorrentRef = useRef<WebTorrent.Torrent | null>(null);
  const opfsManager = OPFSManager.getInstance();

  // Cria o elemento de áudio uma vez
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.onplay = () => setIsPlaying(true);
    audioRef.current.onpause = () => setIsPlaying(false);
    audioRef.current.onwaiting = () => setIsBuffering(true);
    audioRef.current.onplaying = () => setIsBuffering(false);
    audioRef.current.ontimeupdate = () => {
      if (audioRef.current && audioRef.current.duration) {
        setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
      }
    };

    return () => {
      client.destroy();
    };
  }, []);

  const stopCurrentPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    if (currentTorrentRef.current) {
      currentTorrentRef.current.destroy();
      currentTorrentRef.current = null;
    }
    setIsPlaying(false);
    setIsBuffering(false);
    setProgress(0);
  }, []);

  const play = useCallback(async (magnetURI: string, trackId: number) => {
    stopCurrentPlayback();

    // 1. Tenta reproduzir do Vault (OPFS)
    const opfsData = await opfsManager.getTrack(trackId);
    if (opfsData) {
      console.log('Reproduzindo do Vault (OPFS).');
      const blob = new Blob([opfsData], { type: 'audio/mp3' }); // Assumindo mp3
      audioRef.current!.src = URL.createObjectURL(blob);
      audioRef.current!.play();
      return;
    }

    // 2. Reprodução P2P/WebSeed
    setIsBuffering(true);
    console.log('Iniciando reprodução P2P/WebSeed...');

    client.add(magnetURI, (torrent) => {
      currentTorrentRef.current = torrent;
      
      torrent.on('error', (err) => {
        console.error('Torrent Error:', err.message);
        setIsBuffering(false);
      });

      // Assume que o arquivo de música é o primeiro arquivo no torrent
      const file = torrent.files.find(f => f.name.endsWith('.mp3') || f.name.endsWith('.wav')); 
      
      if (file) {
        file.renderTo(audioRef.current!, (err) => {
          if (err) {
            console.error('Erro ao renderizar o arquivo para o áudio:', err);
            setIsBuffering(false);
            return;
          }
          audioRef.current!.play();
        });
      } else {
        console.error('Nenhum arquivo de áudio encontrado no torrent.');
        setIsBuffering(false);
      }
    });
  }, [stopCurrentPlayback, opfsManager]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
  }, []);

  const downloadToVault = useCallback(async (magnetURI: string, trackId: number) => {
    return new Promise<void>((resolve, reject) => {
      console.log(`Iniciando download para o Vault da faixa ${trackId}...`);
      
      // Cria um novo cliente temporário para o download, para não interferir na reprodução
      const downloadClient = new WebTorrent();
      
      downloadClient.add(magnetURI, (torrent) => {
        torrent.on('error', (err) => {
          console.error('Download Torrent Error:', err.message);
          downloadClient.destroy();
          reject(err);
        });

        torrent.on('done', async () => {
          console.log('Download concluído. Salvando no OPFS...');
          const file = torrent.files.find(f => f.name.endsWith('.mp3') || f.name.endsWith('.wav'));
          
          if (file) {
            file.getBuffer(async (err, buffer) => {
              if (err) {
                console.error('Erro ao obter buffer do arquivo:', err);
                downloadClient.destroy();
                return reject(err);
              }
              
              try {
                await opfsManager.saveTrack(trackId, buffer.buffer);
                console.log(`Faixa ${trackId} salva com sucesso no Vault.`);
                downloadClient.destroy();
                resolve();
              } catch (opfsError) {
                console.error('Erro ao salvar no OPFS:', opfsError);
                downloadClient.destroy();
                reject(opfsError);
              }
            });
          } else {
            downloadClient.destroy();
            reject(new Error('Nenhum arquivo de áudio encontrado no torrent para download.'));
          }
        });
      });
    });
  }, [opfsManager]);

  return {
    isPlaying,
    isBuffering,
    progress,
    play,
    pause,
    downloadToVault,
  };
};
