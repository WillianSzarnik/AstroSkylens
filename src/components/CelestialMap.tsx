import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Compass,
  Sparkles,
  Layers,
  Search,
  Filter,
  Route,
  Orbit,
} from 'lucide-react';
import {
  CelestialObject,
  ConstellationData,
  DeviceOrientationState,
  ObserverCoords,
} from '../types/astronomy';
import {
  CONSTELLATIONS_CATALOG,
  getMoonPhase,
  calculateDiurnalMotionTrack,
  calculateEclipticLine,
  calculateCelestialEquator,
} from '../utils/astronomyEngine';
import { playClickSound } from '../utils/audioEffects';

interface CelestialMapProps {
  objects: CelestialObject[];
  orientation: DeviceOrientationState;
  observer: ObserverCoords;
  selectedObject: CelestialObject | null;
  onSelectObject: (obj: CelestialObject) => void;
  onManualLookaround?: (deltaAz: number, deltaAlt: number) => void;
  isManualControl: boolean;
  onResetToSensors: () => void;
  isNightVision: boolean;
}

export const CelestialMap: React.FC<CelestialMapProps> = ({
  objects,
  orientation,
  observer,
  selectedObject,
  onSelectObject,
  onManualLookaround,
  isManualControl,
  onResetToSensors,
  isNightVision,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Map view settings
  const [zoomLevel, setZoomLevel] = useState<number>(1.0); // 0.5x to 3.0x
  const [showConstellationLines, setShowConstellationLines] = useState<boolean>(true);
  const [showConstellationNames, setShowConstellationNames] = useState<boolean>(true);
  const [showStarNames, setShowStarNames] = useState<boolean>(true);
  const [showMotionTrails, setShowMotionTrails] = useState<boolean>(true); // Linhas de movimentação
  const [showEcliptic, setShowEcliptic] = useState<boolean>(true); // Linha da Eclíptica & Equador
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<string>('all'); // all, stars, planets, dso
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Drag tracking for manual pan
  const isDraggingRef = useRef<boolean>(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Touch pinch zoom
  const touchDistanceRef = useRef<number | null>(null);

  // Screen objects for hit-testing
  const projectedObjectsRef = useRef<{ obj: CelestialObject; x: number; y: number; radius: number }[]>([]);

  // Render Canvas Sky
  const renderSky = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    // Field of View in degrees (Base FOV ~ 70 deg, scaled by zoom)
    const fovDeg = 75 / zoomLevel;
    const fovRad = (fovDeg * Math.PI) / 180;
    const fovRadiusPx = Math.min(width, height) * 0.48;

    // Clear background
    ctx.clearRect(0, 0, width, height);

    // Deep space gradient
    const bgGrad = ctx.createRadialGradient(
      centerX,
      centerY,
      50,
      centerX,
      centerY,
      Math.max(width, height)
    );

    if (isNightVision) {
      bgGrad.addColorStop(0, '#1a0505');
      bgGrad.addColorStop(0.7, '#0d0202');
      bgGrad.addColorStop(1, '#050000');
    } else {
      bgGrad.addColorStop(0, '#0a0a14'); // obsidian deep space
      bgGrad.addColorStop(0.5, '#050508'); // pitch dark navy
      bgGrad.addColorStop(1, '#020202'); // pure obsidian
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Center of view
    const viewHeading = orientation.heading; // 0-360 deg
    const viewPitch = orientation.pitch; // -90 to +90 deg

    // Function to project celestial Alt/Az to Screen X/Y (Stereographic/Gnomonic style projection)
    const project = (azDeg: number, altDeg: number): { x: number; y: number; inView: boolean } => {
      // Calculate angular distance and direction relative to center of view
      const azDiff = ((azDeg - viewHeading + 540) % 360) - 180; // -180 to 180
      const altDiff = altDeg - viewPitch; // -180 to 180

      // Approximate tangential projection on canvas
      const x = centerX + (azDiff / (fovDeg / 2)) * (width / 2);
      const y = centerY - (altDiff / (fovDeg / 2)) * (height / 2);

      const inView = x >= -60 && x <= width + 60 && y >= -60 && y <= height + 60;
      return { x, y, inView };
    };

    // 1. Draw Azimuth / Altitude Grid Lines
    if (showGrid) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = isNightVision ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.12)';

      // Altitude concentric rings / horizontal parallels
      for (let alt = -60; alt <= 80; alt += 20) {
        ctx.beginPath();
        for (let az = viewHeading - fovDeg; az <= viewHeading + fovDeg; az += 5) {
          const pt = project(az, alt);
          if (az === viewHeading - fovDeg) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();

        // Altitude Label
        const labelPt = project(viewHeading - fovDeg * 0.4, alt);
        if (labelPt.inView) {
          ctx.fillStyle = isNightVision ? 'rgba(239, 68, 68, 0.4)' : 'rgba(148, 163, 184, 0.4)';
          ctx.font = '10px monospace';
          ctx.fillText(`${alt}°`, labelPt.x, labelPt.y - 3);
        }
      }

      // Azimuth vertical meridians
      for (let az = 0; az < 360; az += 30) {
        ctx.beginPath();
        for (let alt = -80; alt <= 80; alt += 5) {
          const pt = project(az, alt);
          if (alt === -80) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
      }
    }

    // 2. Draw Horizon Line (Altitude = 0°)
    ctx.lineWidth = 2;
    ctx.strokeStyle = isNightVision ? 'rgba(239, 68, 68, 0.6)' : 'rgba(34, 211, 238, 0.5)';
    ctx.beginPath();
    for (let az = viewHeading - fovDeg; az <= viewHeading + fovDeg; az += 2) {
      const pt = project(az, 0);
      if (az === viewHeading - fovDeg) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();

    // 3. Draw Cardinal Directions along the Horizon
    const cardinals = [
      { name: 'NORTE (N)', az: 0 },
      { name: 'NORDESTE (NE)', az: 45 },
      { name: 'LESTE (L)', az: 90 },
      { name: 'SUDESTE (SE)', az: 135 },
      { name: 'SUL (S)', az: 180 },
      { name: 'SUDOESTE (SO)', az: 225 },
      { name: 'OESTE (O)', az: 270 },
      { name: 'NOROESTE (NO)', az: 315 },
    ];

    cardinals.forEach((c) => {
      const pt = project(c.az, 0);
      if (pt.inView) {
        // Tag box
        ctx.fillStyle = isNightVision ? 'rgba(153, 27, 27, 0.8)' : 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = isNightVision ? 'rgba(239, 68, 68, 0.8)' : 'rgba(34, 211, 238, 0.8)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(pt.x - 30, pt.y - 12, 60, 20, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isNightVision ? '#fca5a5' : '#67e8f9';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(c.name, pt.x, pt.y + 2);
      }
    });

    // 4. Draw Ecliptic Line and Celestial Equator
    if (showEcliptic) {
      const now = new Date();

      // A. Ecliptic Plane (Caminho da Eclíptica / Sol)
      const eclipticPoints = calculateEclipticLine(observer.latitude, observer.longitude, now);
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = isNightVision ? 'rgba(239, 68, 68, 0.45)' : 'rgba(251, 191, 36, 0.45)';
      ctx.setLineDash([6, 4]);

      ctx.beginPath();
      let started = false;
      eclipticPoints.forEach((p) => {
        const pt = project(p.azimuth, p.altitude);
        if (!started) {
          ctx.moveTo(pt.x, pt.y);
          started = true;
        } else {
          // Avoid wraparound line artifacts when crossing view boundary
          const azDiff = Math.abs(((p.azimuth - viewHeading + 540) % 360) - 180);
          if (azDiff <= fovDeg * 1.2) {
            ctx.lineTo(pt.x, pt.y);
          } else {
            ctx.moveTo(pt.x, pt.y);
          }
        }
      });
      ctx.stroke();
      ctx.setLineDash([]);

      // Ecliptic Label along arc
      const sampleEcliptic = eclipticPoints.find((p) => {
        const azDiff = Math.abs(((p.azimuth - viewHeading + 540) % 360) - 180);
        return azDiff < fovDeg * 0.4 && p.altitude > 10;
      });
      if (sampleEcliptic) {
        const tagPt = project(sampleEcliptic.azimuth, sampleEcliptic.altitude);
        if (tagPt.inView) {
          ctx.fillStyle = isNightVision ? '#f87171' : '#fcd34d';
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('LINHA DA ECLÍPTICA', tagPt.x, tagPt.y - 6);
        }
      }

      // B. Celestial Equator (Equador Celeste)
      const equatorPoints = calculateCelestialEquator(observer.latitude, observer.longitude, now);
      ctx.lineWidth = 1.0;
      ctx.strokeStyle = isNightVision ? 'rgba(239, 68, 68, 0.3)' : 'rgba(56, 189, 248, 0.35)';
      ctx.setLineDash([3, 4]);

      ctx.beginPath();
      let eqStarted = false;
      equatorPoints.forEach((p) => {
        const pt = project(p.azimuth, p.altitude);
        if (!eqStarted) {
          ctx.moveTo(pt.x, pt.y);
          eqStarted = true;
        } else {
          const azDiff = Math.abs(((p.azimuth - viewHeading + 540) % 360) - 180);
          if (azDiff <= fovDeg * 1.2) {
            ctx.lineTo(pt.x, pt.y);
          } else {
            ctx.moveTo(pt.x, pt.y);
          }
        }
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 5. Draw Diurnal Motion Paths ("Linhas de Movimentação")
    if (showMotionTrails) {
      const now = new Date();
      const objectsToTrack: CelestialObject[] = [];

      // Always track selected object if present
      if (selectedObject) {
        objectsToTrack.push(selectedObject);
      }

      // Track Sun, Moon, and major bright planets
      objects.forEach((obj) => {
        if (
          (obj.type === 'sun' ||
            obj.type === 'moon' ||
            (obj.type === 'planet' && (obj.id === 'venus' || obj.id === 'jupiter' || obj.id === 'mars' || obj.id === 'saturn'))) &&
          !objectsToTrack.some((o) => o.id === obj.id)
        ) {
          objectsToTrack.push(obj);
        }
      });

      objectsToTrack.forEach((obj) => {
        const isSelected = selectedObject?.id === obj.id;
        const track = calculateDiurnalMotionTrack(obj, observer.latitude, observer.longitude, now);

        // 1. Draw Past & Future Continuous Trajectory
        ctx.save();
        ctx.lineWidth = isSelected ? 2.0 : 1.2;
        ctx.strokeStyle = isNightVision
          ? isSelected
            ? 'rgba(239, 68, 68, 0.8)'
            : 'rgba(239, 68, 68, 0.35)'
          : isSelected
          ? 'rgba(34, 211, 238, 0.85)'
          : obj.type === 'sun'
          ? 'rgba(251, 191, 36, 0.5)'
          : obj.type === 'moon'
          ? 'rgba(226, 232, 240, 0.45)'
          : 'rgba(129, 140, 248, 0.4)';

        ctx.setLineDash(isSelected ? [5, 3] : [3, 4]);

        ctx.beginPath();
        let pathStarted = false;
        track.points.forEach((p) => {
          const pt = project(p.azimuth, p.altitude);
          if (!pathStarted) {
            ctx.moveTo(pt.x, pt.y);
            pathStarted = true;
          } else {
            const azDiff = Math.abs(((p.azimuth - viewHeading + 540) % 360) - 180);
            if (azDiff <= fovDeg * 1.2) {
              ctx.lineTo(pt.x, pt.y);
            } else {
              ctx.moveTo(pt.x, pt.y);
            }
          }
        });
        ctx.stroke();
        ctx.setLineDash([]);

        // 2. Draw Directional Motion Arrows and Time Tick Markers
        track.points.forEach((p) => {
          if (p.timeLabel && p.altitude > -5) {
            const pt = project(p.azimuth, p.altitude);
            if (pt.inView) {
              // Motion arrow indicator for future hours
              if (p.timeOffsetHours > 0 && p.timeOffsetHours % 2 === 0) {
                ctx.fillStyle = isNightVision ? '#ef4444' : (isSelected ? '#22d3ee' : '#94a3b8');
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
                ctx.fill();

                ctx.font = '8px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(p.timeLabel, pt.x, pt.y - 5);
              }

              // Culmination or current tag
              if (p.timeOffsetHours === 0 && isSelected) {
                ctx.fillStyle = isNightVision ? '#ef4444' : '#22d3ee';
                ctx.font = 'bold 8px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(`TRAJETÓRIA: ${obj.name.toUpperCase()}`, pt.x, pt.y + 16);
              }
            }
          }
        });

        ctx.restore();
      });
    }

    // 6. Draw Constellation Lines and Names
    if (showConstellationLines) {
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = isNightVision ? 'rgba(239, 68, 68, 0.35)' : 'rgba(99, 102, 241, 0.4)';

      CONSTELLATIONS_CATALOG.forEach((constellation: ConstellationData) => {
        // Draw connecting lines between stars
        constellation.lines.forEach(([idxA, idxB]) => {
          const starA = constellation.stars[idxA];
          const starB = constellation.stars[idxB];
          if (!starA || !starB) return;

          // Find live coordinates from current objects list or recalculate
          const objA = objects.find((o) => o.id === starA.id) || starA;
          const objB = objects.find((o) => o.id === starB.id) || starB;

          if (objA.azimuth != null && objA.altitude != null && objB.azimuth != null && objB.altitude != null) {
            const ptA = project(objA.azimuth, objA.altitude);
            const ptB = project(objB.azimuth, objB.altitude);

            if (ptA.inView || ptB.inView) {
              ctx.beginPath();
              ctx.moveTo(ptA.x, ptA.y);
              ctx.lineTo(ptB.x, ptB.y);
              ctx.stroke();
            }
          }
        });

        // Constellation Name
        if (showConstellationNames) {
          const visibleStars = constellation.stars
            .map((s) => objects.find((o) => o.id === s.id))
            .filter((s): s is CelestialObject => s != null && s.azimuth != null && s.altitude != null);

          if (visibleStars.length > 0) {
            const avgAz = visibleStars.reduce((acc, s) => acc + (s.azimuth || 0), 0) / visibleStars.length;
            const avgAlt = visibleStars.reduce((acc, s) => acc + (s.altitude || 0), 0) / visibleStars.length;
            const centerPt = project(avgAz, avgAlt);

            if (centerPt.inView) {
              ctx.fillStyle = isNightVision ? 'rgba(252, 165, 165, 0.7)' : 'rgba(199, 210, 254, 0.75)';
              ctx.font = 'bold 11px sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText(constellation.name.toUpperCase(), centerPt.x, centerPt.y - 12);
            }
          }
        }
      });
    }

    // 7. Draw Celestial Objects (Stars, Planets, Moon, Sun, Deep Sky)
    const newProjected: { obj: CelestialObject; x: number; y: number; radius: number }[] = [];

    // Filter objects if user searched or filtered
    let filteredObjects = objects;
    if (filterType !== 'all') {
      filteredObjects = objects.filter((o) => {
        if (filterType === 'stars') return o.type === 'star';
        if (filterType === 'planets') return o.type === 'planet' || o.type === 'moon' || o.type === 'sun';
        if (filterType === 'dso') return o.type === 'galaxy' || o.type === 'nebula' || o.type === 'cluster' || o.type === 'satellite';
        return true;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filteredObjects = filteredObjects.filter(
        (o) => o.name.toLowerCase().includes(q) || o.constellation.toLowerCase().includes(q)
      );
    }

    // Sort to draw brighter objects on top
    const sorted = [...filteredObjects].sort((a, b) => b.mag - a.mag);

    sorted.forEach((obj) => {
      if (obj.azimuth == null || obj.altitude == null) return;

      const pt = project(obj.azimuth, obj.altitude);
      if (!pt.inView) return;

      const isSelected = selectedObject?.id === obj.id;

      // Base radius by apparent magnitude (brighter = larger)
      let radius = Math.max(1.8, Math.min(9, 6 - obj.mag * 0.8));
      if (obj.type === 'sun' || obj.type === 'moon') radius = 14;
      if (obj.type === 'planet') radius = Math.max(4.5, radius * 1.3);

      newProjected.push({ obj, x: pt.x, y: pt.y, radius: Math.max(radius, 14) });

      ctx.save();

      // Selected ring highlight
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius + 8, 0, Math.PI * 2);
        ctx.strokeStyle = isNightVision ? '#ef4444' : '#22d3ee';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Star Glow
      if (obj.mag < 1.5 || obj.type === 'planet' || obj.type === 'sun' || obj.type === 'moon') {
        const glowRadius = radius * (obj.type === 'sun' || obj.type === 'moon' ? 2.5 : 2.0);
        const glowGrad = ctx.createRadialGradient(pt.x, pt.y, radius * 0.5, pt.x, pt.y, glowRadius);
        glowGrad.addColorStop(0, obj.color || '#fff');
        glowGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, glowRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Moon Real Phase Drawing
      if (obj.type === 'moon') {
        const moonPhase = getMoonPhase();
        ctx.fillStyle = '#1e293b'; // dark side
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
        ctx.fill();

        // Bright crescent/side
        ctx.fillStyle = isNightVision ? '#fca5a5' : '#f8fafc';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius, -Math.PI / 2, Math.PI / 2, moonPhase.illumination < 0.5);
        ctx.fill();

        ctx.strokeStyle = isNightVision ? '#ef4444' : '#cbd5e1';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
        ctx.stroke();
      } else if (obj.type === 'sun') {
        ctx.fillStyle = isNightVision ? '#ef4444' : '#fbbf24';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
        ctx.fill();
      } else if (obj.type === 'galaxy' || obj.type === 'nebula') {
        // Deep Sky Object elliptical spiral
        ctx.fillStyle = isNightVision ? 'rgba(239, 68, 68, 0.4)' : (obj.color || 'rgba(192, 132, 252, 0.4)');
        ctx.beginPath();
        ctx.ellipse(pt.x, pt.y, radius * 1.6, radius * 0.9, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = isNightVision ? '#fca5a5' : (obj.color || '#c084fc');
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (obj.type === 'satellite') {
        // Satellite cross marker
        ctx.fillStyle = isNightVision ? '#ef4444' : '#34d399';
        ctx.fillRect(pt.x - 3, pt.y - 3, 6, 6);
        ctx.strokeStyle = isNightVision ? '#fca5a5' : '#a7f3d0';
        ctx.strokeRect(pt.x - 5, pt.y - 5, 10, 10);
      } else {
        // Standard Star / Planet solid body
        ctx.fillStyle = isNightVision ? '#fca5a5' : (obj.color || '#f8fafc');
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Star & Planet Labels
      if (showStarNames && (obj.mag <= 2.0 || obj.type === 'planet' || obj.type === 'moon' || isSelected)) {
        ctx.fillStyle = isNightVision ? '#fca5a5' : (isSelected ? '#22d3ee' : '#e2e8f0');
        ctx.font = isSelected ? 'bold 11px sans-serif' : '10px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(obj.name, pt.x + radius + 4, pt.y + 3);

        if (obj.type === 'planet') {
          ctx.fillStyle = isNightVision ? '#ef4444' : '#94a3b8';
          ctx.font = '8px monospace';
          ctx.fillText(`PLANETA`, pt.x + radius + 4, pt.y + 13);
        }
      }

      ctx.restore();
    });

    projectedObjectsRef.current = newProjected;

    // 8. Camera Field-Of-View (FOV) Reticle Frame
    // Demonstrates what the top camera viewport is looking at
    ctx.strokeStyle = isNightVision ? 'rgba(239, 68, 68, 0.4)' : 'rgba(34, 211, 238, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const reticleW = width * 0.28;
    const reticleH = height * 0.28;
    ctx.strokeRect(centerX - reticleW / 2, centerY - reticleH / 2, reticleW, reticleH);

    // Cross in center of map
    ctx.strokeStyle = isNightVision ? '#ef4444' : '#22d3ee';
    ctx.beginPath();
    ctx.moveTo(centerX - 10, centerY);
    ctx.lineTo(centerX + 10, centerY);
    ctx.moveTo(centerX, centerY - 10);
    ctx.lineTo(centerX, centerY + 10);
    ctx.stroke();

    // Field of view label
    ctx.fillStyle = isNightVision ? '#fca5a5' : '#38bdf8';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CAMPO DE VISÃO DA CÂMERA (AR)', centerX, centerY - reticleH / 2 - 6);
  }, [
    objects,
    orientation,
    observer.latitude,
    observer.longitude,
    selectedObject,
    zoomLevel,
    showConstellationLines,
    showConstellationNames,
    showStarNames,
    showMotionTrails,
    showEcliptic,
    showGrid,
    filterType,
    searchQuery,
    isNightVision,
  ]);

  // Handle Resize & Render loop
  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);

      renderSky();
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [renderSky]);

  // Re-render when dependencies update
  useEffect(() => {
    renderSky();
  }, [renderSky]);

  // Non-passive wheel and gesture listener on canvas for fluid zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      setZoomLevel((prev) => Math.max(0.5, Math.min(3.5, prev * zoomFactor)));
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, []);

  // Pointer Click / Touch Hit-Testing
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) * (window.devicePixelRatio || 1);
    const clickY = (e.clientY - rect.top) * (window.devicePixelRatio || 1);

    // Find clicked object
    let clicked: CelestialObject | null = null;
    let minDist = 25;

    for (const item of projectedObjectsRef.current) {
      const dx = item.x - clickX;
      const dy = item.y - clickY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        minDist = dist;
        clicked = item.obj;
      }
    }

    if (clicked) {
      playClickSound();
      onSelectObject(clicked);
    }
  };

  // Mouse / Touch Drag Pan Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !onManualLookaround) return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };

    // Invert delta for natural dragging
    const sensitivity = 0.25 / zoomLevel;
    onManualLookaround(-dx * sensitivity, dy * sensitivity);
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // Touch Handlers with Pinch Zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      isDraggingRef.current = true;
      lastMousePosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      isDraggingRef.current = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchDistanceRef.current = Math.hypot(dx, dy);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDraggingRef.current && onManualLookaround) {
      const dx = e.touches[0].clientX - lastMousePosRef.current.x;
      const dy = e.touches[0].clientY - lastMousePosRef.current.y;
      lastMousePosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      const sensitivity = 0.3 / zoomLevel;
      onManualLookaround(-dx * sensitivity, dy * sensitivity);
    } else if (e.touches.length === 2 && touchDistanceRef.current != null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const factor = dist / touchDistanceRef.current;
      touchDistanceRef.current = dist;
      setZoomLevel((prev) => Math.max(0.5, Math.min(3.5, prev * factor)));
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    touchDistanceRef.current = null;
  };

  return (
    <div
      id="celestial-map-container"
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden bg-[#08080a] select-none ${
        isNightVision ? 'night-vision-filter' : ''
      }`}
    >
      {/* Canvas */}
      <canvas
        id="sky-planetarium-canvas"
        ref={canvasRef}
        onClick={handleCanvasClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="w-full h-full cursor-grab active:cursor-grabbing block"
      />

      {/* Floating Toolbar & Status (Top-Left) */}
      <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10">
        {/* Sync with Sensor or Manual Pan Pill */}
        {isManualControl ? (
          <button
            id="btn-re-sync-gyro"
            onClick={onResetToSensors}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-950/90 backdrop-blur-md border border-amber-500/50 text-amber-300 text-[10px] font-mono tracking-wider shadow-lg hover:bg-amber-900 transition cursor-pointer animate-pulse"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>RE-SINCRONIZAR GIRO</span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/75 backdrop-blur-md border border-zinc-800 text-zinc-300 text-[10px] font-mono tracking-wider shadow-lg">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>SINCRONIZADO C/ AR</span>
          </div>
        )}
      </div>

      {/* Zoom Controls (Bottom-Right) */}
      <div className="absolute bottom-3 right-2 flex flex-col gap-1.5 z-10">
        <button
          id="btn-zoom-in"
          onClick={() => setZoomLevel((z) => Math.min(3.5, z + 0.3))}
          title="Aproximar Zoom"
          className="p-2 rounded-xl bg-zinc-900/90 backdrop-blur-md border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 shadow-lg active:scale-95 transition cursor-pointer"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          id="btn-zoom-out"
          onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.3))}
          title="Afastar Zoom"
          className="p-2 rounded-xl bg-zinc-900/90 backdrop-blur-md border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 shadow-lg active:scale-95 transition cursor-pointer"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
      </div>

      {/* Filter & Motion Path Quick Pills at Top-Right */}
      <div className="absolute top-2 right-2 flex items-center gap-1 z-10 flex-wrap justify-end">
        <button
          id="btn-toggle-motion-trails"
          onClick={() => {
            playClickSound();
            setShowMotionTrails((v) => !v);
          }}
          title="Alternar Linhas de Movimentação e Órbitas"
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl backdrop-blur-md border text-[10px] font-mono tracking-wider transition cursor-pointer ${
            showMotionTrails
              ? 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300 shadow-sm shadow-cyan-950/50'
              : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Route className="w-3 h-3 text-cyan-400" />
          <span>TRAJETÓRIAS</span>
        </button>

        <button
          id="btn-toggle-ecliptic"
          onClick={() => {
            playClickSound();
            setShowEcliptic((v) => !v);
          }}
          title="Alternar Linha da Eclíptica e Equador Celeste"
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl backdrop-blur-md border text-[10px] font-mono tracking-wider transition cursor-pointer ${
            showEcliptic
              ? 'bg-amber-950/80 border-amber-500/50 text-amber-300 shadow-sm shadow-amber-950/50'
              : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Orbit className="w-3 h-3 text-amber-400" />
          <span>ECLÍPTICA</span>
        </button>

        <button
          id="btn-toggle-constellations"
          onClick={() => setShowConstellationLines((v) => !v)}
          title="Alternar Linhas de Constelações"
          className={`px-2.5 py-1.5 rounded-xl backdrop-blur-md border text-[10px] font-mono tracking-wider transition cursor-pointer ${
            showConstellationLines
              ? 'bg-indigo-950/80 border-indigo-500/50 text-indigo-300'
              : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          CONSTELAÇÕES
        </button>

        <button
          id="btn-toggle-grid"
          onClick={() => setShowGrid((v) => !v)}
          title="Alternar Grade de Coordenadas"
          className={`px-2.5 py-1.5 rounded-xl backdrop-blur-md border text-[10px] font-mono tracking-wider transition cursor-pointer ${
            showGrid
              ? 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300'
              : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          GRADE
        </button>
      </div>
    </div>
  );
};
