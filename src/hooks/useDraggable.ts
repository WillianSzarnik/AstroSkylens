import React, { useState, useRef, useEffect, useCallback } from 'react';

interface Position {
  x: number;
  y: number;
}

interface UseDraggableOptions {
  initialPosition?: Position;
  storageKey?: string;
  boundsPadding?: number;
}

export function useDraggable({
  initialPosition = { x: 0, y: 0 },
  storageKey,
  boundsPadding = 8,
}: UseDraggableOptions = {}) {
  // Try loading from localStorage if key provided
  const getSavedPosition = (): Position => {
    if (!storageKey) return initialPosition;
    try {
      const saved = localStorage.getItem(`draggable_pos_${storageKey}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return initialPosition;
  };

  const [position, setPosition] = useState<Position>(getSavedPosition);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startPosX: number; startPosY: number }>({
    mouseX: 0,
    mouseY: 0,
    startPosX: 0,
    startPosY: 0,
  });

  const elementRef = useRef<HTMLDivElement | null>(null);

  // Save to localStorage when position updates
  useEffect(() => {
    if (storageKey) {
      try {
        localStorage.setItem(`draggable_pos_${storageKey}`, JSON.stringify(position));
      } catch {
        // ignore
      }
    }
  }, [position, storageKey]);

  // Keep inside viewport on window resize
  useEffect(() => {
    const handleWindowResize = () => {
      if (!elementRef.current) return;
      const rect = elementRef.current.getBoundingClientRect();
      const maxX = window.innerWidth - rect.width - boundsPadding;
      const maxY = window.innerHeight - rect.height - boundsPadding;

      setPosition((prev) => ({
        x: Math.max(boundsPadding, Math.min(maxX, prev.x)),
        y: Math.max(boundsPadding, Math.min(maxY, prev.y)),
      }));
    };

    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [boundsPadding]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Only drag with primary mouse button / single touch
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    // Don't drag if clicking interactive child elements (buttons, sliders, inputs)
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('select') ||
      target.closest('canvas') || // don't drag whole widget when interacting with inner canvas
      target.dataset.noDrag === 'true'
    ) {
      return;
    }

    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startPosX: position.x,
      startPosY: position.y,
    };

    // Capture pointer
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    e.stopPropagation();
  }, [position]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;

    const dx = e.clientX - dragStartRef.current.mouseX;
    const dy = e.clientY - dragStartRef.current.mouseY;

    let nextX = dragStartRef.current.startPosX + dx;
    let nextY = dragStartRef.current.startPosY + dy;

    // Clamp inside viewport
    if (elementRef.current) {
      const rect = elementRef.current.getBoundingClientRect();
      const minX = boundsPadding;
      const minY = boundsPadding;
      const maxX = Math.max(minX, window.innerWidth - rect.width - boundsPadding);
      const maxY = Math.max(minY, window.innerHeight - rect.height - boundsPadding);

      nextX = Math.max(minX, Math.min(maxX, nextX));
      nextY = Math.max(minY, Math.min(maxY, nextY));
    }

    setPosition({ x: nextX, y: nextY });
    e.stopPropagation();
  }, [isDragging, boundsPadding]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {
        // ignore
      }
      e.stopPropagation();
    }
  }, [isDragging]);

  const resetPosition = useCallback((newPos: Position) => {
    setPosition(newPos);
  }, []);

  return {
    position,
    setPosition,
    resetPosition,
    isDragging,
    elementRef,
    dragProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
}
