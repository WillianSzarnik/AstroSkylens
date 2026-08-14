import React, { useState } from 'react';
import { Compass, Navigation, Eye, Maximize2, Minimize2, Move } from 'lucide-react';
import { DeviceOrientationState } from '../types/astronomy';
import { playClickSound } from '../utils/audioEffects';
import { useDraggable } from '../hooks/useDraggable';

interface CompassRoseProps {
  orientation: DeviceOrientationState;
  isNightVision: boolean;
  onAlignNorth?: () => void;
  className?: string;
}

export const CompassRose: React.FC<CompassRoseProps> = ({
  orientation,
  isNightVision,
  onAlignNorth,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Position draggable state with localStorage persistence
  const { position, isDragging, elementRef, dragProps } = useDraggable({
    storageKey: 'compass_widget',
    initialPosition: {
      x: typeof window !== 'undefined' ? Math.max(16, window.innerWidth - 180) : 200,
      y: typeof window !== 'undefined' ? Math.max(16, window.innerHeight - 220) : 500,
    },
  });

  const heading = ((orientation.heading % 360) + 360) % 360;
  const pitch = Math.round(orientation.pitch);

  const getCardinalDirection = (deg: number): string => {
    const val = Math.floor((deg / 22.5) + 0.5);
    const arr = ['N', 'NNE', 'NE', 'ENE', 'L', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
    return arr[val % 16];
  };

  const cardinal = getCardinalDirection(heading);

  return (
    <div
      id="compass-rose-container"
      ref={elementRef}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        touchAction: 'none',
      }}
      className={`select-none z-40 transition-shadow ${
        isDragging ? 'scale-[1.02] shadow-[0_0_35px_rgba(34,211,238,0.4)] opacity-95' : ''
      } ${className}`}
    >
      <div
        id="compass-rose-card"
        className={`relative rounded-2xl backdrop-blur-xl border shadow-2xl transition-all overflow-hidden flex flex-col items-center ${
          isNightVision
            ? 'bg-black/90 border-red-900/60 shadow-[0_0_25px_rgba(239,68,68,0.25)]'
            : 'bg-[#08080a]/95 border-zinc-800/90 shadow-[0_0_30px_rgba(0,0,0,0.85)]'
        } ${isExpanded ? 'p-3 w-48 sm:w-56' : 'p-2 w-32 sm:w-36'}`}
      >
        {/* Header with drag handle & expand toggle */}
        <div
          {...dragProps}
          className="w-full flex items-center justify-between mb-1 cursor-move active:cursor-grabbing pb-1 border-b border-zinc-800/50"
          title="Arraste para reposicionar a bússola"
        >
          <div className="flex items-center gap-1">
            <Move className="w-2.5 h-2.5 text-zinc-500 hover:text-cyan-400 transition" />
            <Compass className={`w-3 h-3 ${isNightVision ? 'text-red-400' : 'text-cyan-400'}`} />
            <span className="text-[9px] font-mono font-bold tracking-wider uppercase text-zinc-300">
              BÚSSOLA
            </span>
          </div>

          <div className="flex items-center gap-0.5">
            <button
              id="btn-toggle-compass-expand"
              onClick={() => {
                playClickSound();
                setIsExpanded((v) => !v);
              }}
              title={isExpanded ? 'Reduzir Bússola' : 'Expandir Rosa dos Ventos'}
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition cursor-pointer"
            >
              {isExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* 360° Rotating Dial */}
        <div
          className={`relative flex items-center justify-center transition-all ${
            isExpanded ? 'w-36 h-36 my-1' : 'w-24 h-24 my-0.5'
          }`}
        >
          {/* Compass Dial Outer Ring */}
          <div
            id="compass-rotating-ring"
            className="absolute inset-0 rounded-full border border-dashed border-zinc-700/60 transition-transform duration-100 ease-out flex items-center justify-center"
            style={{ transform: `rotate(${-heading}deg)` }}
          >
            {/* Cardinal Points on rotating ring */}
            {/* North */}
            <span
              className={`absolute top-0.5 font-bold font-mono text-[10px] tracking-tight ${
                isNightVision ? 'text-red-400 font-extrabold' : 'text-cyan-400 font-extrabold'
              }`}
            >
              N
            </span>
            {/* East / Leste */}
            <span className="absolute right-1 font-bold font-mono text-[9px] text-zinc-300">
              L
            </span>
            {/* South */}
            <span className="absolute bottom-0.5 font-bold font-mono text-[9px] text-zinc-400">
              S
            </span>
            {/* West / Oeste */}
            <span className="absolute left-1 font-bold font-mono text-[9px] text-zinc-300">
              O
            </span>

            {/* Intercardinal points when expanded */}
            {isExpanded && (
              <>
                <span className="absolute top-3 right-3 font-mono text-[7px] text-zinc-500 font-semibold">
                  NE
                </span>
                <span className="absolute bottom-3 right-3 font-mono text-[7px] text-zinc-500 font-semibold">
                  SE
                </span>
                <span className="absolute bottom-3 left-3 font-mono text-[7px] text-zinc-500 font-semibold">
                  SO
                </span>
                <span className="absolute top-3 left-3 font-mono text-[7px] text-zinc-500 font-semibold">
                  NO
                </span>

                {/* 12 radial tick lines around dial */}
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-full h-[1px] pointer-events-none"
                    style={{ transform: `rotate(${i * 30}deg)` }}
                  >
                    <div
                      className={`h-[4px] w-[1px] mx-auto ${
                        i % 3 === 0
                          ? isNightVision
                            ? 'bg-red-500'
                            : 'bg-cyan-400'
                          : 'bg-zinc-600'
                      }`}
                    />
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Fixed Camera Direction Arrow (Top Center Pointer) */}
          <div className="absolute top-0 flex flex-col items-center pointer-events-none z-10">
            <div
              className={`w-0 h-0 border-x-4 border-x-transparent border-b-6 ${
                isNightVision ? 'border-b-red-500' : 'border-b-cyan-400'
              }`}
            />
          </div>

          {/* Central Digital Readout Hub */}
          <button
            id="btn-compass-align-north"
            onClick={() => {
              playClickSound();
              if (onAlignNorth) onAlignNorth();
            }}
            title="Toque para alinhar a visão ao Norte (0°)"
            className={`w-12 h-12 rounded-full border flex flex-col items-center justify-center transition-all cursor-pointer shadow-inner active:scale-90 z-20 ${
              isNightVision
                ? 'bg-black border-red-800 text-red-300'
                : 'bg-zinc-950 border-zinc-700 text-zinc-100 hover:border-cyan-500/70 hover:text-cyan-300'
            }`}
          >
            <span className="text-[11px] font-mono font-bold leading-none">
              {Math.round(heading)}°
            </span>
            <span
              className={`text-[8px] font-mono font-extrabold uppercase mt-0.5 ${
                isNightVision ? 'text-red-400' : 'text-cyan-400'
              }`}
            >
              {cardinal}
            </span>
          </button>
        </div>

        {/* Telemetry Footer */}
        <div className="w-full mt-1 pt-1 border-t border-zinc-800/80 flex items-center justify-between text-[8px] font-mono text-zinc-400">
          <div className="flex items-center gap-1">
            <Eye className="w-2.5 h-2.5 text-zinc-500" />
            <span>ALT: {pitch > 0 ? `+${pitch}°` : `${pitch}°`}</span>
          </div>
          <span
            className={`font-semibold ${
              isNightVision ? 'text-red-400' : 'text-cyan-400'
            }`}
          >
            {pitch > 45 ? 'ZÊNITE' : pitch < -10 ? 'TERRESTRE' : 'HORIZONTE'}
          </span>
        </div>
      </div>
    </div>
  );
};
