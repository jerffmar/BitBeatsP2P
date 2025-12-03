import React, { useState } from 'react';
import { ArrowRight, Disc, Loader, Lock, User as UserIcon } from 'lucide-react';
import { login, register } from './services/auth';
import { User } from './types';

interface Props {
  onLogin: (user: User) => void;
}

export const AuthScreen: React.FC<Props> = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    const action = isRegistering ? register : login;
    const result = await action(username, password);
    if (result.success && result.user) {
      onLogin(result.user);
    } else {
      setError(result.error ?? 'Authentication failed.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#05050a] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="w-80 h-80 bg-cyan-500/20 rounded-full blur-[160px] absolute -top-20 -left-10" />
        <div className="w-96 h-96 bg-indigo-500/20 rounded-full blur-[180px] absolute bottom-0 right-0" />
      </div>
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <div className="mx-auto w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6">
            <Disc size={40} className="text-cyan-300 animate-spin-slow" />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight">BitBeats</h1>
          <p className="text-gray-400 mt-2">Decentralized, duty-free audio streaming.</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-lg">
          <h2 className="text-xl font-semibold text-white mb-6">{isRegistering ? 'Create Identity' : 'Access Vault'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block text-xs uppercase tracking-[0.25em] text-gray-500">
              Username
              <span className="relative block mt-2">
                <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-cyan-400"
                  placeholder="satoshiseeder"
                  required
                />
              </span>
            </label>
            <label className="block text-xs uppercase tracking-[0.25em] text-gray-500">
              Password
              <span className="relative block mt-2">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-cyan-400"
                  placeholder="••••••••"
                  required
                />
              </span>
            </label>
            {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-cyan-400 hover:bg-cyan-300 text-black font-bold py-3 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-cyan-400/30"
            >
              {loading ? <Loader size={18} className="animate-spin" /> : isRegistering ? 'Initialize Node' : 'Connect'}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>
          <button
            className="mt-6 text-sm text-gray-500 hover:text-cyan-300 transition-colors"
            onClick={() => {
              setError('');
              setIsRegistering((prev) => !prev);
            }}
          >
            {isRegistering ? 'Already have a key? Sign in' : 'Need an identity? Register'}
          </button>
        </div>
      </div>
    </div>
  );
};
