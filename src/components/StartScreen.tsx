import React from 'react';
import { Play, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Sparkles, Shield, Ban } from 'lucide-react';
import { LeaderboardEntry } from '../data/fictionalLeaderboard';
import { LeaderboardPanel } from './LeaderboardPanel';

interface StartScreenProps {
  onStart: () => void;
  highScore: number;
  entries: LeaderboardEntry[];
  playerName: string;
  onChangePlayerName: (name: string) => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  onStart,
  highScore,
  entries,
  playerName,
  onChangePlayerName,
}) => {
  return (
    <div className="absolute inset-0 z-20 flex items-start md:items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="my-auto max-w-5xl w-full bg-slate-900/92 border border-slate-700/80 rounded-3xl p-4 sm:p-6 md:p-7 shadow-2xl relative overflow-hidden">
        {/* Decorative Aurora Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-48 bg-gradient-to-b from-cyan-500/20 via-blue-500/10 to-transparent blur-3xl pointer-events-none" />

        <div className="relative grid grid-cols-1 lg:grid-cols-[1.15fr_0.95fr] gap-5 md:gap-7 items-center">
          {/* Left Column: Hero, Controls & Start CTA */}
          <div className="flex flex-col items-center text-center">
            {/* Floak Unicorn Showcase Banner */}
            <div className="relative mb-2 flex items-center justify-center">
              <div className="absolute w-36 h-36 sm:w-44 sm:h-44 rounded-full bg-cyan-400/10 blur-xl" />
              <img
                src="/assets/aistudio/image_fc842681.png"
                alt="Floak Einhorn"
                className="w-36 h-32 sm:w-44 sm:h-40 md:w-48 md:h-44 object-contain drop-shadow-[0_12px_24px_rgba(56,189,248,0.35)] hover:scale-105 transition-transform duration-300"
              />
            </div>

            {/* Title */}
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="text-cyan-400 w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-cyan-400">
                Winter Runner
              </span>
              <Sparkles className="text-cyan-400 w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight leading-none mb-2.5">
              Floaki <span className="text-cyan-400">Winter Surfer</span>
            </h1>

            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-4 max-w-md">
              Galoppiere mit dem geschmeidigen, verchromten Floak Einhorn durch die Winterwelt! Weiche <strong className="text-red-400 font-semibold">AdBlockern</strong>, <strong className="text-amber-300 font-semibold">Cookie-Bannern</strong> und <strong className="text-orange-400 font-semibold">Drohnen</strong> aus.
            </p>

            {/* Controls Grid */}
            <div className="w-full grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4 text-left">
              <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-2.5 flex flex-col gap-1">
                <div className="flex items-center gap-1 text-cyan-300 font-bold text-[11px] uppercase tracking-wider">
                  <ArrowLeft size={13} />
                  <ArrowRight size={13} />
                  <span>Spur</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-tight">
                  Links / Rechts, <strong className="text-white">A / D</strong> oder Wischen
                </p>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-2.5 flex flex-col gap-1">
                <div className="flex items-center gap-1 text-emerald-400 font-bold text-[11px] uppercase tracking-wider">
                  <ArrowUp size={13} />
                  <span>Springen</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-tight">
                  Hoch / <strong className="text-white">W</strong> / <strong className="text-white">Space</strong>
                </p>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-2.5 flex flex-col gap-1 col-span-2 sm:col-span-1">
                <div className="flex items-center gap-1 text-amber-400 font-bold text-[11px] uppercase tracking-wider">
                  <ArrowDown size={13} />
                  <span>Slide</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-tight">
                  Runter / <strong className="text-white">S</strong> oder nach unten wischen
                </p>
              </div>
            </div>

            {/* Special hazards reminder */}
            <div className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 mb-4 flex flex-wrap items-center justify-around gap-2 text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5 text-red-400">
                <Ban size={13} />
                <span>AdBlock: Drüberspringen</span>
              </div>
              <div className="hidden sm:block w-px h-3.5 bg-slate-800" />
              <div className="flex items-center gap-1.5 text-cyan-300">
                <Shield size={13} />
                <span>Power-Ups aufsammeln</span>
              </div>
            </div>

            {/* High Score info if available */}
            {highScore > 0 && (
              <div className="mb-3 text-xs font-mono-numbers text-slate-400">
                Dein Bestwert: <strong className="text-cyan-300 text-sm font-bold">{highScore.toLocaleString('de-DE')} Pkt.</strong>
              </div>
            )}

            {/* Start Button */}
            <button
              type="button"
              onClick={onStart}
              className="w-full py-3.5 sm:py-4 px-6 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 hover:from-cyan-400 hover:via-blue-400 hover:to-indigo-500 text-slate-950 font-black text-base sm:text-lg tracking-wide uppercase shadow-lg shadow-cyan-500/30 hover:shadow-cyan-400/45 transform hover:-translate-y-0.5 active:translate-y-0 active:scale-98 transition flex items-center justify-center gap-2.5 cursor-pointer touch-manipulation"
            >
              <Play size={22} className="fill-slate-950" />
              <span>Start drücken & Punkte sammeln</span>
            </button>

            <span className="text-[11px] text-slate-400 mt-2.5">
              Spielbar am Desktop (Tastatur) und mobil (Touch & Wischen)
            </span>
          </div>

          {/* Right Column: Fictional Leaderboard */}
          <div className="w-full">
            <LeaderboardPanel
              entries={entries}
              playerName={playerName}
              playerHighScore={highScore}
              onChangePlayerName={onChangePlayerName}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
