declare module 'webtorrent-hybrid' {
  import WebTorrent from 'webtorrent';

  export interface HybridClient extends WebTorrent.Instance {}
  export interface HybridTorrent extends WebTorrent.Torrent {}

  const WebTorrentHybrid: {
    new (): HybridClient;
    (): HybridClient;
  };

  export default WebTorrentHybrid;
}
