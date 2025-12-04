const SESSION_KEY = 'bitbeats:session';

type Credentials = { username: string; password: string };
type SessionUser = { id: string; username: string; handle: string };

export const login = async (credentials: Credentials) => {
  // Implement login logic here, e.g., API call
  console.log('Logging in with:', credentials);
  const mockUser: SessionUser = {
    id: '1',
    username: credentials.username.trim(),
    handle: `@${credentials.username.trim().toLowerCase()}`,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(mockUser));
  return { success: true, token: 'mock-token', user: mockUser };
};

export const logout = async () => {
  // Implement logout logic here
  console.log('Logging out');
  localStorage.removeItem(SESSION_KEY);
  return { success: true };
};

export const getSession = async (): Promise<SessionUser | null> => {
  const raw = localStorage.getItem(SESSION_KEY);
  return raw ? (JSON.parse(raw) as SessionUser) : null;
};
