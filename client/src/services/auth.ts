export interface User {
  id: string;
  username: string;
  handle: string;
  pixKey?: string;
}

export const login = async (username: string, password: string): Promise<User | null> => {
  // Mock login: Accept any username/password and create a user
  // Replace with real API call to backend
  if (username && password) {
    const user: User = {
      id: '1',
      username,
      handle: `@${username}`,
      pixKey: 'mock-pix-key',
    };
    localStorage.setItem('user', JSON.stringify(user));
    return user;
  }
  throw new Error('Invalid credentials');
};

export const logout = (): void => {
  localStorage.removeItem('user');
};

export const getSession = async (): Promise<User | null> => {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};
