import React, { useState, useEffect } from 'react';
import { Trophy, Crown, Pencil, Check, X, Sparkles } from 'lucide-react';
import { LeaderboardEntry } from '../data/fictionalLeaderboard';

interface LeaderboardPanelProps {
  entries: LeaderboardEntry[];
  playerName: string;
  playerHighScore: number;
  onChangePlayerName: (name: string) => void;
  compact?: boolean;
}

export const LeaderboardPanel: React.FC<LeaderboardPanelProps> = ({
  entries,
  playerName,
  playerHighScore,
  onChangePlayerName,
  compact = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(playerName);

  useEffect(() => {
    setDraftName(playerName);
  }, [playerName]);

  const playerRankIndex = entries.findIndex((entry) => entry.isPlayer);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draftName.trim().slice(0, 18);
    if (trimmed) {
      onChangePlayerName(trimmed);
    } else {
      setDraftName(playerName);
    }
    setIsEditing(false);
  };

  return (
    <div className="w-full bg-slate-950/75 border border-slate-800/90 rounded-2xl p-3.5 sm:p-4 flex flex-col gap-3 text-left">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-400/35 flex items-center justify-center text-amber-300 shrink-0">
            <Trophy size={16} />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black text-white leading-none tracking-tight">
              Bestenliste
            </h2>
            <span className="text-[11px] text-slate-400">
              Winter-Surfer Rangliste
            </span>
          </div>
        </div>

        {playerRankIndex >= 0 ? (
          <div className="px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-400/40 text-cyan-300 text-[11px] font-bold font-mono-numbers">
            Dein Platz: #{playerRankIndex + 1}
          </div>
        ) : (
          <div className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 text-[11px] font-medium flex items-center gap-1">
            <Sparkles size={11} className="text-cyan-400" />
            <span>Top {entries.length}</span>
          </div>
        )}
      </div>

      {/* Player Name Bar */}
      <div className="rounded-xl bg-slate-900/90 border border-slate-800 px-3 py-2 flex items-center justify-between gap-2">
        {isEditing ? (
          <form onSubmit={handleSave} className="flex items-center gap-1.5 w-full">
            <input
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              maxLength={18}
              placeholder="Dein Spielername"
              autoFocus
              className="flex-1 min-w-0 bg-slate-950 border border-cyan-500/60 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-cyan-400"
            />
            <button
              type="submit"
              aria-label="Namen speichern"
              className="p-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer"
            >
              <Check size={13} />
            </button>
            <button
              type="button"
              onClick={() => {
                setDraftName(playerName);
                setIsEditing(false);
              }}
              aria-label="Abbrechen"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
            >
              <X size={13} />
            </button>
          </form>
        ) : (
          <>
            <div className="min-w-0 flex items-center gap-2">
              <span className="text-[11px] text-slate-400">Dein Name:</span>
              <span className="text-xs font-bold text-white truncate">
                {playerName}
              </span>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                aria-label="Spielername bearbeiten"
                className="text-slate-400 hover:text-cyan-300 transition cursor-pointer"
              >
                <Pencil size={12} />
              </button>
            </div>
            <div className="text-[11px] font-mono-numbers text-slate-400 shrink-0">
              {playerHighScore > 0 ? (
                <>
                  Bestwert:{' '}
                  <strong className="text-cyan-300">
                    {playerHighScore.toLocaleString('de-DE')}
                  </strong>
                </>
              ) : (
                <span>Noch kein Lauf</span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Rankings List */}
      <div
        className={`flex flex-col gap-1.5 overflow-y-auto pr-0.5 ${
          compact ? 'max-h-52 sm:max-h-60' : 'max-h-64 md:max-h-96'
        }`}
      >
        {entries.map((entry, idx) => {
          const rank = idx + 1;
          const isMe = Boolean(entry.isPlayer);

          let rankBadgeClass = 'bg-slate-800 text-slate-300 border-slate-700';
          if (rank === 1) {
            rankBadgeClass =
              'bg-amber-400/20 text-amber-300 border-amber-400/50';
          } else if (rank === 2) {
            rankBadgeClass =
              'bg-slate-300/20 text-slate-200 border-slate-300/40';
          } else if (rank === 3) {
            rankBadgeClass =
              'bg-orange-500/20 text-orange-300 border-orange-400/40';
          }

          return (
            <div
              key={entry.id}
              className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl border text-xs transition ${
                isMe
                  ? 'bg-cyan-500/15 border-cyan-400/55 shadow-sm shadow-cyan-500/10'
                  : 'bg-slate-900/75 border-slate-800/80'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-6 h-6 rounded-lg border flex items-center justify-center font-black font-mono-numbers text-[11px] shrink-0 ${rankBadgeClass}`}
                >
                  {rank === 1 ? <Crown size={12} /> : rank}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`font-bold truncate ${
                        isMe ? 'text-cyan-200' : 'text-white'
                      }`}
                    >
                      {entry.playerName}
                    </span>
                    {isMe && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-cyan-400 text-slate-950 leading-none">
                        Du
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono-numbers">
                    {entry.distance.toLocaleString('de-DE')} m • {entry.crystals}{' '}
                    Kristalle
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="font-black font-mono-numbers text-sm text-cyan-300 leading-none">
                  {entry.score.toLocaleString('de-DE')}
                </div>
                <div className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold">
                  Pkt.
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
