// Minimal browser shim for bittorrent-dht to satisfy WebTorrent's runtime checks.
// This does NOT implement a full DHT — it provides EventEmitter-like methods and noop lifecycle helpers.

type Listener = (...args: any[]) => void;

class SimpleEmitter {
  private events: Map<string, Listener[]> = new Map();

  setMaxListeners(_n?: number) {
    // noop — browsers don't need Node's listener limit
    return this;
  }

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
    if (!fn) {
      this.events.delete(event);
      return this;
    }
    const list = this.events.get(event);
    if (!list) return this;
    const idx = list.indexOf(fn);
    if (idx >= 0) list.splice(idx, 1);
    if (list.length === 0) this.events.delete(event);
    return this;
  }

  emit(event: string, ...args: any[]) {
    const list = (this.events.get(event) || []).slice();
    for (const fn of list) {
      try { fn(...args); } catch (e) { /* swallow errors from listeners */ }
    }
    return this;
  }
}

/**
 * Export default factory to match CommonJS/ES expectations.
 * WebTorrent does `new DHT(opts)` so export a constructor-like function.
 */
export default function DHTShim(_opts?: any) {
  // Return an object with the minimal API WebTorrent expects from a DHT instance.
  const emitter = new SimpleEmitter();

  // Provide commonly accessed lifecycle methods as no-ops or proxies to emitter.
  const api: any = {
    setMaxListeners: emitter.setMaxListeners.bind(emitter),
    on: emitter.on.bind(emitter),
    once: emitter.once.bind(emitter),
    removeListener: emitter.removeListener.bind(emitter),
    removeAllListeners: (event?: string) => {
      if (event) emitter.removeListener(event);
      else { /* clear all */ (emitter as any).events = new Map(); }
    },
    destroy: (cb?: (err?: any) => void) => {
      // no persistent resources, just invoke callback
      try {
        (emitter as any).events = new Map();
        if (typeof cb === 'function') cb();
      } catch (err) {
        if (typeof cb === 'function') cb(err);
      }
    },
    listen: (..._args: any[]) => {
      // noop in browser shim
    },
    announce: (..._args: any[]) => {
      // noop stub
    },
    // in case code checks for `ready` event, allow emit externally
    emit: emitter.emit.bind(emitter),
  };

  return api;
}
