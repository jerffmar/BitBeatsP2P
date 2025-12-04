import React, { useState } from 'react';
import { LogIn } from 'lucide-react';

interface AuthScreenProps {
  onLogin: (user: { id: string; username: string; handle: string }) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setLoading(true);
    // Simulate login
    setTimeout(() => {
      onLogin({
        id: '1',
        username: username.trim(),
        handle: `@${username.trim().toLowerCase()}`,
      });
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-[#05050a] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#070709] border border-white/10 rounded-3xl p-8 shadow-2xl">
        <div className="text-center mb-8"></div>
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
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || !username.trim()}
            className="w-full bg-cyan-500 text-black font-semibold py-3 px-6 rounded-xl hover:bg-cyan-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Joining...' : 'Join Swarm'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">
            This is a demo. No real authentication is performed.
          </p>
        </div>
      </div>
    </div>
  );
};
