import React from 'react';
import { ArrowLeft, ArrowRight, ArrowUp, ArrowDown } from 'lucide-react';

interface TouchControlsProps {
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onJump: () => void;
  onSlide: () => void;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  onMoveLeft,
  onMoveRight,
  onJump,
  onSlide,
}) => {
  const handleTrigger = (action: () => void) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    action();
  };

  return (
    <div
      className="absolute inset-x-0 bottom-0 pointer-events-none px-3 sm:px-6 md:px-8 pb-[max(1rem,env(safe-area-inset-bottom))] flex justify-between items-end z-10 select-none"
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      {/* Left/Right Lane controls */}
      <div className="flex gap-2.5 sm:gap-3 pointer-events-auto">
        <button
          type="button"
          onPointerDown={handleTrigger(onMoveLeft)}
          aria-label="Nach links"
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-900/75 border border-slate-700/80 text-white flex items-center justify-center shadow-xl active:bg-cyan-500 active:text-slate-950 active:scale-90 transition backdrop-blur-xs cursor-pointer touch-none"
        >
          <ArrowLeft size={26} />
        </button>

        <button
          type="button"
          onPointerDown={handleTrigger(onMoveRight)}
          aria-label="Nach rechts"
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-900/75 border border-slate-700/80 text-white flex items-center justify-center shadow-xl active:bg-cyan-500 active:text-slate-950 active:scale-90 transition backdrop-blur-xs cursor-pointer touch-none"
        >
          <ArrowRight size={26} />
        </button>
      </div>

      {/* Jump/Slide controls */}
      <div className="flex gap-2.5 sm:gap-3 pointer-events-auto">
        <button
          type="button"
          onPointerDown={handleTrigger(onSlide)}
          aria-label="Ducken / Slide"
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-900/75 border border-slate-700/80 text-white flex flex-col items-center justify-center shadow-xl active:bg-amber-400 active:text-slate-950 active:scale-90 transition backdrop-blur-xs cursor-pointer touch-none"
        >
          <ArrowDown size={22} />
          <span className="text-[10px] font-black uppercase leading-none mt-0.5">Slide</span>
        </button>

        <button
          type="button"
          onPointerDown={handleTrigger(onJump)}
          aria-label="Springen"
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-900/75 border border-slate-700/80 text-white flex flex-col items-center justify-center shadow-xl active:bg-emerald-400 active:text-slate-950 active:scale-90 transition backdrop-blur-xs cursor-pointer touch-none"
        >
          <ArrowUp size={22} />
          <span className="text-[10px] font-black uppercase leading-none mt-0.5">Sprung</span>
        </button>
      </div>
    </div>
  );
};
