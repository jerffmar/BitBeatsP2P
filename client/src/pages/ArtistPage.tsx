import { Track } from '../types';

interface Props {
  swarmTracks: Track[];
  onPlay: (track: Track) => Promise<void>;
  currentTrackId: string | null;
}

const ArtistPage = ({ swarmTracks, onPlay, currentTrackId }: Props) => {
  // Silence unused warnings
  void onPlay;
  void currentTrackId;
  return <div className="p-8">Artist Page - {swarmTracks.length} tracks</div>;
};

export default ArtistPage;
