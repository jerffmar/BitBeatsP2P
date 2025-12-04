import React, { useState } from 'react';
import { LogIn } from 'lucide-react';
import { login as loginUser, register as registerUser } from '../services/auth';

interface AuthScreenProps {
  onLogin: (user: { id: string; username: string; handle: string }) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    setError(null);
    try {
      const user =
        mode === 'login'
          ? await loginUser({ username, password })
          : await registerUser({ username, password });
      onLogin(user);
    } catch (err) {
      setError((err as Error).message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#05050a] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#070709] border border-white/10 rounded-3xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cyan-500/40 to-indigo-600/40 border border-white/5 flex items-center justify-center">
            <LogIn className="text-cyan-200" size={24} />
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome to BitBeats</h1>
          <p className="text-gray-400 mt-2">Enter your username to join the swarm</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400"
              required
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            className="w-full bg-cyan-500 text-black font-semibold py-3 px-6 rounded-xl hover:bg-cyan-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>

        <div className="mt-8 text-center space-y-2">
          <p className="text-xs text-gray-500">
            Credentials are SHA-256 hashed client-side before leaving your device.
          </p>
          <button
            type="button"
            onClick={() => {
              setMode((prev) => (prev === 'login' ? 'register' : 'login'));
              setError(null);
            }}
            className="text-xs text-cyan-300 hover:text-cyan-200"
          >
            {mode === 'login' ? 'Need an account? Register instead.' : 'Already have an account? Log in.'}
          </button>
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">
            This is a demo. No real authentication is performed.
          </p>
        </div>
      </div>
    </div>
  );
};
