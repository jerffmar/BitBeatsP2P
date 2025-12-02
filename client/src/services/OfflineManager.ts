const VAULT_DIR = 'bitbeats_vault';

const withOPFS = async <T>(cb: (dirHandle: FileSystemDirectoryHandle) => Promise<T>) => {
  if (!('storage' in navigator) || !navigator.storage.getDirectory) {
    throw new Error('OPFS is not supported in this browser.');
  }
  const root = await navigator.storage.getDirectory();
  const vault = await root.getDirectoryHandle(VAULT_DIR, { create: true });
  return cb(vault);
};

const saveToVault = async (trackId: string, blob: Blob) =>
  withOPFS(async (dir) => {
    const file = await dir.getFileHandle(`${trackId}.bin`, { create: true });
    const writable = await file.createWritable();
    await writable.write(blob);
    await writable.close();
  });

const getFromVault = async (trackId: string) =>
  withOPFS(async (dir) => {
    try {
      const file = await dir.getFileHandle(`${trackId}.bin`);
      const data = await file.getFile();
      return URL.createObjectURL(data);
    } catch {
      return null;
    }
  });

const deleteFromVault = async (trackId: string) =>
  withOPFS(async (dir) => {
    try {
      await dir.removeEntry(`${trackId}.bin`);
    } catch {
      // ignore missing
    }
  });

const getStorageUsage = async () => {
  if (!navigator.storage?.estimate) return { usedBytes: 0, quotaBytes: 0 };
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usedBytes: usage, quotaBytes: quota };
};

export const OfflineManager = {
  saveToVault,
  getFromVault,
  deleteFromVault,
  getStorageUsage,
};
