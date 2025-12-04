import { Track } from '../types';

interface Props {
  tracks: Track[];
  onPlay: (track: Track) => Promise<void>;
}

export const LibraryAlbums = ({ tracks }: Props) => {
  return <div className="p-8">Library Albums - {tracks.length} tracks</div>;
};
