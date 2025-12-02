import React, { useState, useEffect, useRef } from 'react';
import { Upload, Play, Pause, Music, Radio, Disc, Download, Loader2, Signal } from 'lucide-react';
import { Track } from './types';
import { api } from './client/src/services/api';
import { useTorrentPlayer } from './client/src/hooks/useTorrentPlayer';

const App: React.FC = () => {
    const [tracks, setTracks] = useState<Track[]>([]);
    const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    
    const audioRef = useRef<HTMLAudioElement>(null);
    const { play, stats, error: playerError, isBuffering } = useTorrentPlayer();

    // Initial Load
    useEffect(() => {
        loadTracks();
    }, []);

    const loadTracks = async () => {
        try {
            const data = await api.getTracks();
            setTracks(data);
        } catch (error) {
            console.error(error);
        }
    };

    const handlePlay = (track: Track) => {
        if (currentTrack?.id === track.id) {
            // Toggle play/pause
            if (isPlaying) {
                audioRef.current?.pause();
                setIsPlaying(false);
            } else {
                audioRef.current?.play();
                setIsPlaying(true);
            }
        } else {
            // New track
            setCurrentTrack(track);
            setIsPlaying(true);
            
            if (audioRef.current) {
                // Initialize P2P Stream
                play(track.magnetURI, audioRef.current);
            }
        }
    };

    const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fileInput = form.elements.namedItem('file') as HTMLInputElement;
        const artistInput = form.elements.namedItem('artist') as HTMLInputElement;
        const titleInput = form.elements.namedItem('title') as HTMLInputElement;

        if (!fileInput.files?.[0]) return;

        setIsUploading(true);
        setUploadProgress(0);
        
        try {
            await api.upload(
                fileInput.files[0], 
                artistInput.value, 
                titleInput.value,
                (percent) => setUploadProgress(percent)
            );
            form.reset();
            setUploadProgress(0);
            await loadTracks();
        } catch (err) {
            alert('Upload failed');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="min-h-screen pb-28 font-sans selection:bg-brand-accent selection:text-brand-dark">
            {/* Header */}
            <header className="bg-brand-card border-b border-gray-700 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Radio className="w-6 h-6 text-brand-accent" />
                        <h1 className="text-xl font-bold tracking-tight">BitBeats <span className="text-xs font-normal text-gray-400 ml-1">P2P Audio</span></h1>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400 hidden sm:flex bg-brand-dark/50 px-3 py-1 rounded-full border border-gray-700">
                        <div className="flex items-center gap-1">
                            <Signal className="w-3 h-3 text-green-400" />
                            <span>{stats.numPeers} Peers</span>
                        </div>
                        <div className="w-px h-3 bg-gray-700"></div>
                        <div>↓ {(stats.downloadSpeed / 1024).toFixed(1)} KB/s</div>
                        <div>↑ {(stats.uploadSpeed / 1024).toFixed(1)} KB/s</div>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
                
                {/* Upload Section */}
                <section className="bg-brand-card rounded-xl p-6 border border-gray-700 shadow-lg">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Upload className="w-5 h-5 text-brand-accent" /> Upload New Track
                    </h2>
                    <form onSubmit={handleUpload} className="flex flex-col sm:flex-row gap-4 items-end">
                        <div className="flex-1 w-full">
                            <label className="block text-xs text-gray-400 mb-1">Track File</label>
                            <input 
                                name="file" 
                                type="file" 
                                accept="audio/*" 
                                required
                                className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-accent file:text-brand-dark hover:file:bg-sky-300 transition-colors"
                            />
                        </div>
                        <div className="w-full sm:w-48">
                            <label className="block text-xs text-gray-400 mb-1">Title</label>
                            <input name="title" type="text" placeholder="Song Title" required className="w-full bg-brand-dark border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-accent transition-colors" />
                        </div>
                        <div className="w-full sm:w-48">
                            <label className="block text-xs text-gray-400 mb-1">Artist</label>
                            <input name="artist" type="text" placeholder="Artist Name" required className="w-full bg-brand-dark border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-accent transition-colors" />
                        </div>
                        <button 
                            type="submit" 
                            disabled={isUploading}
                            className="bg-brand-accent text-brand-dark font-bold py-2 px-6 rounded hover:bg-sky-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto relative overflow-hidden"
                        >
                            {isUploading ? (
                                <span className="flex items-center gap-2 relative z-10">
                                    <Loader2 className="w-4 h-4 animate-spin" /> {uploadProgress}%
                                </span>
                            ) : 'Upload'}
                            {isUploading && (
                                <div 
                                    className="absolute left-0 top-0 bottom-0 bg-sky-300/30 transition-all duration-300"
                                    style={{ width: `${uploadProgress}%` }}
                                ></div>
                            )}
                        </button>
                    </form>
                </section>

                {/* Track List */}
                <section>
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Disc className="w-5 h-5 text-brand-accent" /> Library
                    </h2>
                    
                    <div className="grid gap-2">
                        {tracks.length === 0 ? (
                            <div className="text-center py-12 text-gray-500 bg-brand-card rounded-xl border border-dashed border-gray-700">
                                No tracks found. Upload one to start seeding.
                            </div>
                        ) : (
                            tracks.map(track => (
                                <div 
                                    key={track.id} 
                                    className={`group flex items-center justify-between p-3 rounded-lg border transition-all ${currentTrack?.id === track.id ? 'bg-brand-card border-brand-accent/50' : 'bg-brand-card/50 border-transparent hover:bg-brand-card hover:border-gray-700'}`}
                                >
                                    <div className="flex items-center gap-4 overflow-hidden">
                                        <button 
                                            onClick={() => handlePlay(track)}
                                            className="w-10 h-10 rounded-full bg-brand-dark flex items-center justify-center group-hover:bg-brand-accent group-hover:text-brand-dark transition-colors"
                                        >
                                            {currentTrack?.id === track.id && isPlaying ? (
                                                <Pause className="w-5 h-5 fill-current" />
                                            ) : (
                                                <Play className="w-5 h-5 fill-current ml-1" />
                                            )}
                                        </button>
                                        <div className="min-w-0">
                                            <h3 className={`font-medium truncate ${currentTrack?.id === track.id ? 'text-brand-accent' : 'text-gray-200'}`}>
                                                {track.title}
                                            </h3>
                                            <p className="text-sm text-gray-400 truncate">{track.artist}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-4">
                                        {currentTrack?.id === track.id && isBuffering && (
                                            <div className="text-xs text-brand-accent flex items-center gap-1 animate-pulse">
                                                <Loader2 className="w-3 h-3 animate-spin" /> Buffering
                                            </div>
                                        )}
                                        <a 
                                            href={track.magnetURI} 
                                            title="Download Magnet URI"
                                            className="text-gray-500 hover:text-green-400 transition-colors"
                                        >
                                            <Download className="w-4 h-4" />
                                        </a>
                                        <div className="text-xs text-gray-500 font-mono hidden sm:block">
                                            {(parseInt(track.sizeBytes) / 1024 / 1024).toFixed(2)} MB
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>
            </main>

            {/* Sticky Player */}
            <div className={`fixed bottom-0 left-0 right-0 bg-brand-card border-t border-brand-accent/20 p-4 shadow-2xl backdrop-blur-lg bg-opacity-95 transition-transform duration-300 ${currentTrack ? 'translate-y-0' : 'translate-y-full'}`}>
                <div className="max-w-4xl mx-auto flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-800 rounded flex items-center justify-center shrink-0 relative overflow-hidden">
                        {isBuffering ? (
                            <Loader2 className="w-6 h-6 text-brand-accent animate-spin" />
                        ) : (
                            <Music className="w-6 h-6 text-brand-accent" />
                        )}
                        {/* Progress Bar Background for Player */}
                        <div 
                            className="absolute bottom-0 left-0 h-1 bg-brand-accent transition-all duration-500"
                            style={{ width: `${(stats.progress * 100)}%` }}
                        />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <div className="text-sm font-bold text-gray-100 truncate">{currentTrack?.title}</div>
                            {playerError && (
                                <span className="text-xs text-red-400 bg-red-900/20 px-2 rounded border border-red-900">
                                    Error: {playerError}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400 truncate">
                            <span>{currentTrack?.artist}</span>
                            <span className="text-gray-600">•</span>
                            <span className="text-brand-accent">{stats.numPeers} seeds</span>
                        </div>
                    </div>
                    
                    <audio 
                        ref={audioRef}
                        controls 
                        className="w-full max-w-md h-8 opacity-90"
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                    />
                </div>
            </div>
        </div>
    );
};

export default App;