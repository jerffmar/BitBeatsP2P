import WebTorrent from 'webtorrent';

const TRACKERS = [
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.btorrent.xyz',
  'wss://tracker.fastcast.nz',
  'wss://tracker.magnetbt.net',
];

let client: WebTorrent.Instance | null = null;

const ensureClient = (): WebTorrent.Instance => {
  if (typeof window === 'undefined') {
    throw new Error('WebTorrent client is only available in the browser.');
  }
  if (!client) {
    client = new WebTorrent({
      dht: false,
      tracker: {
        announce: TRACKERS,
        rtcConfig: {
          iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
        },
      },
    });
    client.on('error', (err) => console.error('[WebTorrent]', err.message));
  }
  return client;
};

export const initTorrentClient = (): void => {
  try {
    ensureClient();
  } catch {
    // ignore during SSR/build
  }
};

export const seedFile = async (file: File, title: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const wt = ensureClient();
    wt.seed(
      file,
      {
        name: title,
        announce: TRACKERS,
      },
      (torrent) => {
        torrent.on('error', reject);
        resolve(torrent.magnetURI);
      },
    );
  });

export const addTorrent = async (
  magnet: string,
  onProgress?: (progress: number) => void,
): Promise<{ url: string; destroy: () => void }> =>
  new Promise((resolve, reject) => {
    const wt = ensureClient();

    const torrent = wt.add(
      magnet,
      {
        announce: TRACKERS,
      },
      () => {
        const audioFile =
          torrent.files.find((file) => /\.(mp3|flac|wav|ogg|m4a)$/i.test(file.name)) ??
          torrent.files[0];

        if (!audioFile) {
          torrent.destroy();
          return reject(new Error('No playable audio file found inside torrent.'));
        }

        audioFile.getBlobURL((err, url) => {
          if (err || !url) {
            torrent.destroy();
            return reject(err ?? new Error('Unable to create blob URL.'));
          }

          torrent.on('download', () => {
            if (!onProgress) return;
            onProgress(torrent.progress);
          });

          resolve({
            url,
            destroy: () => {
              if (url) URL.revokeObjectURL(url);
              torrent.destroy();
            },
          });
        });
      },
    );

    torrent.on('error', (err) => {
      torrent.destroy();
      reject(err);
    });
  });
