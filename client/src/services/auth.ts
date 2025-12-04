import axios from 'axios';
import { apiClient } from './api';
import { User } from '../types';

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
  console.log('Logged out');
  localStorage.removeItem(SESSION_KEY);
};

export const getSession = async (): Promise<User | null> => {
  return { id: '1', username: 'Demo User', handle: '@demo' };
};

export const signUpload = async (_file: File, _fingerprint: string) => {
  return { signature: 'mock-sig', timestamp: Date.now() };
};
