import { Track, LibraryEntry } from '../types';

interface Props {
  tracks: Track[];
  library: Record<string, LibraryEntry>;
  onPlay: (track: Track) => Promise<void>;
  loading: boolean;
  userHandle: string;
}

const DiscoveryPage = ({ tracks, loading }: Props) => {
  // Silence unused warnings
  void tracks;
  return <div className="p-8">Discovery Page {loading && '(Loading...)'}</div>;
};

export default DiscoveryPage;
