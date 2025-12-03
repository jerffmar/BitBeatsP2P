export const initTorrentClient = (): void => {
  // Stub: initialize torrent client
};

export const seedFile = async (file: File, title: string): Promise<string> => {
  // Stub: return magnet link
  return 'magnet:?xt=urn:btih:...';
};

export const addTorrent = async (magnet: string, onProgress?: (progress: number) => void): Promise<{ url: string }> => {
  // Stub: return stream
  return { url: '' };
};
