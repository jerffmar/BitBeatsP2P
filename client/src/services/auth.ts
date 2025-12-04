import axios from 'axios';
import { apiClient } from './api';

const SESSION_KEY = 'bitbeats:session';

type Credentials = { username: string; password: string };
type SessionUser = { id: string; username: string; handle: string };
type StoredSession = { token: string; user: SessionUser };

const sha256Hex = async (input: string) => {
  const cryptoApi = (typeof window !== 'undefined' ? window.crypto : globalThis.crypto) as Crypto;
  if (!cryptoApi?.subtle) {
    throw new Error('Secure hashing is not supported in this environment.');
  }
  const data = new TextEncoder().encode(input);
  const hashBuffer = await cryptoApi.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

const persistSession = (session: StoredSession) => localStorage.setItem(SESSION_KEY, JSON.stringify(session));

const authRequest = async (path: string, credentials: Credentials) => {
  try {
    const normalizedUsername = credentials.username.trim().toLowerCase();
    const digest = await sha256Hex(`${normalizedUsername}:${credentials.password}`);
    const { data } = await apiClient.post(path, {
      username: normalizedUsername,
      passwordHash: digest,
    });
    if (!data?.user || !data?.token) {
      throw new Error('Invalid response from server.');
    }
    const session: StoredSession = { token: data.token, user: data.user };
    persistSession(session);
    return session.user;
  } catch (error) {
    const message = axios.isAxiosError(error)
      ? (error.response?.data?.message as string) || 'Authentication failed.'
      : (error as Error).message;
    throw new Error(message);
  }
};

export const register = (credentials: Credentials) => authRequest('/api/auth/register', credentials);
export const login = (credentials: Credentials) => authRequest('/api/auth/login', credentials);

export const logout = async () => {
  localStorage.removeItem(SESSION_KEY);
};

export const getSession = async (): Promise<SessionUser | null> => {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as StoredSession;
    return stored.user;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
};
