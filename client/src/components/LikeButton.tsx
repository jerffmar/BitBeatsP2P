import React, { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';

interface Props {
  entityId: string;
  entityType: 'track' | 'album' | 'artist';
}

const STORAGE_KEY = 'bitbeats-likes';

const getStore = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, boolean>;
  } catch {
    return {};
  }
};

const persist = (data: Record<string, boolean>) => localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

export const LikeButton: React.FC<Props> = ({ entityId }) => {
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    const store = getStore();
    setLiked(Boolean(store[entityId]));
  }, [entityId]);

  const toggle = () => {
    const store = getStore();
    if (store[entityId]) {
      delete store[entityId];
      setLiked(false);
    } else {
      store[entityId] = true;
      setLiked(true);
    }
    persist(store);
  };

  return (
    <button
      onClick={toggle}
      className={clsx(
        'w-9 h-9 rounded-full border flex items-center justify-center transition-colors',
        liked ? 'border-rose-400 bg-rose-500/10 text-rose-300' : 'border-white/10 text-gray-400 hover:text-white',
      )}
      aria-label="Toggle like"
    >
      <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
    </button>
  );
};

function clsx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(' ');
}
