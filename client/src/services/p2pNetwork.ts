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

export const connectToPeer = async (peerId: string) => {
  // Implement P2P connection logic here
  console.log('Connecting to peer:', peerId);
  return { success: true };
};

export const sendMessage = async (peerId: string, message: string) => {
  // Implement message sending logic here
  console.log('Sending message to peer:', peerId, message);
  return { success: true };
};

export const discoverLocalPeers = async (): Promise<number> => {
  // Mock discovery: pretend between 3–8 peers available
  const peers = 3 + Math.floor(Math.random() * 6);
  console.log('Discovered peers:', peers);
  return peers;
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
