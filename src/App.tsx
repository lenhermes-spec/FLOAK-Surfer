/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { GameEngine } from './game/GameEngine';
import { GameStats } from './game/constants';
import { GameHUD } from './components/GameHUD';
import { StartScreen } from './components/StartScreen';
import { GameOverModal } from './components/GameOverModal';
import { TouchControls } from './components/TouchControls';
import { buildRankedLeaderboard } from './data/fictionalLeaderboard';

type GameState = 'ready' | 'playing' | 'gameover';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [gameState, setGameState] = useState<GameState>('ready');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [stats, setStats] = useState<GameStats>({
    score: 0,
    crystals: 0,
    distance: 0,
    highScore: 0,
    speed: 24,
    multiplier: 1,
    hasShield: false,
    magnetTimer: 0,
    boostTimer: 0,
    shieldTimer: 0,
  });

  const [playerName, setPlayerName] = useState<string>(() => {
    try {
      return localStorage.getItem('floak_player_name') || 'Du (Floak-Reiter)';
    } catch {
      return 'Du (Floak-Reiter)';
    }
  });
  const [bestRunMeta, setBestRunMeta] = useState<{ distance: number; crystals: number }>(() => {
    try {
      const saved = localStorage.getItem('floak_unicorn_best_meta');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          distance: Number(parsed?.distance) || 0,
          crystals: Number(parsed?.crystals) || 0,
        };
      }
    } catch {
      // Ignore
    }
    return { distance: 0, crystals: 0 };
  });

  // Load high score from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('floak_unicorn_highscore');
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val)) {
          setStats((prev) => ({ ...prev, highScore: val }));
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const handleChangePlayerName = useCallback((nextName: string) => {
    const clean = nextName.trim().slice(0, 18) || 'Du (Floak-Reiter)';
    setPlayerName(clean);
    try {
      localStorage.setItem('floak_player_name', clean);
    } catch {
      // Ignore
    }
  }, []);

  // Update stats and high score
  const handleStatsUpdate = useCallback((newStats: GameStats) => {
    setStats((prev) => {
      const best = Math.max(prev.highScore, newStats.score);
      if (best > prev.highScore) {
        setBestRunMeta({ distance: newStats.distance, crystals: newStats.crystals });
        try {
          localStorage.setItem('floak_unicorn_highscore', best.toString());
          localStorage.setItem(
            'floak_unicorn_best_meta',
            JSON.stringify({ distance: newStats.distance, crystals: newStats.crystals })
          );
        } catch {
          // Ignore
        }
      }
      return { ...newStats, highScore: best };
    });
  }, []);

  const handleGameOver = useCallback((finalStats: GameStats) => {
    setStats(finalStats);
    setGameState('gameover');
  }, []);

  const leaderboardEntries = useMemo(
    () =>
      buildRankedLeaderboard(
        playerName,
        stats.highScore,
        bestRunMeta.distance,
        bestRunMeta.crystals
      ),
    [playerName, stats.highScore, bestRunMeta.distance, bestRunMeta.crystals]
  );

  // Initialize GameEngine once
  useEffect(() => {
    if (!canvasMountRef.current) return;

    const engine = new GameEngine(
      canvasMountRef.current,
      handleStatsUpdate,
      handleGameOver
    );
    engineRef.current = engine;

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [handleStatsUpdate, handleGameOver]);

  // Touch swipe handling
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (gameState !== 'playing') return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || gameState !== 'playing' || !engineRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    const minSwipe = 25;

    if (Math.max(absX, absY) > minSwipe) {
      if (absX > absY) {
        if (dx > 0) engineRef.current.moveRight();
        else engineRef.current.moveLeft();
      } else {
        if (dy > 0) engineRef.current.slide();
        else engineRef.current.jump();
      }
    }
    touchStartRef.current = null;
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!engineRef.current) return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (gameState === 'playing') {
          setIsPaused((prev) => {
            const next = !prev;
            if (next) engineRef.current?.pauseGame();
            else engineRef.current?.resumeGame();
            return next;
          });
        }
        return;
      }

      if (gameState !== 'playing' || isPaused) return;

      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        e.preventDefault();
        engineRef.current.moveLeft();
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        e.preventDefault();
        engineRef.current.moveRight();
      } else if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') {
        e.preventDefault();
        engineRef.current.jump();
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        engineRef.current.slide();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, isPaused]);

  // Start game
  const handleStart = () => {
    if (!engineRef.current) return;
    setGameState('playing');
    setIsPaused(false);
    engineRef.current.startGame();
  };

  const handleTogglePause = () => {
    if (!engineRef.current || gameState !== 'playing') return;
    setIsPaused((prev) => {
      const next = !prev;
      if (next) engineRef.current?.pauseGame();
      else engineRef.current?.resumeGame();
      return next;
    });
  };

  return (
    <main
      className="relative w-full h-full overflow-hidden select-none touch-none bg-slate-950 font-sans"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* 3D WebGL Canvas Mount */}
      <div
        ref={canvasMountRef}
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* In-Game HUD Overlay */}
      {gameState === 'playing' && (
        <>
          <GameHUD
            stats={stats}
            isPaused={isPaused}
            onTogglePause={handleTogglePause}
          />
          <TouchControls
            onMoveLeft={() => engineRef.current?.moveLeft()}
            onMoveRight={() => engineRef.current?.moveRight()}
            onJump={() => engineRef.current?.jump()}
            onSlide={() => engineRef.current?.slide()}
          />
        </>
      )}

      {/* Start Game Modal */}
      {gameState === 'ready' && (
        <StartScreen
          onStart={handleStart}
          highScore={stats.highScore}
          entries={leaderboardEntries}
          playerName={playerName}
          onChangePlayerName={handleChangePlayerName}
        />
      )}

      {/* Game Over Screen */}
      {gameState === 'gameover' && (
        <GameOverModal
          stats={stats}
          onRestart={handleStart}
          entries={leaderboardEntries}
          playerName={playerName}
          onChangePlayerName={handleChangePlayerName}
        />
      )}
    </main>
  );
}
