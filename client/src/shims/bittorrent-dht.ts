/**
 * Minimal browser shim for `bittorrent-dht`.
 * WebTorrent imports this module; in browser builds we don't run a native DHT node.
 * The shim provides the minimal API shape (no-op) so bundlers and runtime code don't crash.
 *
 * This intentionally logs a warning when used in-browser; server-side (Node) code
 * should use the real `bittorrent-dht` package.
 */

type Callback = (...args: any[]) => void;

export default class BrowserDHT {
  constructor(_opts?: any) {
    // Warn once
    if (typeof window !== 'undefined' && !(window as any).__BITTORRENT_DHT_SHIM_WARNED) {
      // eslint-disable-next-line no-console
      console.warn('[bittorrent-dht shim] running in browser — DHT disabled (no-op).');
      (window as any).__BITTORRENT_DHT_SHIM_WARNED = true;
    }
  }

  listen(..._args: any[]) {
    // no-op
  }

  destroy(cb?: Callback) {
    if (typeof cb === 'function') cb();
    return Promise.resolve();
  }

  announce(..._args: any[]) {
    // no-op
  }

  lookup(..._args: any[]) {
    // no-op
  }

  on(_ev: string, _cb: Callback) {
    // no-op
    return this;
  }

  once(_ev: string, _cb: Callback) {
    // no-op
    return this;
  }

  off(_ev: string, _cb?: Callback) {
    // no-op
    return this;
  }

  // Provide a compatible "listen" callback signature
  address() {
    return { port: 0, family: 'IPv4', address: '0.0.0.0' };
  }
}
