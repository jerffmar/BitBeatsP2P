declare module 'webtorrent-hybrid' {
  import WebTorrent from 'webtorrent';

  export interface Torrent extends WebTorrent.Torrent {}
  export interface Client extends WebTorrent.WebTorrent {}

  export default WebTorrent;
}
