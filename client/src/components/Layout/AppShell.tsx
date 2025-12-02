import { PropsWithChildren, ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { TrackDTO } from '../../services/api';

type PlayerBarProps = {
  track: TrackDTO | null;
  buffering: boolean;
  playing: boolean;
  progress: number;
  onPlayPause: () => void;
  onSkipNext?: () => void;
  onSkipPrev?: () => void;
};

type AppShellProps = PropsWithChildren<
  PlayerBarProps & {
    headerSlot?: ReactNode;
  }
>;

export const AppShell = ({
  children,
  headerSlot,
  track,
  buffering,
  playing,
  progress,
  onPlayPause,
  onSkipNext,
  onSkipPrev,
}: AppShellProps) => (
  <div className="app-shell">
    <aside className="hidden md:flex flex-col w-56 bg-surface-elevated p-4 gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">BitBeats</h1>
      <nav className="flex flex-col gap-3 text-sm text-white/70">
        <NavLink to="/" end className="hover:text-white transition">
          Library
        </NavLink>
        <NavLink to="/search" className="hover:text-white transition">
          Search
        </NavLink>
        <NavLink to="/upload" className="hover:text-white transition">
          Upload
        </NavLink>
      </nav>
    </aside>

    <main className="flex-1 flex flex-col">
      <header className="p-6 bg-gradient-to-b from-[#1f1f1f] to-surface-base">
        {headerSlot}
      </header>
      <section className="flex-1 overflow-y-auto p-6 scrollbar-hide">{children}</section>
    </main>

    <PlayerBar
      track={track}
      buffering={buffering}
      playing={playing}
      progress={progress}
      onPlayPause={onPlayPause}
      onSkipNext={onSkipNext}
      onSkipPrev={onSkipPrev}
    />

    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-surface-elevated/95 backdrop-blur border-t border-white/5 flex justify-around py-3 text-xs text-white/70">
      <NavLink to="/" end>
        Library
      </NavLink>
      <NavLink to="/search">Search</NavLink>
      <NavLink to="/upload">Upload</NavLink>
    </nav>
  </div>
);

const PlayerBar = ({
  track,
  buffering,
  playing,
  progress,
  onPlayPause,
  onSkipNext,
  onSkipPrev,
}: PlayerBarProps) => (
  <footer className="player-footer">
    <div className="flex-1 min-w-0">
      {track ? (
        <>
          <p className="font-semibold truncate">{track.title}</p>
          <p className="text-sm text-white/60 truncate">{track.artist}</p>
        </>
      ) : (
        <p className="text-white/60">Select a track to start listening</p>
      )}
    </div>

    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-3">
        <button
          aria-label="Previous"
          disabled={!track}
          onClick={onSkipPrev}
          className="text-white/70 hover:text-white disabled:opacity-30"
        >
          ⏮
        </button>
        <button
          aria-label="Play/Pause"
          disabled={!track}
          onClick={onPlayPause}
          className="w-12 h-12 rounded-full bg-brand text-black font-semibold disabled:opacity-30"
        >
          {buffering ? '…' : playing ? '❚❚' : '▶'}
        </button>
        <button
          aria-label="Next"
          disabled={!track}
          onClick={onSkipNext}
          className="text-white/70 hover:text-white disabled:opacity-30"
        >
          ⏭
        </button>
      </div>
      <div className="w-64 h-1 bg-white/20 rounded-full overflow-hidden">
        <div
          className="h-full bg-brand transition-all"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
    </div>

    <div className="flex items-center gap-3 text-white/60">
      <span>🔊</span>
      <input type="range" min="0" max="100" defaultValue="80" className="w-28 accent-brand" />
    </div>
  </footer>
);
