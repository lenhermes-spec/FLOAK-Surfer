import React, { useEffect } from 'react';
import { RotateCcw, Trophy, Award, Footprints } from 'lucide-react';
import { GameStats } from '../game/constants';
import { LeaderboardEntry } from '../data/fictionalLeaderboard';
import { LeaderboardPanel } from './LeaderboardPanel';

interface GameOverModalProps {
  stats: GameStats;
  onRestart: () => void;
  entries: LeaderboardEntry[];
  playerName: string;
  onChangePlayerName: (name: string) => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  stats,
  onRestart,
  entries,
  playerName,
  onChangePlayerName,
}) => {
  const isNewHighScore = stats.score >= stats.highScore && stats.score > 0;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault();
        onRestart();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onRestart]);

  return (
    <div className="absolute inset-0 z-20 flex items-start md:items-center justify-center bg-slate-950/85 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="my-auto max-w-4xl w-full bg-slate-900 border border-slate-700/80 rounded-3xl p-4 sm:p-6 md:p-7 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Glow */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-32 bg-red-500/20 blur-3xl pointer-events-none" />

        <div className="relative grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 items-center">
          {/* Left Column: Run Summary & Restart */}
          <div className="flex flex-col items-center text-center">
            {/* Death Reason Badge */}
            <div className="px-3.5 py-1 rounded-full bg-red-950/80 border border-red-500/40 text-red-300 text-xs font-bold mb-2.5 flex items-center gap-1.5">
              <span>🛑 Lauf beendet</span>
            </div>

            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-1">
              Ausgebremst!
            </h2>

            <p className="text-slate-300 text-xs md:text-sm mb-4 max-w-xs leading-snug">
              {stats.reasonForDeath || 'Das Floak Einhorn wurde gestoppt!'}
            </p>

            {/* Score Display Card */}
            <div className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-4 mb-4 flex flex-col items-center">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">
                Gesammelte Punkte
              </span>
              <div className="text-4xl md:text-5xl font-black text-cyan-400 font-mono-numbers tracking-tight">
                {stats.score.toLocaleString('de-DE')}
              </div>

              {isNewHighScore && (
                <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-amber-300 bg-amber-950/60 border border-amber-500/30 px-3 py-1 rounded-full">
                  <Award size={14} />
                  <span>Neuer Bestwert!</span>
                </div>
              )}
            </div>

            {/* Stats Summary Grid */}
            <div className="w-full grid grid-cols-3 gap-2 mb-5">
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-2.5 flex flex-col items-center">
                <Footprints size={16} className="text-slate-400 mb-1" />
                <span className="text-[10px] text-slate-400 uppercase">Distanz</span>
                <span className="text-sm font-bold text-white font-mono-numbers">
                  {stats.distance} m
                </span>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-2.5 flex flex-col items-center">
                <div className="w-4 h-4 rounded-xs rotate-45 bg-cyan-400 mb-1 shadow-sm shadow-cyan-400/50" />
                <span className="text-[10px] text-slate-400 uppercase">Kristalle</span>
                <span className="text-sm font-bold text-cyan-300 font-mono-numbers">
                  {stats.crystals}
                </span>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-2.5 flex flex-col items-center">
                <Trophy size={16} className="text-amber-400 mb-1" />
                <span className="text-[10px] text-slate-400 uppercase">Bestwert</span>
                <span className="text-sm font-bold text-amber-300 font-mono-numbers">
                  {stats.highScore.toLocaleString('de-DE')}
                </span>
              </div>
            </div>

            {/* Restart Button */}
            <button
              type="button"
              onClick={onRestart}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 hover:from-cyan-400 hover:via-blue-400 hover:to-indigo-500 text-slate-950 font-black text-base md:text-lg tracking-wide uppercase shadow-lg shadow-cyan-500/30 hover:shadow-cyan-400/50 transform hover:-translate-y-0.5 active:scale-98 transition flex items-center justify-center gap-2.5 cursor-pointer touch-manipulation"
            >
              <RotateCcw size={20} />
              <span>Nochmal versuchen</span>
            </button>

            <span className="text-[11px] text-slate-400 mt-2.5">
              Tipp: Drücke die Leertaste zum schnellen Neustart
            </span>
          </div>

          {/* Right Column: Leaderboard */}
          <div className="w-full">
            <LeaderboardPanel
              entries={entries}
              playerName={playerName}
              playerHighScore={stats.highScore}
              onChangePlayerName={onChangePlayerName}
              compact
            />
          </div>
        </div>
      </div>
    </div>
  );
};
