import { Track } from '../types';

interface Props {
  tracks: Track[];
  currentTrackId: string | null;
  onPlay: (track: Track) => Promise<void>;
}

export const LibraryTracks = ({ tracks }: Props) => {
  return <div className="p-8">Library Tracks - {tracks.length} tracks</div>;
};
