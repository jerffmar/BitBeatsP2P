import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowDown,
  Check,
  Disc,
  Download,
  HardDrive,
  Loader,
  LogOut,
  Mic,
  Music,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  Search,
  Wifi,
  Settings,
  Upload,
  Heart,
  User as UserIcon,
  Database,
  Radio,
  Zap,
  Users,
  Send,
  Layers,
  Globe,
  Headphones,
  DollarSign,
  Share2,
  Menu,
  X
} from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';
import { AuthScreen } from './pages/AuthScreen';
import ArtistPage from './pages/ArtistPage';
import AlbumPage from './pages/AlbumPage';
import LibraryDashboard from './pages/LibraryDashboard';
import DiscoveryPage from './pages/DiscoveryPage';
import { LibraryArtists } from './pages/LibraryArtists';
import { LibraryAlbums } from './pages/LibraryAlbums';
import { LibraryTracks } from './pages/LibraryTracks';
import { LikeButton } from './components/LikeButton';
import {
  User,
  Track,
  LibraryEntry,
  UserStats,
  StorageConfig,
  SocialPost,
  GlobalCatalogEntry,
  Bounty,
  ListenParty
} from './types';
import { getSession, logout, signUpload } from './services/auth';
import {
  initDB,
  subscribeToPosts,
  publishPost,
  createBounty,
  subscribeToBounties,
  publishTrackMetadata,
  subscribeToTracks,
  subscribeToParties,
  subscribeToCredits,
  createParty,
} from './services/db';
import { saveToVault, loadFromVault, getStoredBytes } from './services/storage';
import { initTorrentClient, seedFile, discoverLocalPeers, addTorrent } from './services/torrent';
import { analyzeAudio, normalizeAndTranscode } from './services/audioEngine';
import { searchGlobalCatalog } from './services/musicBrainz';
import api, { TrackDTO } from './services/api';

interface SearchBundle {
  local: Track[];
  catalog: {
    songs: GlobalCatalogEntry[];
    albums: GlobalCatalogEntry[];
    artists: GlobalCatalogEntry[];
  };
}

const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'ghost';
  }
> = ({ children, variant = 'primary', className, ...props }) => {
  const base = 'transition-all duration-200 font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-brand-500 hover:bg-brand-400 text-black px-5 py-2.5 rounded-full shadow-lg shadow-brand-500/20 active:scale-95',
    secondary: 'bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl border border-white/5',
    ghost: 'text-gray-400 hover:text-white px-3 py-2 hover:bg-white/5 rounded-xl',
  } as const;
  return (
    <button className={twMerge(base, variants[variant], className)} {...props}>
      {children}
    </button>
  );
};

