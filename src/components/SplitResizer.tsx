import React, { useCallback, useRef } from 'react';
import { GripHorizontal } from 'lucide-react';

interface SplitResizerProps {
  splitRatio: number; // between 0.15 and 0.85 (percentage allocated to top panel)
  onRatioChange: (newRatio: number) => void;
  isNightVision: boolean;
  onDoubleReset?: () => void;
}

export const SplitResizer: React.FC<SplitResizerProps> = ({
  splitRatio,
  onRatioChange,
  isNightVision,
  onDoubleReset,
}) => {
  const isDraggingRef = useRef<boolean>(false);
  const containerRectRef = useRef<{ top: number; height: number }>({ top: 0, height: 1 });

  const startDrag = useCallback(
    (clientY: number, currentTarget: HTMLElement, pointerId?: number) => {
      isDraggingRef.current = true;
      const parent = currentTarget.parentElement;
      if (parent) {
        const rect = parent.getBoundingClientRect();
        containerRectRef.current = {
          top: rect.top,
          height: Math.max(rect.height, 100),
        };
      }
      if (pointerId !== undefined && currentTarget.setPointerCapture) {
        try {
          currentTarget.setPointerCapture(pointerId);
        } catch {
          // ignore
        }
      }
    },
    []
  );

  const updateDrag = useCallback(
    (clientY: number) => {
      if (!isDraggingRef.current) return;
      const { top, height } = containerRectRef.current;
      const relativeY = clientY - top;
      const rawRatio = relativeY / height;
      // Clamped between 20% and 80%
      const clampedRatio = Math.max(0.2, Math.min(0.8, rawRatio));
      onRatioChange(clampedRatio);
    },
    [onRatioChange]
  );

  const stopDrag = useCallback((currentTarget?: HTMLElement, pointerId?: number) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      if (currentTarget && pointerId !== undefined && currentTarget.releasePointerCapture) {
        try {
          currentTarget.releasePointerCapture(pointerId);
        } catch {
          // ignore
        }
      }
    }
  }, []);

  return (
    <div
      id="split-viewport-resizer-bar"
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        startDrag(e.clientY, e.currentTarget as HTMLElement, e.pointerId);
      }}
      onPointerMove={(e) => {
        if (isDraggingRef.current) {
          e.preventDefault();
          e.stopPropagation();
          updateDrag(e.clientY);
        }
      }}
      onPointerUp={(e) => {
        e.preventDefault();
        e.stopPropagation();
        stopDrag(e.currentTarget as HTMLElement, e.pointerId);
      }}
      onPointerCancel={(e) => {
        stopDrag(e.currentTarget as HTMLElement, e.pointerId);
      }}
      onDoubleClick={() => {
        if (onDoubleReset) onDoubleReset();
        else onRatioChange(0.5);
      }}
      title="Arraste para redimensionar Câmera / Mapa (Toque duplo para 50/50)"
      className={`relative z-20 w-full h-4 -my-2 flex items-center justify-center cursor-row-resize select-none touch-none group`}
    >
      {/* Visual Divider Line */}
      <div
        className={`w-full h-[3px] transition-all duration-150 group-hover:h-[5px] group-active:h-[5px] flex items-center justify-center ${
          isNightVision
            ? 'bg-red-900/80 group-hover:bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'
            : 'bg-zinc-800 group-hover:bg-cyan-500 group-active:bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.4)]'
        }`}
      >
        {/* Center Grab Handle Pill */}
        <div
          className={`px-3 py-0.5 rounded-full border flex items-center gap-1.5 transition-all transform group-hover:scale-105 group-active:scale-95 shadow-md ${
            isNightVision
              ? 'bg-black border-red-700/80 text-red-400'
              : 'bg-zinc-950 border-zinc-700 text-zinc-300 group-hover:border-cyan-500 group-hover:text-cyan-300'
          }`}
        >
          <GripHorizontal className="w-3.5 h-3.5" />
          <span className="text-[8px] font-mono font-bold tracking-widest hidden sm:inline uppercase">
            {Math.round(splitRatio * 100)}% / {Math.round((1 - splitRatio) * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
};
