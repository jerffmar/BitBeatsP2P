const KEY_STORAGE = 'bitbeats.identityKeyPair';
const KEY_ALGO: EcKeyGenParams = { name: 'ECDSA', namedCurve: 'P-256' };
const SIGN_ALGO = { name: 'ECDSA', hash: 'SHA-256' };
const encoder = new TextEncoder();

type StoredKeyPair = {
  privateKey: JsonWebKey;
  publicKey: JsonWebKey;
};

async function ensureIdentityKeyPair(): Promise<CryptoKeyPair> {
  const stored = localStorage.getItem(KEY_STORAGE);
  if (stored) {
    const parsed = JSON.parse(stored) as StoredKeyPair;
    const privateKey = await crypto.subtle.importKey(
      'jwk',
      parsed.privateKey,
      KEY_ALGO,
      true,
      ['sign'],
    );
    const publicKey = await crypto.subtle.importKey(
      'jwk',
      parsed.publicKey,
      KEY_ALGO,
      true,
      ['verify'],
    );
    return { privateKey, publicKey };
  }

  const keyPair = await crypto.subtle.generateKey(KEY_ALGO, true, ['sign', 'verify']);
  const exportedPrivate = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
  const exportedPublic = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  localStorage.setItem(
    KEY_STORAGE,
    JSON.stringify({ privateKey: exportedPrivate, publicKey: exportedPublic }),
  );
  return keyPair;
}

const bufferToHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

const bufferToBase64 = (buffer: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buffer)));

export type UploadSignature = {
  algorithm: 'ECDSA_P256_SHA256';
  fingerprint: string;
  fileHash: string;
  signature: string;
  publicKey: JsonWebKey;
  createdAt: string;
};

export async function signUpload(file: File, fingerprint: string): Promise<UploadSignature> {
  const { privateKey, publicKey } = await ensureIdentityKeyPair();
  const fileBuffer = await file.arrayBuffer();
  const fileHashBuffer = await crypto.subtle.digest('SHA-256', fileBuffer);

  const payload = encoder.encode(`${fingerprint}:${bufferToHex(fileHashBuffer)}`);
  const signatureBuffer = await crypto.subtle.sign(SIGN_ALGO, privateKey, payload);

  const publicKeyJwk = await crypto.subtle.exportKey('jwk', publicKey);

  return {
    algorithm: 'ECDSA_P256_SHA256',
    fingerprint,
    fileHash: bufferToHex(fileHashBuffer),
    signature: bufferToBase64(signatureBuffer),
    publicKey: publicKeyJwk,
    createdAt: new Date().toISOString(),
  };
}

export const discoverLocalPeers = async (): Promise<number> => {
  // Stub: return peer count
  return 0;
};
