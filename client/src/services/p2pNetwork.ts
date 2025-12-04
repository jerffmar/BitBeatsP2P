import { discoverLocalPeers as discoverPeersFromTorrent } from './torrent';

const IDENTITY_STORAGE_KEY = 'bitbeats:identity-keypair';

type StoredKeyPair = {
  publicKey: JsonWebKey;
  privateKey: JsonWebKey;
};

let cachedKeys: CryptoKeyPair | null = null;

const subtle = () => {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('WebCrypto is unavailable in this environment.');
  }
  return window.crypto.subtle;
};

const ensureIdentityKeyPair = async (): Promise<CryptoKeyPair> => {
  if (cachedKeys) return cachedKeys;

  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(IDENTITY_STORAGE_KEY) : null;
  if (stored) {
    const parsed = JSON.parse(stored) as StoredKeyPair;
    const [publicKey, privateKey] = await Promise.all([
      subtle().importKey('jwk', parsed.publicKey, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']),
      subtle().importKey('jwk', parsed.privateKey, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']),
    ]);
    cachedKeys = { publicKey, privateKey };
    return cachedKeys;
  }

  const keyPair = await subtle().generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const exported: StoredKeyPair = {
    publicKey: await subtle().exportKey('jwk', keyPair.publicKey),
    privateKey: await subtle().exportKey('jwk', keyPair.privateKey),
  };
  localStorage?.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(exported));
  cachedKeys = keyPair;
  return keyPair;
};

const arrayBufferToBase64 = (buffer: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buffer)));

// Lightweight local messaging via BroadcastChannel for demo/same-origin peers
const BC_CHANNEL = 'bitbeats:local-chat';
let bc: BroadcastChannel | null = null;
const ensureBC = () => {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!bc) bc = new BroadcastChannel(BC_CHANNEL);
  return bc;
};

export const connectToPeer = async (peerId: string) => {
  // For demo: announce our interest to the BroadcastChannel
  const channel = ensureBC();
  if (channel) {
    channel.postMessage({ type: 'connect', peerId, from: (await ensureIdentityKeyPair()).publicKey ? 'local' : 'unknown' });
  }
  console.log('Connecting to peer (demo):', peerId);
  return { success: true };
};

export const sendMessage = async (peerId: string, message: string) => {
  const channel = ensureBC();
  if (channel) {
    channel.postMessage({ type: 'message', to: peerId, message, timestamp: Date.now() });
    return { success: true };
  }
  console.warn('BroadcastChannel not available; sendMessage is a no-op in this environment.');
  return { success: false };
};

export const discoverLocalPeers = async (): Promise<string[]> => {
  // Delegate to torrent service which inspects active torrent wires
  try {
    const list = await discoverPeersFromTorrent();
    return list;
  } catch (err) {
    console.warn('discoverLocalPeers failed, returning empty list', err);
    return [];
  }
};

export const signUpload = async (file: File, fingerprint: string) => {
  const keyPair = await ensureIdentityKeyPair();
  const payload = `${file.name}:${file.size}:${file.type}:${file.lastModified}:${fingerprint}`;
  const signature = await subtle().sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    keyPair.privateKey,
    new TextEncoder().encode(payload),
  );
  const publicKey = await subtle().exportKey('jwk', keyPair.publicKey);
  return `ecdsa-sha256.${arrayBufferToBase64(signature)}.${btoa(JSON.stringify(publicKey))}`;
};
