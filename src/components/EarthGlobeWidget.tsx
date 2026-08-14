import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Globe, MapPin, Sun, Moon, Maximize2, Minimize2, RotateCcw, Move } from 'lucide-react';
import { DeviceOrientationState, ObserverCoords } from '../types/astronomy';
import { calculateSubsolarPoint, getLST } from '../utils/astronomyEngine';
import { playClickSound } from '../utils/audioEffects';
import { useDraggable } from '../hooks/useDraggable';

interface EarthGlobeWidgetProps {
  observer: ObserverCoords;
  orientation: DeviceOrientationState;
  isNightVision: boolean;
  className?: string;
}

// Simplified continent polygons in [lat, lon] coordinates
const CONTINENTS_GEO: { name: string; paths: [number, number][][] }[] = [
  // South America
  {
    name: 'South America',
    paths: [
      [
        [12, -72], [10, -62], [5, -52], [-5, -35], [-12, -38], [-23, -42],
        [-34, -53], [-45, -65], [-55, -68], [-52, -75], [-40, -73], [-20, -70],
        [-5, -81], [5, -77], [10, -75], [12, -72]
      ]
    ]
  },
  // North America
  {
    name: 'North America',
    paths: [
      [
        [70, -160], [72, -130], [70, -85], [55, -55], [45, -65], [30, -80],
        [25, -80], [20, -90], [15, -90], [8, -78], [15, -95], [20, -105],
        [32, -117], [48, -125], [60, -145], [65, -168], [70, -160]
      ],
      // Greenland
      [
        [82, -40], [75, -20], [60, -45], [70, -55], [82, -40]
      ]
    ]
  },
  // Africa
  {
    name: 'Africa',
    paths: [
      [
        [36, -5], [37, 10], [32, 32], [22, 37], [12, 51], [5, 48],
        [-10, 40], [-25, 33], [-34, 18], [-33, 26], [-20, 12], [-5, 9],
        [5, 2], [5, -5], [15, -17], [28, -13], [36, -5]
      ],
      // Madagascar
      [
        [-12, 49], [-25, 47], [-25, 43], [-15, 45], [-12, 49]
      ]
    ]
  },
  // Eurasia
  {
    name: 'Eurasia',
    paths: [
      [
        [70, 25], [75, 60], [75, 100], [72, 140], [65, 170], [55, 140],
        [40, 120], [30, 122], [22, 114], [10, 105], [1, 104], [15, 95],
        [22, 88], [10, 80], [25, 68], [25, 55], [30, 48], [35, 35],
        [40, 28], [45, 13], [36, -5], [44, -1], [48, -4], [58, 5],
        [60, 25], [70, 25]
      ],
      // UK
      [
        [58, -3], [50, 1], [50, -5], [58, -3]
      ],
      // Japan
      [
        [45, 142], [35, 140], [32, 130], [38, 138], [45, 142]
      ]
    ]
  },
  // Australia
  {
    name: 'Australia',
    paths: [
      [
        [-12, 132], [-15, 136], [-25, 150], [-35, 150], [-38, 145],
        [-35, 115], [-20, 114], [-15, 125], [-12, 132]
      ]
    ]
  },
  // Antarctica
  {
    name: 'Antarctica',
    paths: [
      [
        [-65, -60], [-70, 0], [-68, 60], [-65, 120], [-70, 180],
        [-72, -120], [-65, -60]
      ]
    ]
  }
];

