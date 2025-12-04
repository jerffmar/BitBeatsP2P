const VAULT_KEY = 'bitbeats:vault';

type VaultEntry = {
  id: string;
  data: string; // base64 for demo purposes
  size: number;
  updatedAt: number;
};

const readVault = (): Record<string, VaultEntry> => {
  const raw = localStorage.getItem(VAULT_KEY);
  return raw ? (JSON.parse(raw) as Record<string, VaultEntry>) : {};
};

const writeVault = (vault: Record<string, VaultEntry>) => {
  localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
};

export const saveToVault = async (trackId: string, buffer: ArrayBuffer) => {
  const vault = readVault();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  vault[trackId] = {
    id: trackId,
    data: btoa(binary),
    size: buffer.byteLength,
    updatedAt: Date.now(),
  };
  writeVault(vault);
  return buffer.byteLength;
};

export const loadFromVault = async (trackId: string): Promise<Blob | null> => {
  const entry = readVault()[trackId];
  if (!entry) return null;
  const binary = atob(entry.data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes.buffer]);
};

export const getStoredBytes = async (): Promise<number> => {
  const vault = readVault();
  return Object.values(vault).reduce((sum, entry) => sum + entry.size, 0);
};

// Optional generic helpers retained for other callers
export const setItem = (key: string, value: string) => localStorage.setItem(key, value);
export const getItem = (key: string) => localStorage.getItem(key);
export const removeItem = (key: string) => localStorage.removeItem(key);
