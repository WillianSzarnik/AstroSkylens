import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Globe, MapPin, Sun, Maximize2, Minimize2, RotateCcw, Move } from 'lucide-react';
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

// Vector polygons of continents [lat, lon]
const CONTINENTS_DATA: { name: string; rings: [number, number][][] }[] = [
  // South America
  {
    name: 'América do Sul',
    rings: [
      [
        [12, -72], [11, -63], [7, -58], [4, -51], [-1, -48], [-4, -36],
        [-10, -36], [-15, -39], [-23, -42], [-30, -50], [-38, -57], [-46, -66],
        [-54, -68], [-55, -73], [-50, -75], [-42, -74], [-30, -71], [-18, -70],
        [-10, -78], [-4, -81], [2, -79], [8, -77], [12, -72],
      ],
    ],
  },
  // North America & Central America
  {
    name: 'América do Norte',
    rings: [
      [
        [71, -156], [70, -130], [68, -90], [58, -62], [48, -53], [44, -64],
        [35, -75], [26, -80], [29, -89], [25, -97], [20, -97], [16, -92],
        [9, -78], [15, -88], [21, -106], [32, -117], [40, -124], [49, -125],
        [58, -136], [60, -148], [65, -168], [71, -156],
      ],
      // Greenland
      [
        [83, -30], [77, -18], [68, -26], [60, -44], [67, -54], [78, -68], [83, -30],
      ],
    ],
  },
  // Africa
  {
    name: 'África',
    rings: [
      [
        [37, 10], [32, 32], [28, 34], [15, 42], [12, 51], [2, 45],
        [-5, 39], [-15, 40], [-26, 33], [-34, 18], [-33, 27], [-22, 14],
        [-8, 13], [4, 9], [6, 2], [5, -4], [15, -17], [26, -15],
        [35, -6], [37, 10],
      ],
      // Madagascar
      [
        [-12, 49], [-25, 47], [-25, 43], [-14, 47], [-12, 49],
      ],
    ],
  },
  // Eurasia
  {
    name: 'Eurásia',
    rings: [
      [
        [70, 28], [76, 60], [77, 105], [72, 140], [66, 170], [55, 140],
        [43, 132], [38, 120], [30, 122], [22, 114], [14, 109], [1, 104],
        [15, 96], [22, 89], [10, 79], [23, 69], [25, 56], [30, 48],
        [36, 36], [41, 29], [46, 14], [36, -5], [44, -1], [48, -4],
        [54, 8], [60, 10], [60, 25], [70, 28],
      ],
      // Great Britain
      [
        [58, -4], [52, 1], [50, -5], [58, -4],
      ],
      // Japan
      [
        [44, 144], [35, 140], [33, 130], [38, 138], [44, 144],
      ],
    ],
  },
  // Australia & New Zealand
  {
    name: 'Oceania',
    rings: [
      [
        [-12, 132], [-14, 136], [-25, 151], [-37, 150], [-38, 140],
        [-34, 115], [-22, 114], [-15, 124], [-12, 132],
      ],
    ],
  },
  // Antarctica
  {
    name: 'Antártida',
    rings: [
      [
        [-65, -60], [-70, -10], [-68, 60], [-66, 110], [-68, 150],
        [-72, -170], [-72, -120], [-65, -60],
      ],
    ],
  },
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

  // Position draggable state with safe initial placement inside viewport
  const { position, isDragging, elementRef, dragProps } = useDraggable({
    storageKey: 'globe_widget_v2',
    initialPosition: {
      x: typeof window !== 'undefined' ? Math.max(12, window.innerWidth - 170) : 180,
      y: typeof window !== 'undefined' ? Math.max(60, window.innerHeight - 380) : 260,
    },
  });

  // Drag rotation state for 3D globe
  const isRotatingRef = useRef<boolean>(false);
  const lastMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Sync with observer coordinates when auto-tracking is active
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

    const dpr = window.devicePixelRatio || 1;
    const logicalSize = isExpanded ? 200 : 124;
    const width = logicalSize;
    const height = logicalSize;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = logicalSize * 0.44;

    // Reset & set transform for Retina scale
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const deg2rad = Math.PI / 180;
    const centerLatRad = globeRotLat * deg2rad;
    const centerLonRad = globeRotLon * deg2rad;

    // 3D Orthographic Projection function (lat, lon) -> (x, y, visible, depth)
    const project3D = (
      latDeg: number,
      lonDeg: number
    ): { x: number; y: number; visible: boolean; depth: number } => {
      const lat = latDeg * deg2rad;
      const lon = lonDeg * deg2rad;

      const cosLat = Math.cos(lat);
      const sinLat = Math.sin(lat);
      const cosLonDiff = Math.cos(lon - centerLonRad);
      const sinLonDiff = Math.sin(lon - centerLonRad);

      const cosCenterLat = Math.cos(centerLatRad);
      const sinCenterLat = Math.sin(centerLatRad);

      // 3D Cartesian coordinates on unit sphere
      const x3d = cosLat * sinLonDiff;
      const y3d = cosCenterLat * sinLat - sinCenterLat * cosLat * cosLonDiff;
      const z3d = sinCenterLat * sinLat + cosCenterLat * cosLat * cosLonDiff;

      const visible = z3d > 0.02; // Small threshold to avoid edge clipping noise
      const screenX = centerX + x3d * radius;
      const screenY = centerY - y3d * radius;

      return { x: screenX, y: screenY, visible, depth: z3d };
    };

    // 1. Globe Base Ocean Gradient & Atmospheric Shading
    const oceanGrad = ctx.createRadialGradient(
      centerX - radius * 0.35,
      centerY - radius * 0.35,
      radius * 0.15,
      centerX,
      centerY,
      radius
    );

    if (isNightVision) {
      oceanGrad.addColorStop(0, '#2b0a0a');
      oceanGrad.addColorStop(0.65, '#140303');
      oceanGrad.addColorStop(1, '#050000');
    } else {
      oceanGrad.addColorStop(0, '#0c2e59');
      oceanGrad.addColorStop(0.7, '#071830');
      oceanGrad.addColorStop(1, '#020813');
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = oceanGrad;
    ctx.fill();

    // Clip to globe sphere for all internal features
    ctx.clip();

    // 2. Latitude & Longitude Graticule
    ctx.lineWidth = 0.75;
    ctx.strokeStyle = isNightVision ? 'rgba(239, 68, 68, 0.18)' : 'rgba(56, 189, 248, 0.16)';

    // Parallels (every 30°)
    for (let lat = -60; lat <= 60; lat += 30) {
      ctx.beginPath();
      let started = false;
      for (let lon = -180; lon <= 180; lon += 4) {
        const pt = project3D(lat, lon);
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
      for (let lat = -85; lat <= 85; lat += 4) {
        const pt = project3D(lat, lon);
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

    // Equator Line (Lat = 0°) Highlight
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = isNightVision ? 'rgba(239, 68, 68, 0.45)' : 'rgba(34, 211, 238, 0.4)';
    ctx.beginPath();
    let eqStarted = false;
    for (let lon = -180; lon <= 180; lon += 3) {
      const pt = project3D(0, lon);
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

    // 3. Continents Landmass Polygons (Segment-based to prevent cross-sphere slicing)
    ctx.fillStyle = isNightVision ? 'rgba(185, 28, 28, 0.4)' : 'rgba(34, 197, 94, 0.32)';
    ctx.strokeStyle = isNightVision ? 'rgba(239, 68, 68, 0.75)' : 'rgba(74, 222, 128, 0.7)';
    ctx.lineWidth = 1.0;

    CONTINENTS_DATA.forEach((continent) => {
      continent.rings.forEach((ring) => {
        // Step 1: Stroke visible segment paths
        ctx.beginPath();
        for (let i = 0; i < ring.length; i++) {
          const p1 = ring[i];
          const p2 = ring[(i + 1) % ring.length];
          const pt1 = project3D(p1[0], p1[1]);
          const pt2 = project3D(p2[0], p2[1]);

          if (pt1.visible && pt2.visible) {
            ctx.moveTo(pt1.x, pt1.y);
            ctx.lineTo(pt2.x, pt2.y);
          }
        }
        ctx.stroke();

        // Step 2: Fill contiguous visible polygon
        ctx.beginPath();
        let fillStarted = false;
        ring.forEach(([lat, lon]) => {
          const pt = project3D(lat, lon);
          if (pt.visible) {
            if (!fillStarted) {
              ctx.moveTo(pt.x, pt.y);
              fillStarted = true;
            } else {
              ctx.lineTo(pt.x, pt.y);
            }
          }
        });
        if (fillStarted) {
          ctx.fill();
        }
      });
    });

    // 4. Solar Day/Night Terminator Shading
    const subsolar = calculateSubsolarPoint(new Date());
    const sunPt = project3D(subsolar.latitude, subsolar.longitude);

    const shadowGrad = ctx.createRadialGradient(
      sunPt.x,
      sunPt.y,
      radius * 0.35,
      sunPt.x,
      sunPt.y,
      radius * 1.8
    );
    shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    shadowGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.12)');
    shadowGrad.addColorStop(0.8, 'rgba(0, 0, 0, 0.65)');
    shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0.88)');

    ctx.fillStyle = shadowGrad;
    ctx.fillRect(0, 0, width, height);

    // Subsolar Sun point marker
    if (sunPt.visible) {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(sunPt.x, sunPt.y, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(251, 191, 36, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(sunPt.x, sunPt.y, 6.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 5. Observer Location Marker & Viewing Azimuth Vector
    const obsPt = project3D(observer.latitude, observer.longitude);

    if (obsPt.visible) {
      // Horizon coverage circle around observer
      ctx.lineWidth = 1;
      ctx.strokeStyle = isNightVision ? 'rgba(239, 68, 68, 0.6)' : 'rgba(34, 211, 238, 0.55)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(obsPt.x, obsPt.y, radius * 0.22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Heading Vector Line (Direction user is pointing the device into the sky)
      const headingRad = (orientation.heading - 90) * deg2rad;
      const arrowLen = radius * 0.26;
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

      // Observer pinpoint
      ctx.fillStyle = isNightVision ? '#ef4444' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(obsPt.x, obsPt.y, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Label "VOCÊ"
      ctx.fillStyle = isNightVision ? '#fca5a5' : '#ffffff';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('VOCÊ', obsPt.x, obsPt.y - 7);
    }

    ctx.restore();

    // 6. Outer Atmospheric Halo Ring
    ctx.strokeStyle = isNightVision ? 'rgba(239, 68, 68, 0.6)' : 'rgba(56, 189, 248, 0.6)';
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
    isExpanded,
  ]);

  // Handle Canvas Resize & Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const logicalSize = isExpanded ? 200 : 124;
    canvas.width = Math.floor(logicalSize * dpr);
    canvas.height = Math.floor(logicalSize * dpr);
    canvas.style.width = `${logicalSize}px`;
    canvas.style.height = `${logicalSize}px`;

    renderGlobe();
  }, [renderGlobe, isExpanded]);

  // Mouse & Touch Rotation handlers
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
      let next = prev - dx * 0.7;
      return ((next + 180) % 360 + 360) % 360 - 180;
    });

    setGlobeRotLat((prev) => Math.max(-80, Math.min(80, prev + dy * 0.7)));
  };

  const handleCanvasMouseUp = (e: React.MouseEvent) => {
    if (isRotatingRef.current) {
      e.stopPropagation();
      isRotatingRef.current = false;
    }
  };

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
      let next = prev - dx * 0.7;
      return ((next + 180) % 360 + 360) % 360 - 180;
    });

    setGlobeRotLat((prev) => Math.max(-80, Math.min(80, prev + dy * 0.7)));
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
        } ${isExpanded ? 'p-3 w-56 sm:w-60' : 'p-2 w-36 sm:w-40'}`}
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
              GLOBO 3D
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
            isExpanded ? 'w-[200px] h-[200px]' : 'w-[124px] h-[124px]'
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
            className="rounded-full block pointer-events-none"
          />
        </div>

        {/* Telemetry / Coordinates Footer */}
        <div className="w-full mt-1.5 pt-1.5 border-t border-zinc-800/80 flex flex-col gap-1 text-[8px] font-mono text-zinc-400">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <MapPin className="w-2.5 h-2.5 text-cyan-400" />
              <span className="truncate max-w-[90px]">{observer.cityName || 'Local Atual'}</span>
            </div>
            <span className="text-zinc-300">
              {observer.latitude.toFixed(1)}° • {observer.longitude.toFixed(1)}°
            </span>
          </div>

          {isExpanded && (
            <div className="flex items-center justify-between text-zinc-500 pt-0.5 border-t border-zinc-800/50">
              <span>TSL: {lstHours}h {lstMinutes}m</span>
              <span className="text-cyan-400 font-semibold">
                RUMO: {Math.round(orientation.heading)}°
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