export const EarthGlobeWidget: React.FC<EarthGlobeWidgetProps> = ({
  observer,
  orientation,
  isNightVision,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [globeRotLat, setGlobeRotLat] = useState<number>(observer.latitude);
  const [globeRotLon, setGlobeRotLon] = useState<number>(observer.longitude);
  const [isAutoTracking, setIsAutoTracking] = useState<boolean>(true);

  // Position draggable state with localStorage persistence
  const { position, isDragging, elementRef, dragProps } = useDraggable({
    storageKey: 'globe_widget',
    initialPosition: {
      x: typeof window !== 'undefined' ? Math.max(16, window.innerWidth - 200) : 200,
      y: typeof window !== 'undefined' ? Math.max(16, window.innerHeight - 440) : 300,
    },
  });

  // Drag rotation state for inside canvas
  const isRotatingRef = useRef<boolean>(false);
  const lastMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Sync with observer coordinates when tracking is active
  useEffect(() => {
    if (isAutoTracking) {
      setGlobeRotLat(observer.latitude);
      setGlobeRotLon(observer.longitude);
    }
  }, [observer.latitude, observer.longitude, isAutoTracking]);

  // Center on observer
  const handleCenterObserver = () => {
    playClickSound();
    setIsAutoTracking(true);
    setGlobeRotLat(observer.latitude);
    setGlobeRotLon(observer.longitude);
  };

  // Render 3D Orthographic Globe
  const renderGlobe = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.44;

    ctx.clearRect(0, 0, width, height);

    const deg2rad = Math.PI / 180;

    const centerLatRad = globeRotLat * deg2rad;
    const centerLonRad = globeRotLon * deg2rad;

    // 3D Orthographic Projection function (lat, lon) -> (x, y, isFrontFacing)
    const projectToGlobe = (
      latDeg: number,
      lonDeg: number
    ): { x: number; y: number; visible: boolean; depth: number } => {
      const lat = latDeg * deg2rad;
      const lon = lonDeg * deg2rad;

      // 3D Cartesian coordinates on sphere (R = 1)
      const x3d = Math.cos(lat) * Math.sin(lon - centerLonRad);
      const y3d =
        Math.cos(centerLatRad) * Math.sin(lat) -
        Math.sin(centerLatRad) * Math.cos(lat) * Math.cos(lon - centerLonRad);
      const z3d =
        Math.sin(centerLatRad) * Math.sin(lat) +
        Math.cos(centerLatRad) * Math.cos(lat) * Math.cos(lon - centerLonRad);

      const isVisible = z3d > 0;
      const screenX = centerX + x3d * radius;
      const screenY = centerY - y3d * radius;

      return { x: screenX, y: screenY, visible: isVisible, depth: z3d };
    };

    // 1. Globe Base Ocean Gradient & Atmosphere Halo
    const oceanGrad = ctx.createRadialGradient(
      centerX - radius * 0.3,
      centerY - radius * 0.3,
      radius * 0.2,
      centerX,
      centerY,
      radius
    );

    if (isNightVision) {
      oceanGrad.addColorStop(0, '#2b0a0a');
      oceanGrad.addColorStop(0.7, '#150303');
      oceanGrad.addColorStop(1, '#050000');
    } else {
      oceanGrad.addColorStop(0, '#0f2744');
      oceanGrad.addColorStop(0.7, '#071526');
      oceanGrad.addColorStop(1, '#030a14');
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = oceanGrad;
    ctx.fill();

    // Clip to globe sphere for all internal drawing
    ctx.clip();

    // 2. Latitude and Longitude Graticule (Parallels & Meridians)
    ctx.lineWidth = 0.75;
    ctx.strokeStyle = isNightVision ? 'rgba(239, 68, 68, 0.18)' : 'rgba(56, 189, 248, 0.15)';

    // Parallels (every 30°)
    for (let lat = -60; lat <= 60; lat += 30) {
      ctx.beginPath();
      let started = false;
      for (let lon = -180; lon <= 180; lon += 5) {
        const pt = projectToGlobe(lat, lon);
        if (pt.visible) {
          if (!started) {
            ctx.moveTo(pt.x, pt.y);
            started = true;
          } else {
            ctx.lineTo(pt.x, pt.y);
          }
        } else {
          started = false;
        }
      }
      ctx.stroke();
    }

    // Meridians (every 30°)
    for (let lon = -180; lon < 180; lon += 30) {
      ctx.beginPath();
      let started = false;
      for (let lat = -85; lat <= 85; lat += 5) {
        const pt = projectToGlobe(lat, lon);
        if (pt.visible) {
          if (!started) {
            ctx.moveTo(pt.x, pt.y);
            started = true;
          } else {
            ctx.lineTo(pt.x, pt.y);
          }
        } else {
          started = false;
        }
      }
      ctx.stroke();
    }

    // Equator Line Highlight (Lat = 0°)
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = isNightVision ? 'rgba(239, 68, 68, 0.4)' : 'rgba(34, 211, 238, 0.35)';
    ctx.beginPath();
    let eqStarted = false;
    for (let lon = -180; lon <= 180; lon += 4) {
      const pt = projectToGlobe(0, lon);
      if (pt.visible) {
        if (!eqStarted) {
          ctx.moveTo(pt.x, pt.y);
          eqStarted = true;
        } else {
          ctx.lineTo(pt.x, pt.y);
        }
      } else {
        eqStarted = false;
      }
    }
    ctx.stroke();

    // 3. Continents Landmass Polygons
    ctx.fillStyle = isNightVision ? 'rgba(185, 28, 28, 0.45)' : 'rgba(34, 197, 94, 0.35)';
    ctx.strokeStyle = isNightVision ? 'rgba(239, 68, 68, 0.7)' : 'rgba(74, 222, 128, 0.65)';
    ctx.lineWidth = 1;

    CONTINENTS_GEO.forEach((continent) => {
      continent.paths.forEach((polygon) => {
        ctx.beginPath();
        let pathStarted = false;

        polygon.forEach(([lat, lon]) => {
          const pt = projectToGlobe(lat, lon);
          if (pt.visible) {
            if (!pathStarted) {
              ctx.moveTo(pt.x, pt.y);
              pathStarted = true;
            } else {
              ctx.lineTo(pt.x, pt.y);
            }
          }
        });

        if (pathStarted) {
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      });
    });

    // 4. Solar Day/Night Terminator Shading
    const subsolar = calculateSubsolarPoint(new Date());
    const sunPt = projectToGlobe(subsolar.latitude, subsolar.longitude);

    // Create night hemisphere shadow overlay
    const shadowGrad = ctx.createRadialGradient(
      sunPt.x,
      sunPt.y,
      radius * 0.4,
      sunPt.x,
      sunPt.y,
      radius * 1.8
    );
    shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    shadowGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.15)');
    shadowGrad.addColorStop(0.8, 'rgba(0, 0, 0, 0.65)');
    shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0.85)');

    ctx.fillStyle = shadowGrad;
    ctx.fillRect(0, 0, width, height);

    // Draw Subsolar Sun point marker if visible
    if (sunPt.visible) {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(sunPt.x, sunPt.y, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(251, 191, 36, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(sunPt.x, sunPt.y, 7, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 5. Observer Location Marker & Viewing Azimuth Vector
    const obsPt = projectToGlobe(observer.latitude, observer.longitude);

    if (obsPt.visible) {
      // Horizon coverage circle around observer
      ctx.lineWidth = 1;
      ctx.strokeStyle = isNightVision ? 'rgba(239, 68, 68, 0.5)' : 'rgba(34, 211, 238, 0.5)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(obsPt.x, obsPt.y, radius * 0.22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Heading Vector Line (Direction user is pointing the device into the sky)
      const headingRad = (orientation.heading - 90) * deg2rad;
      const arrowLen = radius * 0.25;
      const arrowEndX = obsPt.x + Math.cos(headingRad) * arrowLen;
      const arrowEndY = obsPt.y + Math.sin(headingRad) * arrowLen;

      ctx.lineWidth = 2;
      ctx.strokeStyle = isNightVision ? '#ef4444' : '#22d3ee';
      ctx.beginPath();
      ctx.moveTo(obsPt.x, obsPt.y);
      ctx.lineTo(arrowEndX, arrowEndY);
      ctx.stroke();

      // Heading Arrowhead
      ctx.fillStyle = isNightVision ? '#ef4444' : '#22d3ee';
      ctx.beginPath();
      ctx.arc(arrowEndX, arrowEndY, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Observer glowing pinpoint
      ctx.fillStyle = isNightVision ? '#ef4444' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(obsPt.x, obsPt.y, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Label "VOCÊ"
      ctx.fillStyle = isNightVision ? '#fca5a5' : '#ffffff';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('VOCÊ', obsPt.x, obsPt.y - 8);
    }

    ctx.restore();

    // 6. Outer Atmospheric Glow Ring
    ctx.strokeStyle = isNightVision ? 'rgba(239, 68, 68, 0.5)' : 'rgba(56, 189, 248, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();
  }, [
    globeRotLat,
    globeRotLon,
    observer.latitude,
    observer.longitude,
    orientation.heading,
    isNightVision,
  ]);

  // Handle Canvas Resize & Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const size = isExpanded ? 220 : 130;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);

    renderGlobe();
  }, [renderGlobe, isExpanded]);

  // Mouse / Touch Rotation inside canvas (prevent dragging whole modal)
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    isRotatingRef.current = true;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
    setIsAutoTracking(false);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!isRotatingRef.current) return;
    e.stopPropagation();
    const dx = e.clientX - lastMouseRef.current.x;
    const dy = e.clientY - lastMouseRef.current.y;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };

    setGlobeRotLon((prev) => {
      let next = prev - dx * 0.6;
      return ((next + 180) % 360 + 360) % 360 - 180;
    });

    setGlobeRotLat((prev) => Math.max(-80, Math.min(80, prev + dy * 0.6)));
  };

  const handleCanvasMouseUp = (e: React.MouseEvent) => {
    if (isRotatingRef.current) {
      e.stopPropagation();
      isRotatingRef.current = false;
    }
  };

  // Touch handlers for sphere rotation
  const handleCanvasTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      e.stopPropagation();
      isRotatingRef.current = true;
      lastMouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      setIsAutoTracking(false);
    }
  };

  const handleCanvasTouchMove = (e: React.TouchEvent) => {
    if (!isRotatingRef.current || e.touches.length !== 1) return;
    e.stopPropagation();
    const dx = e.touches[0].clientX - lastMouseRef.current.x;
    const dy = e.touches[0].clientY - lastMouseRef.current.y;
    lastMouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };

    setGlobeRotLon((prev) => {
      let next = prev - dx * 0.6;
      return ((next + 180) % 360 + 360) % 360 - 180;
    });

    setGlobeRotLat((prev) => Math.max(-80, Math.min(80, prev + dy * 0.6)));
  };

  const handleCanvasTouchEnd = (e: React.TouchEvent) => {
    if (isRotatingRef.current) {
      e.stopPropagation();
      isRotatingRef.current = false;
    }
  };

  const lst = getLST(new Date(), observer.longitude);
  const lstHours = Math.floor(lst);
  const lstMinutes = Math.floor((lst - lstHours) * 60);

  return (
    <div
      id="earth-globe-widget-root"
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
        id="earth-globe-card"
        className={`relative rounded-2xl backdrop-blur-xl border shadow-2xl transition-all overflow-hidden flex flex-col items-center ${
          isNightVision
            ? 'bg-black/90 border-red-900/60 shadow-[0_0_25px_rgba(239,68,68,0.25)]'
            : 'bg-[#08080a]/95 border-zinc-800/90 shadow-[0_0_30px_rgba(0,0,0,0.85)]'
        } ${isExpanded ? 'p-3 w-60 sm:w-64' : 'p-2 w-36 sm:w-40'}`}
      >
        {/* Header with drag handle */}
        <div
          {...dragProps}
          className="w-full flex items-center justify-between mb-1 cursor-move active:cursor-grabbing pb-1 border-b border-zinc-800/50"
          title="Arraste para reposicionar o globo"
        >
          <div className="flex items-center gap-1">
            <Move className="w-2.5 h-2.5 text-zinc-500 hover:text-cyan-400 transition" />
            <Globe className={`w-3 h-3 ${isNightVision ? 'text-red-400' : 'text-cyan-400'}`} />
            <span className="text-[9px] font-mono font-bold tracking-wider uppercase text-zinc-300">
              GLOBO TERRESTRE
            </span>
          </div>

          <div className="flex items-center gap-0.5">
            {!isAutoTracking && (
              <button
                id="btn-recenter-globe"
                onClick={handleCenterObserver}
                title="Focar na minha localização"
                className="p-1 rounded-md text-amber-400 hover:bg-zinc-800 transition cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}

            <button
              id="btn-toggle-globe-expand"
              onClick={() => {
                playClickSound();
                setIsExpanded((v) => !v);
              }}
              title={isExpanded ? 'Minimizar Globo' : 'Expandir Globo Terrestre'}
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition cursor-pointer"
            >
              {isExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* 3D Canvas Globe */}
        <div
          className={`relative flex items-center justify-center cursor-grab active:cursor-grabbing ${
            isExpanded ? 'w-[220px] h-[220px]' : 'w-[130px] h-[130px]'
          }`}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          onTouchStart={handleCanvasTouchStart}
          onTouchMove={handleCanvasTouchMove}
          onTouchEnd={handleCanvasTouchEnd}
        >
          <canvas
            ref={canvasRef}
            style={{ width: isExpanded ? 220 : 130, height: isExpanded ? 220 : 130 }}
            className="rounded-full block"
          />
        </div>

        {/* Telemetry / Coordinates Footer */}
        <div className="w-full mt-1.5 pt-1.5 border-t border-zinc-800/80 flex flex-col gap-1 text-[8px] font-mono text-zinc-400">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <MapPin className="w-2.5 h-2.5 text-cyan-400" />
              <span>{observer.cityName || 'Local Atual'}</span>
            </div>
            <span className="text-zinc-300">
              {observer.latitude.toFixed(1)}° Lat, {observer.longitude.toFixed(1)}° Lon
            </span>
          </div>

          {isExpanded && (
            <div className="flex items-center justify-between text-zinc-500 pt-0.5 border-t border-zinc-800/50">
              <span>TSL (Sideral): {lstHours}h {lstMinutes}m</span>
              <span className="text-cyan-400 font-semibold">
                DIREÇÃO: {Math.round(orientation.heading)}°
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
