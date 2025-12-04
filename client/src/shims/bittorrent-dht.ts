/**
 * Minimal browser shim for `bittorrent-dht`.
 * Exposes a named `Client` export (used by torrent-discovery) and a default export.
 * All methods are no-op in the browser to avoid build/runtime failures.
 */

type Callback = (...args: any[]) => void;

class BrowserDHT {
  constructor(_opts?: any) {
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

  address() {
    return { port: 0, family: 'IPv4', address: '0.0.0.0' };
  }
}

// Named export expected by `torrent-discovery`
export class Client extends BrowserDHT {}

// Default export for other consumers
export default BrowserDHT;
