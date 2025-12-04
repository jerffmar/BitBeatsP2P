import WebTorrent from 'webtorrent';

// Stub implementations for torrent functionality

let client: WebTorrent.Instance | null = null;

export const initTorrentClient = async () => {
  if (client) return;
  if (typeof window === 'undefined') {
    console.warn('initTorrentClient: running outside browser, skipping initialization.');
    return;
  }

  try {
    // Disable client-side DHT and LSD in browser; server will run hybrid mode + DHT.
    // This prevents webtorrent from instantiating bittorrent-dht and avoids runtime shim issues.
    client = new WebTorrent({
      // @ts-ignore - some typings may not include these browser-friendly options
      dht: false,
      lsd: false,
      // keep trackers/webSeeds enabled (server provides webseed fallback)
      tracker: true,
      webSeeds: true,
    } as any);

    client.on('error', (err) => console.error('[torrent] client error', err));
    console.log('Torrent client initialized (DHT disabled, LSD disabled).');
  } catch (err) {
    console.warn('initTorrentClient: failed to initialize WebTorrent client, disabling torrent features.', err);
    client = null;
    throw err;
  }
};

export const seedFile = async (file: File, name?: string): Promise<string> => {
  await initTorrentClient();
  if (!client) throw new Error('Torrent client not available');
  return new Promise<string>((resolve, reject) => {
    try {
      client!.seed(file, { name: name ?? file.name }, (torrent) => {
        // When seeding in-browser the torrent.magnetURI is available immediately.
        console.log('[torrent] seeded', torrent.infoHash);
        resolve(torrent.magnetURI);
      });
    } catch (err) {
      reject(err);
    }
  });
};

export const addTorrent = async (magnetURI: string): Promise<{ url: string; destroy: () => void }> => {
  await initTorrentClient();
  if (!client) throw new Error('Torrent client not available');
  return new Promise((resolve, reject) => {
    try {
      // In browser we avoid DHT lookups; prefer trackers/webseeds. Provide no extra announce to avoid DHT fallback.
      const torrent = client!.add(magnetURI, { announce: [], store: 'memory' } as any, () => {
        const file = torrent.files && torrent.files[0];
        if (!file) return reject(new Error('Torrent contains no files'));
        // Try WebTorrent's getBlobURL helper (browser-only)
        try {
          (file as any).getBlobURL((err: any, url: string) => {
            if (err) return reject(err);
            resolve({
              url,
              destroy: () => {
                try { URL.revokeObjectURL(url); } catch { /* ignore */ }
                try { client!.remove(torrent.infoHash); } catch { /* ignore */ }
              },
            });
          });
        } catch {
          // Fallback: use getBlob then createObjectURL
          (file as any).getBlob((blob: Blob) => {
            const url = URL.createObjectURL(blob);
            resolve({
              url,
              destroy: () => {
                try { URL.revokeObjectURL(url); } catch { /* ignore */ }
                try { client!.remove(torrent.infoHash); } catch { /* ignore */ }
              },
            });
          });
        }
      });
      torrent.on('error', (err) => {
        console.error('[torrent] torrent error', err);
      });
    } catch (err) {
      reject(err);
    }
  });
};

export const discoverLocalPeers = async (): Promise<string[]> => {
  // No DHT-based discovery in the browser — enumerate active torrent wires only.
  await initTorrentClient().catch(() => null);
  if (!client) return [];
  const peers = new Set<string>();
  client.torrents.forEach((t) => {
    (t as any).wires?.forEach((wire: any) => {
      // wire.peerId or remoteAddress may be available depending on environment
      const id = wire.peerId || wire.remoteAddress || wire.peerIdHex || `${wire.remoteAddress ?? ''}`;
      if (id) peers.add(String(id));
    });
  });
  return Array.from(peers);
};
