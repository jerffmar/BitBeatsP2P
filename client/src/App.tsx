import React, { useState, useRef } from 'react';
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import { Radio, Signal, Music, Upload as UploadIcon, Disc, Loader2 } from 'lucide-react';
import { Track } from '../../types';
import { useTorrentPlayer } from './hooks/useTorrentPlayer';
import { Library } from './pages/Library';
import { Upload } from './pages/Upload';

export interface PlayerContextType {
    currentTrack: Track | null;
    isPlaying: boolean;
    playTrack: (track: Track) => void;
}

const App: React.FC = () => {
    const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);
    const { play, stats, error: playerError, isBuffering } = useTorrentPlayer(null);

    const playTrack = (track: Track) => {
        if (currentTrack?.id === track.id) {
            if (isPlaying) {
                audioRef.current?.pause();
                setIsPlaying(false);
            } else {
                audioRef.current?.play();
                setIsPlaying(true);
            }
        } else {
            setCurrentTrack(track);
            setIsPlaying(true);
            if (audioRef.current) {
                play(track.magnetURI);
            }
        }
    };

    return (
        <BrowserRouter>
            <div className="app-shell min-h-screen pb-28 font-sans bg-brand-dark text-slate-200 selection:bg-brand-accent selection:text-brand-dark">
                <header className="bg-brand-card border-b border-gray-700 sticky top-0 z-10">
                    <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                        <NavLink to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                            <Radio className="w-6 h-6 text-brand-accent" />
                            <h1 className="text-xl font-bold tracking-tight">BitBeats <span className="text-xs font-normal text-gray-400 ml-1">P2P Audio</span></h1>
                        </NavLink>

                        <div className="flex items-center gap-4">
                            <NavLink to="/upload" className="flex items-center gap-1 text-sm font-medium hover:text-brand-accent transition-colors">
                                <UploadIcon className="w-4 h-4" /> <span className="hidden sm:inline">Upload</span>
                            </NavLink>
                            <div className="w-px h-4 bg-gray-700"></div>
                            <div className="flex items-center gap-3 text-xs text-gray-400 bg-brand-dark/50 px-3 py-1 rounded-full border border-gray-700">
                                <div className="flex items-center gap-1">
                                    <Signal className="w-3 h-3 text-green-400" />
                                    <span>{stats.numPeers} Peers</span>
                                </div>
                                <div className="hidden sm:block text-gray-600">|</div>
                                <div className="hidden sm:block">↓ {(stats.downloadSpeed / 1024).toFixed(1)} KB/s</div>
                            </div>
                        </div>
                    </div>
                </header>

                <main className="max-w-4xl mx-auto px-4 py-8">
                    <Routes>
                        <Route path="/" element={
                            <Library
                                onSelectTrack={setCurrentTrack}
                                currentTrackId={currentTrack?.id ?? null}
                            />
                        } />
                        <Route path="/upload" element={<Upload />} />
                    </Routes>
                </main>

                <div className={`fixed bottom-0 left-0 right-0 bg-brand-card border-t border-brand-accent/20 p-4 shadow-2xl backdrop-blur-lg bg-opacity-95 transition-transform duration-300 ${currentTrack ? 'translate-y-0' : 'translate-y-full'}`}>
                    <div className="max-w-4xl mx-auto flex items-center gap-4">
                        <div className="w-12 h-12 bg-gray-800 rounded flex items-center justify-center shrink-0 relative overflow-hidden">
                            {isBuffering ? (
                                <Loader2 className="w-6 h-6 text-brand-accent animate-spin" />
                            ) : (
                                <Music className="w-6 h-6 text-brand-accent" />
                            )}
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
        </BrowserRouter>
    );
};

export default App;
