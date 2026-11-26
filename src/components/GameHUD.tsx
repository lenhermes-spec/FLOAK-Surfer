import React from 'react';
import { GameStats } from '../game/constants';
import { Shield, Magnet, Zap, Volume2, VolumeX, Pause, Play } from 'lucide-react';
import { sounds } from '../audio/soundEffects';

interface GameHUDProps {
  stats: GameStats;
  isPaused: boolean;
  onTogglePause: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({ stats, isPaused, onTogglePause }) => {
  const [isMuted, setIsMuted] = React.useState(sounds.getMuted());

  const handleToggleSound = () => {
    const muted = sounds.toggleMute();
    setIsMuted(muted);
  };

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between px-3 sm:px-5 md:px-6 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] select-none z-10">
      {/* Top Header Row */}
      <div className="flex items-start justify-between gap-2">
        {/* Score & Multiplier */}
        <div className="flex flex-col gap-0.5 sm:gap-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] sm:text-xs font-semibold tracking-wider text-cyan-300 uppercase">
              Punkte
            </span>
            {stats.boostTimer > 0 && (
              <span className="px-2 py-0.5 text-[10px] sm:text-xs font-black tracking-wider bg-purple-500 text-white rounded-md shadow-sm">
                2X BOOST
              </span>
            )}
          </div>
          <div className="text-2xl sm:text-4xl md:text-5xl font-black text-white font-mono-numbers drop-shadow-md tracking-tight leading-none">
            {stats.score.toLocaleString('de-DE')}
          </div>
          <div className="flex items-center gap-2 sm:gap-3 text-[11px] sm:text-sm text-slate-300 font-mono-numbers mt-0.5">
            <span><strong className="text-white font-bold">{stats.distance} m</strong></span>
            <span className="text-slate-500">|</span>
            <span><strong className="text-cyan-300 font-bold">{Math.round(stats.speed)} km/h</strong></span>
          </div>
        </div>

        {/* Right Corner: Crystals & Controls */}
        <div
          className="flex items-center gap-1.5 sm:gap-3 shrink-0"
          onTouchStart={(e) => e.stopPropagation()}
        >
          {/* Crystals Pill */}
          <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-900/80 border border-cyan-500/30 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full shadow-lg">
            <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-sm rotate-45 bg-gradient-to-tr from-cyan-400 to-blue-300 shadow-sm shadow-cyan-400/50" />
            <span className="text-white font-black text-sm sm:text-lg font-mono-numbers">
              {stats.crystals}
            </span>
          </div>

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={handleToggleSound}
            aria-label={isMuted ? 'Ton einschalten' : 'Ton stummschalten'}
            className="pointer-events-auto p-2 sm:p-2.5 rounded-full bg-slate-900/80 border border-slate-700 text-slate-200 hover:text-white hover:bg-slate-800 transition shadow-md active:scale-95 cursor-pointer touch-manipulation"
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>

          {/* Pause Button */}
          <button
            type="button"
            onClick={onTogglePause}
            aria-label={isPaused ? 'Fortsetzen' : 'Pause'}
            className="pointer-events-auto p-2 sm:p-2.5 rounded-full bg-slate-900/80 border border-slate-700 text-slate-200 hover:text-white hover:bg-slate-800 transition shadow-md active:scale-95 cursor-pointer touch-manipulation"
          >
            {isPaused ? <Play size={18} /> : <Pause size={18} />}
          </button>
        </div>
      </div>

      {/* Active Power-Ups Tray */}
      <div className="flex items-center flex-wrap gap-2 justify-center mb-16 sm:mb-20 lg:mb-6">
        {stats.hasShield && (
          <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-cyan-950/80 border border-cyan-400 text-cyan-200 text-xs font-bold shadow-lg shadow-cyan-500/20">
            <Shield size={15} className="text-cyan-300" />
            <span>Schild aktiv</span>
          </div>
        )}

        {stats.magnetTimer > 0 && (
          <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-red-950/80 border border-red-400 text-red-200 text-xs font-bold shadow-lg shadow-red-500/20">
            <Magnet size={15} className="text-red-400" />
            <span>Magnet: {stats.magnetTimer.toFixed(1)}s</span>
          </div>
        )}

        {stats.boostTimer > 0 && (
          <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-purple-950/80 border border-purple-400 text-purple-200 text-xs font-bold shadow-lg shadow-purple-500/20">
            <Zap size={15} className="text-purple-400" />
            <span>Turbo: {stats.boostTimer.toFixed(1)}s</span>
          </div>
        )}
      </div>

      {/* Paused Overlay Banner */}
      {isPaused && (
        <div
          className="absolute inset-0 bg-slate-950/75 backdrop-blur-xs pointer-events-auto flex flex-col items-center justify-center gap-4 p-4"
          onTouchStart={(e) => e.stopPropagation()}
        >
          <div className="text-2xl sm:text-3xl font-black text-white tracking-wide">SPIEL PAUSIERT</div>
          <button
            type="button"
            onClick={onTogglePause}
            className="px-7 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded-xl shadow-lg transition active:scale-95 cursor-pointer"
          >
            Weiterspielen
          </button>
        </div>
      )}
    </div>
  );
};
