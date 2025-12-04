// Lightweight browser-friendly DHT implementation for same-origin peer discovery.
// Exports a constructible `Client` (named) and default export to match expectations
// of libraries like `torrent-discovery` which do `import { Client as DHT } from 'bittorrent-dht'`.

type Listener = (...args: any[]) => void;

class Emitter {
  private events = new Map<string, Listener[]>();
  setMaxListeners(_n?: number) { return this; }
  on(event: string, fn: Listener) {
    const list = this.events.get(event) ?? [];
    list.push(fn);
    this.events.set(event, list);
    return this;
  }
  once(event: string, fn: Listener) {
    const wrapped: Listener = (...args: any[]) => {
      this.removeListener(event, wrapped);
      fn(...args);
    };
    return this.on(event, wrapped);
  }
  removeListener(event: string, fn?: Listener) {
    if (!fn) { this.events.delete(event); return this; }
    const list = this.events.get(event);
    if (!list) return this;
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
    if (list.length === 0) this.events.delete(event);
    return this;
  }
  emit(event: string, ...args: any[]) {
    const list = (this.events.get(event) || []).slice();
    for (const fn of list) { try { fn(...args); } catch { /* ignore */ } }
    return this;
  }
}

// internal factory to build the DHT-like API
function createDHTImpl(_opts?: any) {
  const emitter = new Emitter();
  const CHANNEL = 'bitbeats:dht';
  const bcSupported = typeof BroadcastChannel !== 'undefined';
  const channel = bcSupported ? new BroadcastChannel(CHANNEL) : null;
  const peerId = (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : `peer-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;

  // local cache: infohash -> Set<peerInfo JSON>
  const cache = new Map<string, Set<string>>();

  const post = (msg: any) => {
    if (channel) channel.postMessage(msg);
  };

  if (channel) {
    channel.onmessage = (ev) => {
      const msg = ev.data;
      if (!msg || !msg.type) return;
      if (msg.type === 'dht-announce' && msg.infoHash && msg.peer) {
        const set = cache.get(msg.infoHash) ?? new Set<string>();
        set.add(JSON.stringify(msg.peer));
        cache.set(msg.infoHash, set);
        setTimeout(() => emitter.emit('peer', msg.peer, msg.infoHash), 0);
      } else if (msg.type === 'dht-lookup' && msg.infoHash && msg.requestId) {
        const peers = Array.from(cache.get(msg.infoHash) ?? []).map((p) => JSON.parse(p));
        if (peers.length) {
          post({ type: 'dht-lookup-response', infoHash: msg.infoHash, requestId: msg.requestId, peers });
        }
      } else if (msg.type === 'dht-lookup-response' && msg.infoHash && msg.requestId) {
        (msg.peers || []).forEach((p: any) => {
          setTimeout(() => emitter.emit('peer', p, msg.infoHash), 0);
        });
      }
    };
  }

  const announce = (infoHash: string, _portOrOpts?: any, cb?: (err?: Error) => void) => {
    try {
      const peer = { id: peerId, url: (typeof location !== 'undefined' ? (location.origin + '/') : ''), ts: Date.now() };
      const set = cache.get(infoHash) ?? new Set<string>();
      set.add(JSON.stringify(peer));
      cache.set(infoHash, set);
      post({ type: 'dht-announce', infoHash, peer });
      if (typeof cb === 'function') setTimeout(() => cb(undefined), 0);
    } catch (err) {
      if (typeof cb === 'function') setTimeout(() => cb(err as Error), 0);
    }
  };

  const lookup = (infoHash: string, cb?: (err: Error | null, peers?: any[]) => void) => {
    const requestId = `${peerId}:${Date.now()}:${Math.random().toString(36).slice(2,8)}`;
    const localPeers = Array.from(cache.get(infoHash) ?? []).map((p) => JSON.parse(p));
    post({ type: 'dht-lookup', infoHash, requestId });
    const timer = setTimeout(() => {
      const remote = Array.from(cache.get(infoHash) ?? []).map((p) => JSON.parse(p));
      const combined = [...new Map([...localPeers, ...remote].map((p: any) => [p.id, p])).values()];
      if (typeof cb === 'function') cb(null, combined);
    }, 150);
    return () => clearTimeout(timer);
  };

  const destroy = (cb?: (err?: any) => void) => {
    try {
      if (channel) channel.close();
      if (typeof cb === 'function') cb();
    } catch (err) {
      if (typeof cb === 'function') cb(err);
    }
  };

  const api: any = {
    setMaxListeners: emitter.setMaxListeners.bind(emitter),
    on: emitter.on.bind(emitter),
    once: emitter.once.bind(emitter),
    removeListener: emitter.removeListener.bind(emitter),
    removeAllListeners: (event?: string) => {
      if (event) emitter.removeListener(event);
      else (emitter as any).events = new Map();
    },
    announce,
    lookup,
    destroy,
    emit: emitter.emit.bind(emitter),
    _cache: cache,
    _peerId: peerId,
  };

  // also expose emitter so consumer code that expects EventEmitter-ish behaviour works
  Object.defineProperty(api, '__emitter', { value: emitter, enumerable: false, writable: false });

  return api;
}

// Named export expected by 'torrent-discovery' and similar packages
export class Client {
  // attach impl methods directly to the instance so `new Client()` behaves like the Node DHT client
  constructor(opts?: any) {
    const impl = createDHTImpl(opts);
    Object.assign(this, impl);
  }
  // keep TypeScript happy by allowing index signature usage
  [key: string]: any;
}

// Default export for other import styles
export default Client;
