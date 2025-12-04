// Minimal OPFS/File System Access API wrapper with localStorage fallback

const VAULT_KEY = 'bitbeats:vault';

type VaultEntry = {
  id: string;
  data?: string; // base64 for fallback
  size: number;
  updatedAt: number;
};

const supportsFSAccess = typeof (navigator as any)?.storage?.getDirectory === 'function' || typeof (window as any).showDirectoryPicker === 'function';

let opfsRootHandle: FileSystemDirectoryHandle | null = null;

const ensureOpfsRoot = async (): Promise<FileSystemDirectoryHandle | null> => {
  if (!supportsFSAccess) return null;
  if (opfsRootHandle) return opfsRootHandle;
  try {
    // Chrome (Origin Private File System)
    if (typeof (navigator as any).storage?.getDirectory === 'function') {
      opfsRootHandle = await (navigator as any).storage.getDirectory();
      return opfsRootHandle;
    }
    // Fallback to user prompt if available
    if (typeof (window as any).showDirectoryPicker === 'function') {
      opfsRootHandle = await (window as any).showDirectoryPicker();
      return opfsRootHandle;
    }
  } catch (err) {
    console.warn('OPFS/FSAccess init failed:', err);
    opfsRootHandle = null;
  }
  return null;
};

const readVaultFallback = (): Record<string, VaultEntry & { data?: string }> => {
  const raw = localStorage.getItem(VAULT_KEY);
  return raw ? (JSON.parse(raw) as Record<string, VaultEntry & { data?: string }>) : {};
};

const writeVaultFallback = (vault: Record<string, VaultEntry & { data?: string }>) => {
  localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
};

// Save buffer to vault: prefer OPFS, otherwise base64 fallback
export const saveToVault = async (trackId: string, buffer: ArrayBuffer): Promise<number> => {
  const size = buffer.byteLength;
  const root = await ensureOpfsRoot();
  if (root) {
    try {
      const fh = await root.getFileHandle(`bitbeats-${trackId}`, { create: true });
      const writable = await (fh as any).createWritable();
      await writable.write(buffer);
      await writable.close();
      return size;
    } catch (err) {
      console.warn('OPFS write failed, falling back to localStorage', err);
    }
  }

  // fallback to base64 storage
  const vault = readVaultFallback();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  // chunking to avoid potential call stack issues on large buffers
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode.apply(null, Array.from(sub));
  }
  vault[trackId] = {
    id: trackId,
    data: btoa(binary),
    size,
    updatedAt: Date.now(),
  };
  writeVaultFallback(vault);
  return size;
};

export const loadFromVault = async (trackId: string): Promise<Blob | null> => {
  const root = await ensureOpfsRoot();
  if (root) {
    try {
      const fh = await root.getFileHandle(`bitbeats-${trackId}`);
      const file = await (fh as any).getFile();
      return file;
    } catch (err) {
      // continue to fallback
    }
  }
  const entry = readVaultFallback()[trackId];
  if (!entry || !entry.data) return null;
  const binary = atob(entry.data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes.buffer]);
};

export const getStoredBytes = async (): Promise<number> => {
  const root = await ensureOpfsRoot();
  if (root) {
    try {
      // iterate directory (best-effort, OPFS directory); this may be slow
      let total = 0;
      for await (const [name, handle] of (root as any).entries?.() ?? []) {
        if ((handle as FileSystemFileHandle).getFile) {
          try {
            const file = await (handle as FileSystemFileHandle).getFile();
            total += file.size || 0;
          } catch {}
        }
      }
      if (total) return total;
    } catch (err) {
      console.warn('OPFS getStoredBytes failed, falling back', err);
    }
  }
  const vault = readVaultFallback();
  return Object.values(vault).reduce((sum, entry) => sum + (entry.size ?? 0), 0);
};

// keep generic key helpers
export const setItem = (key: string, value: string) => localStorage.setItem(key, value);
export const getItem = (key: string) => localStorage.getItem(key);
export const removeItem = (key: string) => localStorage.removeItem(key);
