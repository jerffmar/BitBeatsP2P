import React, { useState } from 'react';
import { Heart } from 'lucide-react';

interface LikeButtonProps {
  entityId: string;
  entityType: 'track' | 'album' | 'artist';
}

export const LikeButton: React.FC<LikeButtonProps> = ({ entityId, entityType }) => {
  const [liked, setLiked] = useState(false);

  const handleClick = () => {
    setLiked(!liked);
    // TODO: Implement actual like/unlike logic
  };

  return (
    <button
      onClick={handleClick}
      className={`p-2 rounded-full transition-colors ${
        liked ? 'text-red-500 bg-red-500/10' : 'text-gray-400 hover:text-red-500'
      }`}
      title={liked ? `Unlike this ${entityType}` : `Like this ${entityType}`}
    >
      <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
    </button>
  );
};
