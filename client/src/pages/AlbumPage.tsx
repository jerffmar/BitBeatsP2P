import { Track } from '../types';

interface Props {
  swarmTracks: Track[];
  onPlay: (track: Track) => Promise<void>;
  currentTrackId: string | null;
}

const AlbumPage = ({ swarmTracks, onPlay, currentTrackId }: Props) => {
  // Silence unused warnings
  void onPlay;
  void currentTrackId;
  return <div className="p-8">Album Page - {swarmTracks.length} tracks</div>;
};

export default AlbumPage;
