import React, { useRef } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { playClickSound } from '../utils/audioEffects';

interface VirtualJoystickProps {
  onManualPan: (deltaHeading: number, deltaPitch: number) => void;
  onReset: () => void;
  isManualControl: boolean;
  isNightVision: boolean;
}

export const VirtualJoystick: React.FC<VirtualJoystickProps> = ({
  onManualPan,
  onReset,
  isManualControl,
  isNightVision,
}) => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startPan = (dHeading: number, dPitch: number) => {
    playClickSound();
    onManualPan(dHeading, dPitch);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      onManualPan(dHeading * 1.5, dPitch * 1.5);
    }, 80);
  };

  const stopPan = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  return (
    <div
      id="virtual-dpad-container"
      className={`relative w-28 h-28 rounded-full bg-zinc-950/90 backdrop-blur-md border shadow-2xl flex items-center justify-center select-none ${
        isNightVision
          ? 'border-red-900/60 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
          : 'border-zinc-800 shadow-[0_0_30px_rgba(0,0,0,0.8)]'
      }`}
    >
      {/* Up Button (Tilt Sky Up) */}
      <button
        id="dpad-up"
        onMouseDown={() => startPan(0, 4)}
        onMouseUp={stopPan}
        onMouseLeave={stopPan}
        onTouchStart={() => startPan(0, 4)}
        onTouchEnd={stopPan}
        title="Olhar para Cima (Zênite)"
        className="absolute top-1 left-1/2 -translate-x-1/2 p-1.5 text-zinc-400 hover:text-cyan-400 active:scale-90 transition cursor-pointer"
      >
        <ChevronUp className="w-5 h-5" />
      </button>

      {/* Down Button (Tilt Sky Down) */}
      <button
        id="dpad-down"
        onMouseDown={() => startPan(0, -4)}
        onMouseUp={stopPan}
        onMouseLeave={stopPan}
        onTouchStart={() => startPan(0, -4)}
        onTouchEnd={stopPan}
        title="Olhar para Baixo (Horizonte)"
        className="absolute bottom-1 left-1/2 -translate-x-1/2 p-1.5 text-zinc-400 hover:text-cyan-400 active:scale-90 transition cursor-pointer"
      >
        <ChevronDown className="w-5 h-5" />
      </button>

      {/* Left Button (Pan Sky Left) */}
      <button
        id="dpad-left"
        onMouseDown={() => startPan(-4, 0)}
        onMouseUp={stopPan}
        onMouseLeave={stopPan}
        onTouchStart={() => startPan(-4, 0)}
        onTouchEnd={stopPan}
        title="Girar para Esquerda"
        className="absolute left-1 top-1/2 -translate-y-1/2 p-1.5 text-zinc-400 hover:text-cyan-400 active:scale-90 transition cursor-pointer"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      {/* Right Button (Pan Sky Right) */}
      <button
        id="dpad-right"
        onMouseDown={() => startPan(4, 0)}
        onMouseUp={stopPan}
        onMouseLeave={stopPan}
        onTouchStart={() => startPan(4, 0)}
        onTouchEnd={stopPan}
        title="Girar para Direita"
        className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-zinc-400 hover:text-cyan-400 active:scale-90 transition cursor-pointer"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* Center Reset Button */}
      <button
        id="dpad-center-reset"
        onClick={() => {
          playClickSound();
          onReset();
        }}
        title="Recalibrar Giroscópio"
        className={`w-8 h-8 rounded-full flex items-center justify-center transition active:scale-90 cursor-pointer ${
          isManualControl
            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
            : 'bg-zinc-900 text-zinc-400 hover:text-cyan-400 border border-zinc-700'
        }`}
      >
        <RotateCcw className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
