// Stub implementations for torrent functionality

export const initTorrentClient = async () => {
  console.log('Torrent client initialized');
};

export const seedFile = async (file: File, _name?: string) => {
  // Stub: simulate seeding and return a magnet URI
  console.log('Seeding file:', file.name);
  return `magnet:?xt=urn:btih:${Math.random().toString(36).substr(2, 9)}&dn=${encodeURIComponent(file.name)}`;
};

export const addTorrent = async (magnetURI: string): Promise<{ url: string; destroy: () => void }> => {
  // Stub: simulate adding torrent and return a blob URL
  console.log('Adding torrent', magnetURI);
  const blob = new Blob(['dummy audio data'], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  return {
    url,
    destroy: () => URL.revokeObjectURL(url),
  };
};

export const discoverLocalPeers = async (): Promise<string[]> => {
  // Stub: return an empty array
  return [];
};
