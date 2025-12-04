import { Track } from '../types';

interface Props {
  tracks: Track[];
  onPlay: (track: Track) => Promise<void>;
}

export const LibraryArtists = ({ tracks }: Props) => {
  return <div className="p-8">Library Artists - {tracks.length} tracks</div>;
};