const NavLinkButton: React.FC<{ path: string; icon: React.ComponentType<{ size?: number | string }>; label: string }> = ({
  path,
  icon: Icon,
  label,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = location.pathname === path;
  return (
    <button
      onClick={() => navigate(path)}
      className={clsx(
        'w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors',
        isActive ? 'bg-brand-500/10 text-brand-400 border border-brand-500/40' : 'text-gray-400 hover:text-white hover:bg-white/5',
      )}
    >
      <Icon size={18} />
      {label}
    </button>
  );
};

const FilterChip: React.FC<{
  active: boolean;
  icon: React.ComponentType<{ size?: number | string }>;
  label: string;
  onClick: () => void;
}> = ({
  active,
  icon: Icon,
  label,
  onClick,
}) => (
  <button
    onClick={onClick}
    className={clsx(
      'flex items-center gap-2 px-4 py-2 rounded-full border transition-all',
      active ? 'bg-brand-500 text-black border-brand-500 font-semibold' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white',
    )}
  >
    <Icon size={14} />
    {label}
  </button>
);

const formatTime = (seconds: number) => {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${mins}:${secs}`;
};

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const currentTorrentDestroyRef = useRef<(() => void) | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [library, setLibrary] = useState<Record<string, LibraryEntry>>({});
  const [storageConfig] = useState<StorageConfig>({ maxUsageGB: 2, evictionStrategy: 'SMART_RARITY', ghostSeeding: true });
  const [usageMB, setUsageMB] = useState(0);
  const [activePeers, setActivePeers] = useState(0);
  const [stats, setStats] = useState<UserStats>({ downloadedBytes: 0, uploadedBytes: 0, ratio: 1, reputation: 'Member', credits: 120 });
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>([]);
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [activeParties, setActiveParties] = useState<ListenParty[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState<'ALL' | 'SONG' | 'ALBUM' | 'ARTIST'>('ALL');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchBundle>({
    local: [],
    catalog: { songs: [], albums: [], artists: [] },
  });
  const [newPostContent, setNewPostContent] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    getSession().then((session: User | null) => {
      if (session) {
        setUser(session);
      }
    });
  }, []);

  const refreshSeededLibrary = useCallback(async () => {
    try {
      let serverTracks: any = await api.getTracks();
      // Defensive: ensure we have an array. If not, try common shapes, otherwise bail.
      if (!Array.isArray(serverTracks)) {
        console.warn('[refreshSeededLibrary] unexpected /api/tracks response:', serverTracks);
        if (serverTracks && Array.isArray(serverTracks.tracks)) {
          serverTracks = serverTracks.tracks;
        } else {
          // Keep existing tracks; attempt to fall back to vault usage only
          const bytes = await getStoredBytes().catch(() => 0);
          setUsageMB(bytes / (1024 * 1024));
          return;
        }
      }

      const normalized: Track[] = serverTracks.map((dto: TrackDTO) => ({
        id: dto.id,
        title: dto.title,
        artist: dto.artist,
        album: dto.album,
        coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop',
        audioUrl: dto.magnetURI || '',
        duration: dto.duration,
        sizeMB: Number(dto.sizeBytes ?? 0) / (1024 * 1024),
      }));
      const normalizedIds = new Set(normalized.map((track) => track.id));
      setTracks((prev) => {
        const extras = prev.filter((track) => !normalizedIds.has(track.id));
        return [...normalized, ...extras];
      });
      const totalBytes = serverTracks.reduce((sum: number, dto: TrackDTO) => sum + Number(dto.sizeBytes ?? 0), 0);
      setUsageMB(totalBytes / (1024 * 1024));
    } catch (error) {
      console.error('Failed to refresh seeded library', error);
      try {
        const bytes = await getStoredBytes();
        setUsageMB(bytes / (1024 * 1024));
      } catch (vaultError) {
        console.error('Failed to read local vault usage', vaultError);
      }
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    initDB();
    initTorrentClient();
    // Accept either a number (mock) or an array (future real peers)
    (async () => {
      try {
        const peers = await discoverLocalPeers();
        if (Array.isArray(peers)) setActivePeers(peers.length);
        else if (typeof peers === 'number') setActivePeers(peers);
        else setActivePeers(0);
      } catch (err) {
        console.warn('discoverLocalPeers failed:', err);
        setActivePeers(0);
      }
    })();
    refreshSeededLibrary();

    const tearDowns: Array<() => void> = [];
    tearDowns.push(
      subscribeToTracks((track: Track) => {
        setTracks((prev) => (prev.some((t) => t.id === track.id) ? prev : [track, ...prev]));
      }),
    );
    tearDowns.push(
      subscribeToPosts((post: SocialPost) => {
        setSocialPosts((prev) => {
          if (prev.some((p) => p.id === post.id)) return prev;
          return [post, ...prev].slice(0, 40);
        });
      }),
    );
    tearDowns.push(
      subscribeToBounties((bounty: Bounty) => {
        setBounties((prev) => {
          if (prev.some((b) => b.id === bounty.id)) return prev;
          return [bounty, ...prev];
        });
      }),
    );
    tearDowns.push(
      subscribeToParties((party: ListenParty) => {
        setActiveParties((prev) => {
          if (prev.some((p) => p.id === party.id)) return prev;
          return [party, ...prev];
        });
      }),
    );
    tearDowns.push(
      subscribeToCredits(user.id, (credits: number) => {
        if (credits !== undefined) {
          setStats((prev: any) => ({ ...prev, credits }));
        }
      }),
    );

    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;
    const handleTime = () => {
      if (!isDraggingRef.current) setCurrentTime(audio.currentTime);
    };
    const handleDuration = () => setDuration(audio.duration || 0);
    const handleEnded = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTime);
    audio.addEventListener('loadedmetadata', handleDuration);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      tearDowns.forEach((fn) => fn());
      audio.removeEventListener('timeupdate', handleTime);
      audio.removeEventListener('loadedmetadata', handleDuration);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, [user, refreshSeededLibrary]);

  useEffect(() => {
    if (!user) return;
    if (location.pathname === '/library') {
      refreshSeededLibrary();
    }
  }, [location.pathname, user, refreshSeededLibrary]);

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    navigate(`/search?q=${searchQuery}`);
    try {
      const catalog = await searchGlobalCatalog(searchQuery, 0, searchFilter);
      const localMatches = tracks.filter(
        (t) =>
          t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.artist.toLowerCase().includes(searchQuery.toLowerCase()),
      );
      setSearchResults({ local: localMatches, catalog });
    } catch (error) {
      console.error('Global search failed', error);
    } finally {
      setSearching(false);
    }
  };

  const handleLoadMore = async () => {
    // Guard: avoid requesting MusicBrainz with an empty query (results in 400)
    if (searchFilter === 'ALL' || searching || !searchQuery.trim()) return;
    setSearching(true);
    const offset =
      searchFilter === 'SONG'
        ? searchResults.catalog.songs.length
        : searchFilter === 'ALBUM'
        ? searchResults.catalog.albums.length
        : searchResults.catalog.artists.length;
    try {
      const appended = await searchGlobalCatalog(searchQuery, offset, searchFilter);
      setSearchResults((prev) => ({
        local: prev.local,
        catalog: {
          songs: searchFilter === 'SONG' ? [...prev.catalog.songs, ...appended.songs] : prev.catalog.songs,
          albums: searchFilter === 'ALBUM' ? [...prev.catalog.albums, ...appended.albums] : prev.catalog.albums,
          artists: searchFilter === 'ARTIST' ? [...prev.catalog.artists, ...appended.artists] : prev.catalog.artists,
        },
      }));
    } catch (error) {
      console.error('Load more failed', error);
    } finally {
      setSearching(false);
    }
  };

  const handlePostSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newPostContent.trim() || !user) return;
    await publishPost(user.username, newPostContent, currentTrack?.id);
    setNewPostContent('');
  };

  const handleRequestBounty = (entry: GlobalCatalogEntry) => {
    createBounty(entry.mbid, `${entry.artist} - ${entry.title}`, 120);
  };

  const handleLocalImport = useCallback(
    async (file: File, metadata: { title: string; artist: string; album?: string }) => {
      try {
        console.log('Starting local import for file:', file.name);
        const analysis = await analyzeAudio(file);
        if (!analysis?.buffer || !analysis.fingerprint || !analysis.duration) {
          console.warn('Audio analysis returned mock data, aborting import.');
          alert('Audio analysis failed. Please verify the analyzer implementation.');
          return;
        }
        console.log('Audio analysis complete:', analysis);
        const transposed = await normalizeAndTranscode(analysis.buffer);
        console.log('Transcoding complete');
        // Fix: extract signature string from signed object
        const signed = await signUpload(file, analysis.fingerprint);
        console.log('Signing complete');
        const normalizedSizeMB = transposed.byteLength / (1024 * 1024);
        const localTrackId = (crypto as Crypto)?.randomUUID?.() ?? `local-${Date.now()}`;
        const magnet = await seedFile(new File([transposed], `${metadata.artist}-${metadata.title}.wav`, { type: 'audio/wav' }), metadata.title);
        console.log('Seeding complete, magnet:', magnet);

        // Create blob URL for playback
        const blob = new Blob([transposed], { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(blob);

        const optimisticTrack: Track = {
          id: localTrackId,
          title: metadata.title,
          artist: metadata.artist,
          album: metadata.album ?? 'Unreleased',
          coverUrl: currentTrack?.coverUrl ?? 'https://images.unsplash.com/photo-1511376777868-611b54f68947?auto=format&fit=crop&w=600&q=60',
          audioUrl: audioUrl,
          duration: analysis.duration,
          sizeMB: normalizedSizeMB,
        };

        setTracks((prev) => [optimisticTrack, ...prev]);
        setLibrary((prev) => ({
          ...prev,
          [localTrackId]: {
            id: localTrackId,
            dateAdded: Date.now(),
            trackId: localTrackId,
            status: 'SEEDING',
            progress: 1,
            addedAt: Date.now(),
            lastPlayed: 0,
          },
        }));
        setUsageMB((prev) => prev + normalizedSizeMB);

        await publishTrackMetadata({
          title: metadata.title,
          artist: metadata.artist,
          album: metadata.album ?? 'Unreleased',
          duration: analysis.duration,
          audioUrl: magnet,
          coverUrl: optimisticTrack.coverUrl,
          license: 'CC-BY',
          tags: ['vault', 'import'],
          artistSignature: signed.signature,
        });
        console.log('Track metadata published successfully');
      } catch (error: any) {
        console.error('Error during local import:', error);
        alert(`Import failed: ${error.message || 'Unknown error'}`);
      }
    },
    [currentTrack],
  );

  const playTrack = useCallback(
    async (track: Track) => {
      if (!audioRef.current) return;

      // Clean up any previously created blob URL / torrent for playback
      if (currentTorrentDestroyRef.current) {
        try {
          currentTorrentDestroyRef.current();
        } catch (err) {
          console.warn('Failed to destroy previous torrent/URL', err);
        }
        currentTorrentDestroyRef.current = null;
      }

      if (currentTrack?.id === track.id) {
        if (audioRef.current.paused) {
          try {
            await audioRef.current.play();
          } catch (error: any) {
            if (error.name !== 'AbortError') {
              console.error('Play error:', error);
            }
          }
        } else {
          audioRef.current.pause();
        }
        return;
      }
      setCurrentTrack(track);
      setIsPlaying(false);
      audioRef.current.pause();

      try {
        // If the audioUrl is a magnet link, convert via WebTorrent to a blob URL
        if (track.audioUrl?.startsWith?.('magnet:')) {
          try {
            const added = await addTorrent(track.audioUrl);
            audioRef.current.src = added.url;
            currentTorrentDestroyRef.current = added.destroy;
          } catch (err) {
            console.error('Failed to open magnet via WebTorrent:', err);
            // fallback: try to use webSeedUrl if present on track object
            if ((track as any).webSeedUrl) {
              audioRef.current.src = (track as any).webSeedUrl;
            } else {
              throw err;
            }
          }
        } else {
          audioRef.current.src = track.audioUrl;
        }

        try {
          await audioRef.current.play();
          setIsPlaying(true);
        } catch (error: any) {
          if (error.name !== 'AbortError') {
            console.error('Play error:', error);
          }
        }
      } catch (err) {
        console.error('Playback setup failed:', err);
        // reset currentTrack if playback couldn't be prepared
        setCurrentTrack(null);
      }

      setLibrary((prev) => ({
        ...prev,
        [track.id]: prev[track.id] ?? {
          trackId: track.id,
          status: track.audioUrl.startsWith('magnet:') ? 'SEEDING' : 'REMOTE',
          progress: track.audioUrl.startsWith('magnet:') ? 1 : 0,
          addedAt: Date.now(),
          lastPlayed: Date.now(),
        },
      }));
    },
    [currentTrack],
  );

  const handleSeekStart = (event: React.MouseEvent) => {
    if (!progressRef.current || !audioRef.current || !duration) return;
    isDraggingRef.current = true;
    const rect = progressRef.current.getBoundingClientRect();
    const percentage = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    setCurrentTime(percentage * duration);
    const onMove = (moveEvent: MouseEvent) => {
      const pct = Math.min(1, Math.max(0, (moveEvent.clientX - rect.left) / rect.width));
      setCurrentTime(pct * duration);
    };
    const onUp = () => {
      audioRef.current!.currentTime = (currentTime / duration) * duration;
      isDraggingRef.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const handleCreateParty = () => {
    if (!currentTrack || !user) return;
    createParty(user.username, currentTrack.id);
  };

  const handleLogout = () => {
    logout();
    setUser(null);
    setCurrentTrack(null);
    audioRef.current?.pause();
  };

  const navLinks = useMemo(
    () => [
      { path: '/', icon: Radio, label: 'Discovery' },
      { path: '/bounties', icon: Zap, label: 'Bounty Board' },
      { path: '/swarm', icon: Users, label: 'Swarm Social' },
      { path: '/library', icon: HardDrive, label: 'Vault' },
    ],
    [],
  );

  if (!user) {
    return <AuthScreen onLogin={setUser} />;
  }

  return (
    <div className="flex flex-col h-screen bg-[#05050a] text-gray-100 overflow-hidden">
      <header className="h-16 border-b border-white/5 flex items-center justify-between px-4 md:px-8 bg-[#05050a]/95 backdrop-blur-xl">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500/40 to-indigo-600/40 border border-white/5 flex items-center justify-center">
            <Disc className={clsx('text-cyan-200', isPlaying && 'animate-spin-slow')} size={20} />
          </div>
          <div>
            <p className="text-lg font-bold text-white leading-none">BitBeats</p>
            <p className="text-[11px] text-gray-500 uppercase tracking-[0.28em]">Hybrid Swarm</p>
          </div>
        </Link>

        <form onSubmit={handleSearch} className="hidden md:block flex-1 max-w-xl mx-8 relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search the MusicBrainz catalog or your swarm inventory…"
            className="w-full bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-cyan-400"
          />
        </form>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-3 text-xs">
            <span className="bg-white/5 px-3 py-1 rounded-full flex items-center gap-2 text-gray-400">
              <Wifi size={14} />
              {activePeers} peers
            </span>
            <span className="bg-white/5 px-3 py-1 rounded-full flex items-center gap-2 text-gray-400">
              <HardDrive size={14} />
              {usageMB.toFixed(1)} MB / {storageConfig.maxUsageGB} GB
            </span>
            <span className="bg-yellow-500/20 px-3 py-1 rounded-full text-yellow-300 font-semibold">{stats.credits} Credits</span>
          </div>
          <button onClick={handleLogout} className="text-gray-400 hover:text-white" title="Logout">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden lg:flex w-64 flex-col border-r border-white/5 bg-[#070709] p-4 gap-3">
          <div className="px-4 py-3 bg-white/5 rounded-xl border border-white/5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-200 font-semibold text-sm">
              {user.username.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-white font-semibold text-sm">{user.username}</p>
              <p className="text-[11px] text-gray-500">{user.handle}</p>
            </div>
          </div>
          <div className="text-xs uppercase tracking-[0.3em] text-gray-500 px-4 mt-2">Navigate</div>
          {navLinks.map((link) => (
            <NavLinkButton key={link.path} {...link} />
          ))}
        </aside>

        <main className="flex-1 overflow-y-auto pb-32">
          <Routes>
            <Route
              path="/"
              element={<DiscoveryPage tracks={tracks} library={library} onPlay={playTrack} loading={!tracks.length} userHandle={user.handle} />}
            />
            <Route
              path="/library"
              element={<LibraryDashboard user={user} library={library} tracks={tracks} usageMB={usageMB} onImport={handleLocalImport} />}
            />
            <Route
              path="/artist/:id"
              element={<ArtistPage swarmTracks={tracks} onPlay={playTrack} currentTrackId={currentTrack?.id ?? null} />}
            />
            <Route
              path="/album/:id"
              element={<AlbumPage swarmTracks={tracks} onPlay={playTrack} currentTrackId={currentTrack?.id ?? null} />}
            />
            <Route
              path="/bounties"
              element={
                <div className="max-w-4xl mx-auto p-6 md:p-10 space-y-6">
                  <div className="rounded-3xl border border-yellow-500/30 bg-yellow-500/10 p-6">
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                      <Zap className="text-yellow-400" /> Bounty Board
                    </h1>
                    <p className="text-gray-200 mt-2">Spend credits to request rare uploads. Seeders earn rewards instantly.</p>
                  </div>
                  {bounties.map((bounty) => (
                    <div key={bounty.id} className="rounded-2xl border border-white/10 bg-white/5 p-5 flex items-center justify-between">
                      <div>
                        <p className="text-xl font-semibold text-white">{bounty.query}</p>
                        <p className="text-sm text-gray-400">{bounty.requesterCount} listeners waiting</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-2xl font-bold text-yellow-400">{bounty.reward} CR</p>
                          <p className="text-xs text-gray-500">Reward</p>
                        </div>
                        <Button onClick={() => setSearchQuery(bounty.query)} variant="secondary">
                          Track it
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              }
            />
            <Route
              path="/swarm"
              element={
                <div className="max-w-4xl mx-auto p-6 md:p-10 space-y-6">
                  <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold text-white">Swarm Social</h1>
                    <Button onClick={handleCreateParty} variant="secondary">
                      Host Listen Party
                    </Button>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    {activeParties.length === 0 && (
                      <p className="col-span-2 text-center text-gray-500 border border-white/5 rounded-2xl p-6">No live parties right now.</p>
                    )}
                    {activeParties.map((party) => (
                      <div key={party.id} className="rounded-2xl border border-white/10 bg-gradient-to-br from-purple-900/40 to-blue-900/30 p-5">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-white font-semibold">{party.host}</p>
                          <span className="text-xs text-red-400 flex items-center gap-1">
                            <Activity size={12} /> LIVE
                          </span>
                        </div>
                        <p className="text-sm text-gray-300">
                          Now playing: {tracks.find((t) => t.id === party.currentTrackId)?.title ?? 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{party.participants} participants</p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <form onSubmit={handlePostSubmit} className="flex gap-3">
                      <input
                        value={newPostContent}
                        onChange={(e) => setNewPostContent(e.target.value)}
                        placeholder={`Share an update, ${user.username}…`}
                        className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-cyan-400"
                      />
                      <Button type="submit" disabled={!newPostContent.trim()}>
                        <Send size={16} />
                        Post
                      </Button>
                    </form>
                  </div>
                  <div className="space-y-4">
                    {socialPosts.map((post) => (
                      <div key={post.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-semibold text-cyan-300">@{post.author}</p>
                          <span className="text-xs text-gray-500">{new Date(post.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-sm text-gray-200">{post.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              }
            />
            <Route
              path="/search"
              element={
                <div className="max-w-5xl mx-auto p-6 md:p-10 space-y-8">
                  <div className="flex items-center justify-between gap-4">
                    <h1 className="text-3xl font-bold text-white">Search: “{searchQuery}”</h1>
                    <div className="flex gap-2 overflow-auto">
                      <FilterChip active={searchFilter === 'ALL'} label="All" icon={Layers} onClick={() => setSearchFilter('ALL')} />
                      <FilterChip active={searchFilter === 'SONG'} label="Songs" icon={Music} onClick={() => setSearchFilter('SONG')} />
                      <FilterChip active={searchFilter === 'ALBUM'} label="Albums" icon={Disc} onClick={() => setSearchFilter('ALBUM')} />
                      <FilterChip active={searchFilter === 'ARTIST'} label="Artists" icon={Mic} onClick={() => setSearchFilter('ARTIST')} />
                    </div>
                  </div>
                  {searching ? (
                    <div className="flex justify-center py-20">
                      <Loader className="animate-spin text-cyan-400" size={32} />
                    </div>
                  ) : (
                    <div className="space-y-10">
                      {searchResults.local.length > 0 && (
                        <section>
                          <div className="flex items-center gap-3 mb-4">
                            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                              <Check size={18} /> Already in swarm
                            </h2>
                            <span className="text-xs text-gray-400">{searchResults.local.length} hits</span>
                          </div>
                          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {searchResults.local.map((track) => (
                              <div key={track.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <img src={track.coverUrl} alt={track.title} className="rounded-xl mb-3 h-36 w-full object-cover" />
                                <p className="font-semibold text-white truncate">{track.title}</p>
                                <p className="text-xs text-gray-400 truncate">{track.artist}</p>
                                <Button onClick={() => playTrack(track)} className="mt-3" variant="secondary">
                                  Play
                                </Button>
                              </div>
                            ))}
                          </div>
                        </section>
                      )}
                      {['SONG', 'ALBUM', 'ARTIST'].map((group) => {
                        const items =
                          group === 'SONG'
                            ? searchResults.catalog.songs
                            : group === 'ALBUM'
                            ? searchResults.catalog.albums
                            : searchResults.catalog.artists;
                        if (!items.length || (searchFilter !== 'ALL' && searchFilter !== group)) return null;
                        return (
                          <section key={group}>
                            <div className="flex items-center justify-between mb-4">
                              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                                {group === 'SONG' ? <Music size={18} /> : group === 'ALBUM' ? <Disc size={18} /> : <Mic size={18} />}
                                {group === 'SONG' ? 'Songs' : group === 'ALBUM' ? 'Albums' : 'Artists'}
                              </h2>
                            </div>
                            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                              {items.map((entry) => (
                                <div key={entry.mbid} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                  <div className="aspect-square rounded-xl bg-gray-900 mb-3 overflow-hidden flex items-center justify-center">
                                    {entry.coverUrl ? (
                                      <img src={entry.coverUrl} alt={entry.title} className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="text-gray-500 text-xs uppercase tracking-[0.3em]">{group}</span>
                                    )}
                                  </div>
                                  <p className="font-semibold text-white truncate">{entry.title}</p>
                                  <p className="text-xs text-gray-400 truncate">{entry.artist}</p>
                                  {group === 'SONG' ? (
                                    <Button onClick={() => handleRequestBounty(entry)} className="mt-3" variant="secondary">
                                      Request via Bounty
                                    </Button>
                                  ) : (
                                    <Button onClick={() => navigate(group === 'ARTIST' ? `/artist/${entry.mbid}` : `/album/${entry.mbid}`)} className="mt-3" variant="ghost">
                                      View
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </section>
                        );
                      })}
                      {searchFilter !== 'ALL' && (
                        <div className="flex justify-center">
                          <Button onClick={handleLoadMore} disabled={searching} variant="secondary">
                            <ArrowDown size={16} />
                            Load more
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              }
            />
            <Route path="/studio" element={<Navigate to="/library" replace />} />
          </Routes>
        </main>
      </div>

      <footer className="fixed bottom-0 left-0 right-0 h-24 bg-[#090910]/95 border-t border-white/5 px-4 md:px-8 flex items-center justify-between gap-4 backdrop-blur-lg">
        <div className="flex items-center gap-3 w-1/3 min-w-[200px]">
          {currentTrack ? (
            <>
              <img src={currentTrack.coverUrl} alt={currentTrack.title} className="w-14 h-14 rounded-xl object-cover border border-white/10" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{currentTrack.title}</p>
                <p className="text-xs text-gray-500 truncate">{currentTrack.artist}</p>
              </div>
              <LikeButton entityId={currentTrack.id} entityType="track" />
            </>
          ) : (
            <p className="text-gray-600 text-sm">Select a track to begin seeding.</p>
          )}
        </div>

        <div className="flex flex-col items-center w-1/3 max-w-xl">
          <div className="flex items-center gap-6 mb-3">
            <button className="text-gray-400 hover:text-white">
              <SkipBack size={18} />
            </button>
            <button
              onClick={() => currentTrack && playTrack(currentTrack)}
              disabled={!currentTrack}
              className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-lg shadow-white/20"
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} className="translate-x-0.5" />}
            </button>
            <button className="text-gray-400 hover:text-white">
              <SkipForward size={18} />
            </button>
          </div>
          <div className="w-full flex items-center gap-3 text-xs text-gray-500 font-mono">
            <span>{formatTime(currentTime)}</span>
            <div ref={progressRef} className="flex-1 h-3 group cursor-pointer" onMouseDown={handleSeekStart}>
              <div className="w-full h-1 bg-gray-700 rounded-full relative overflow-hidden">
                <div className="absolute inset-y-0 left-0 bg-cyan-400 rounded-full" style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}>
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 rounded-full bg-white shadow-lg scale-0 group-hover:scale-100 transition-transform" />
                </div>
              </div>
            </div>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 justify-end w-1/3">
          <span className="text-xs text-gray-500 flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full">
            <Activity size={12} />
            {currentTrack && library[currentTrack.id]?.status === 'SEEDING' ? 'SEEDING' : 'NET OK'}
          </span>
          <Volume2 size={18} className="text-gray-400 hidden sm:block" />
        </div>
      </footer>
    </div>
  );
};

export default App;
