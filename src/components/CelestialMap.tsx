import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Compass,
  Route,
  Orbit,
  Crosshair,
  Map as MapIcon,
  Info,
} from 'lucide-react';
import {
  CelestialObject,
  ConstellationData,
  DeviceOrientationState,
  ObserverCoords,
  SkyFiltersState,
} from '../types/astronomy';
import {
  CONSTELLATIONS_CATALOG,
  getMoonPhase,
  calculateDiurnalMotionTrack,
  calculateEclipticLine,
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
  skyFilters?: SkyFiltersState;
  onUpdateSkyFilters?: (filters: Partial<SkyFiltersState>) => void;
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
  skyFilters,
  onUpdateSkyFilters,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Map view settings
  const [projectionMode, setProjectionMode] = useState<'planisphere' | 'panoramic'>('planisphere'); // 'planisphere' (Carta Celeste) default
  const [zoomLevel, setZoomLevel] = useState<number>(1.0); // 0.5x to 3.5x
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 }); // Manual pan in Planisphere mode

  // Fallback filter toggles
  const [localConstellationLines, setLocalConstellationLines] = useState<boolean>(true);
  const [localMotionTrails, setLocalMotionTrails] = useState<boolean>(true);
  const [localEcliptic, setLocalEcliptic] = useState<boolean>(true);

  const showConstellationLines = skyFilters?.showConstellationLines ?? localConstellationLines;
  const showConstellationNames = skyFilters?.showConstellationNames ?? true;
  const showStars = skyFilters?.showStars ?? true;
  const showStarNames = skyFilters?.showStarNames ?? true;
  const showPlanets = skyFilters?.showPlanets ?? true;
  const showSatellites = skyFilters?.showSatellites ?? true;
  const showMotionTrails = skyFilters?.showMotionTrails ?? localMotionTrails;
  const showEcliptic = skyFilters?.showEcliptic ?? localEcliptic;
  const showGrid = skyFilters?.showGrid ?? true;

  // Drag tracking for manual pan
  const isDraggingRef = useRef<boolean>(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Touch pinch zoom
  const touchDistanceRef = useRef<number | null>(null);

  // Screen objects for hit-testing (stored in logical CSS coordinates)
  const projectedObjectsRef = useRef<{ obj: CelestialObject; x: number; y: number; radius: number }[]>([]);

  // Render Canvas Sky strictly using Logical CSS dimensions
  const renderSky = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const logicalWidth = rect.width;
    const logicalHeight = rect.height;

    if (logicalWidth === 0 || logicalHeight === 0) return;

    // Reset transform & scale for crisp Retina display
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const width = logicalWidth;
    const height = logicalHeight;

    // Center point calculated from logical width/height + manual pan offset
    const centerX = width / 2 + (projectionMode === 'planisphere' ? panOffset.x : 0);
    const centerY = height / 2 + (projectionMode === 'planisphere' ? panOffset.y : 0);

    // Deep space background gradient
    const bgGrad = ctx.createRadialGradient(
      centerX,
      centerY,
      40,
      centerX,
      centerY,
      Math.max(width, height)
    );

    if (isNightVision) {
      bgGrad.addColorStop(0, '#1c0505');
      bgGrad.addColorStop(0.7, '#0d0202');
      bgGrad.addColorStop(1, '#050000');
    } else {
      bgGrad.addColorStop(0, '#090a16');
      bgGrad.addColorStop(0.6, '#04050a');
      bgGrad.addColorStop(1, '#020204');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const viewHeading = orientation.heading; // 0-360 deg
    const viewPitch = orientation.pitch; // -90 to +90 deg

    // Projection calculation functions
    let project: (azDeg: number, altDeg: number) => { x: number; y: number; inView: boolean };

    if (projectionMode === 'planisphere') {
      // -------------------------------------------------------------
      // CARTA CELESTE (PLANISFÉRIO DOME PROJECTION)
      // -------------------------------------------------------------
      // Observer is at the center (Zenith = 90° Alt).
      // Radius reaches 0° Alt at the Horizon circle.
      // Rotates dynamically so the direction you are facing (viewHeading) is at the top.
      const domeRadius = Math.min(width, height) * 0.42 * zoomLevel;

      project = (azDeg: number, altDeg: number) => {
        const zenithAngleDeg = Math.max(0, 90 - altDeg); // 0 at zenith, 90 at horizon, >90 below
        const r = (zenithAngleDeg / 90) * domeRadius;

        // Relative azimuth: current heading is aligned to the top (-90 deg / -PI/2)
        const relAzRad = ((azDeg - viewHeading - 90) * Math.PI) / 180;
        const x = centerX + r * Math.cos(relAzRad);
        const y = centerY + r * Math.sin(relAzRad);

        const inView = x >= -50 && x <= width + 50 && y >= -50 && y <= height + 50;
        return { x, y, inView };
      };

      // 1. Draw Planisphere Outer Horizon Ring & Altitude Grid
      if (showGrid) {
        // Concentric altitude circles (30°, 60°)
        [30, 60].forEach((alt) => {
          const r = ((90 - alt) / 90) * domeRadius;
          ctx.beginPath();
          ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
          ctx.strokeStyle = isNightVision ? 'rgba(239, 68, 68, 0.18)' : 'rgba(56, 189, 248, 0.14)';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Altitude Label
          ctx.fillStyle = isNightVision ? 'rgba(239, 68, 68, 0.6)' : 'rgba(148, 163, 184, 0.6)';
          ctx.font = '9px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`ALT ${alt}°`, centerX, centerY - r + 11);
        });

        // Azimuth Spokes (N, NE, E, SE, S, SW, W, NW) rotating with heading
        for (let az = 0; az < 360; az += 45) {
          const rad = ((az - viewHeading - 90) * Math.PI) / 180;
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.lineTo(centerX + domeRadius * Math.cos(rad), centerY + domeRadius * Math.sin(rad));
          ctx.strokeStyle = isNightVision ? 'rgba(239, 68, 68, 0.14)' : 'rgba(56, 189, 248, 0.1)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // 2. Horizon Outer Circle (Alt = 0°)
      ctx.beginPath();
      ctx.arc(centerX, centerY, domeRadius, 0, Math.PI * 2);
      ctx.strokeStyle = isNightVision ? 'rgba(239, 68, 68, 0.8)' : 'rgba(34, 211, 238, 0.75)';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Outer Soft Glow Ring
      ctx.beginPath();
      ctx.arc(centerX, centerY, domeRadius + 3, 0, Math.PI * 2);
      ctx.strokeStyle = isNightVision ? 'rgba(239, 68, 68, 0.25)' : 'rgba(34, 211, 238, 0.2)';
      ctx.lineWidth = 6;
      ctx.stroke();

      // Cardinal Points along Horizon Rim (Dynamically rotating with Gyroscope Heading)
      const cardinals = [
        { name: 'N', az: 0 },
        { name: 'NE', az: 45 },
        { name: 'L', az: 90 },
        { name: 'SE', az: 135 },
        { name: 'S', az: 180 },
        { name: 'SO', az: 225 },
        { name: 'O', az: 270 },
        { name: 'NO', az: 315 },
      ];

      cardinals.forEach((c) => {
        const rad = ((c.az - viewHeading - 90) * Math.PI) / 180;
        const tagRadius = domeRadius + 14;
        const tagX = centerX + tagRadius * Math.cos(rad);
        const tagY = centerY + tagRadius * Math.sin(rad);

        ctx.fillStyle = c.name === 'N' 
          ? (isNightVision ? '#ef4444' : '#38bdf8') 
          : (isNightVision ? '#fca5a5' : '#94a3b8');
        ctx.font = c.name === 'N' || c.name === 'S' || c.name === 'L' || c.name === 'O' 
          ? 'bold 11px monospace' 
          : '9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(c.name, tagX, tagY);
      });

      // Zenith Center Marker
      ctx.fillStyle = isNightVision ? 'rgba(239, 68, 68, 0.7)' : 'rgba(34, 211, 238, 0.7)';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = 'bold 8px monospace';
      ctx.fillText('ZÊNITE (90°)', centerX, centerY + 12);

      // 3. Aiming Cone / Gyroscope Device Sight Line (Top of Screen in direction of view)
      const pitchOffset = Math.max(0, (90 - viewPitch) / 90) * domeRadius;
      const sightTargetX = centerX;
      const sightTargetY = centerY - pitchOffset;

      // Beam from zenith towards current aim altitude in front of device
      ctx.save();
      const beamGrad = ctx.createLinearGradient(centerX, centerY, sightTargetX, sightTargetY);
      beamGrad.addColorStop(0, 'rgba(34, 211, 238, 0.04)');
      beamGrad.addColorStop(1, isNightVision ? 'rgba(239, 68, 68, 0.35)' : 'rgba(34, 211, 238, 0.35)');
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, pitchOffset, -Math.PI / 2 - 0.25, -Math.PI / 2 + 0.25);
      ctx.closePath();
      ctx.fill();

      // Sight Line from Center to Aim Reticle
      ctx.strokeStyle = isNightVision ? 'rgba(239, 68, 68, 0.4)' : 'rgba(34, 211, 238, 0.4)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(sightTargetX, sightTargetY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Reticle at Phone's exact pointing location
      ctx.strokeStyle = isNightVision ? '#ef4444' : '#22d3ee';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sightTargetX, sightTargetY, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(sightTargetX, sightTargetY, 3, 0, Math.PI * 2);
      ctx.fillStyle = isNightVision ? '#ef4444' : '#22d3ee';
      ctx.fill();

      // Heading and Pitch HUD indicator inside Planisphere
      ctx.fillStyle = isNightVision ? '#fca5a5' : '#22d3ee';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(viewHeading)}° • ALT ${Math.round(viewPitch)}°`, sightTargetX, sightTargetY - 16);
      ctx.restore();
    } else {
      // -------------------------------------------------------------
      // VISÃO PANORÂMICA (TANGENTIAL VIEW PROJECTION)
      // -------------------------------------------------------------
      const fovDeg = 75 / zoomLevel;

      project = (azDeg: number, altDeg: number) => {
        const azDiff = ((azDeg - viewHeading + 540) % 360) - 180;
        const altDiff = altDeg - viewPitch;

        const x = centerX + (azDiff / (fovDeg / 2)) * (width / 2);
        const y = centerY - (altDiff / (fovDeg / 2)) * (height / 2);

        const inView = x >= -60 && x <= width + 60 && y >= -60 && y <= height + 60;
        return { x, y, inView };
      };

      // Grid in Panoramic view
      if (showGrid) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = isNightVision ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.12)';

        for (let alt = -60; alt <= 80; alt += 20) {
          ctx.beginPath();
          for (let az = viewHeading - fovDeg; az <= viewHeading + fovDeg; az += 5) {
            const pt = project(az, alt);
            if (az === viewHeading - fovDeg) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          }
          ctx.stroke();
        }
      }

      // Horizon line
      ctx.lineWidth = 2;
      ctx.strokeStyle = isNightVision ? 'rgba(239, 68, 68, 0.6)' : 'rgba(34, 211, 238, 0.5)';
      ctx.beginPath();
      for (let az = viewHeading - fovDeg; az <= viewHeading + fovDeg; az += 2) {
        const pt = project(az, 0);
        if (az === viewHeading - fovDeg) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
    }

    // 4. Draw Ecliptic Line
    if (showEcliptic) {
      const now = new Date();
      const eclipticPoints = calculateEclipticLine(observer.latitude, observer.longitude, now);
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = isNightVision ? 'rgba(239, 68, 68, 0.45)' : 'rgba(251, 191, 36, 0.45)';
      ctx.setLineDash([5, 4]);

      ctx.beginPath();
      let started = false;
      eclipticPoints.forEach((p) => {
        if (projectionMode === 'planisphere' && p.altitude < -10) return;
        const pt = project(p.azimuth, p.altitude);
        if (!started) {
          ctx.moveTo(pt.x, pt.y);
          started = true;
        } else {
          ctx.lineTo(pt.x, pt.y);
        }
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 5. Draw Diurnal Motion Paths ("Linhas de Movimentação")
    if (showMotionTrails) {
      const now = new Date();
      const objectsToTrack: CelestialObject[] = [];

      if (selectedObject) objectsToTrack.push(selectedObject);
      objects.forEach((obj) => {
        if (
          (obj.type === 'sun' ||
            obj.type === 'moon' ||
            (obj.type === 'planet' &&
              (obj.id === 'venus' || obj.id === 'jupiter' || obj.id === 'mars' || obj.id === 'saturn'))) &&
          !objectsToTrack.some((o) => o.id === obj.id)
        ) {
          objectsToTrack.push(obj);
        }
      });

      objectsToTrack.forEach((obj) => {
        const isSelected = selectedObject?.id === obj.id;
        const track = calculateDiurnalMotionTrack(obj, observer.latitude, observer.longitude, now);

        ctx.save();
        ctx.lineWidth = isSelected ? 2.0 : 1.2;
        ctx.strokeStyle = isNightVision
          ? isSelected
            ? 'rgba(239, 68, 68, 0.85)'
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
          if (projectionMode === 'planisphere' && p.altitude < -5) return;
          const pt = project(p.azimuth, p.altitude);
          if (!pathStarted) {
            ctx.moveTo(pt.x, pt.y);
            pathStarted = true;
          } else {
            ctx.lineTo(pt.x, pt.y);
          }
        });
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      });
    }

    // 6. Draw Constellations
    if (showConstellationLines) {
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = isNightVision ? 'rgba(239, 68, 68, 0.35)' : 'rgba(99, 102, 241, 0.4)';

      CONSTELLATIONS_CATALOG.forEach((constellation: ConstellationData) => {
        constellation.lines.forEach(([idxA, idxB]) => {
          const starA = constellation.stars[idxA];
          const starB = constellation.stars[idxB];
          if (!starA || !starB) return;

          const objA = objects.find((o) => o.id === starA.id) || starA;
          const objB = objects.find((o) => o.id === starB.id) || starB;

          if (objA.azimuth != null && objA.altitude != null && objB.azimuth != null && objB.altitude != null) {
            if (projectionMode === 'planisphere' && (objA.altitude < -5 || objB.altitude < -5)) return;
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

        if (showConstellationNames) {
          const visibleStars = constellation.stars
            .map((s) => objects.find((o) => o.id === s.id))
            .filter((s): s is CelestialObject => s != null && s.azimuth != null && s.altitude != null);

          if (visibleStars.length > 0) {
            const avgAz = visibleStars.reduce((acc, s) => acc + (s.azimuth || 0), 0) / visibleStars.length;
            const avgAlt = visibleStars.reduce((acc, s) => acc + (s.altitude || 0), 0) / visibleStars.length;
            if (projectionMode === 'planisphere' && avgAlt < -5) return;
            const centerPt = project(avgAz, avgAlt);

            if (centerPt.inView) {
              ctx.fillStyle = isNightVision ? 'rgba(252, 165, 165, 0.7)' : 'rgba(199, 210, 254, 0.75)';
              ctx.font = 'bold 10px sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText(constellation.name.toUpperCase(), centerPt.x, centerPt.y - 10);
            }
          }
        }
      });
    }

    // 7. Plot All Celestial Objects (Planets, Moon, Sun, Stars, Satellites)
    const newProjected: { obj: CelestialObject; x: number; y: number; radius: number }[] = [];
    const sorted = [...objects].sort((a, b) => b.mag - a.mag);

    sorted.forEach((obj) => {
      if (obj.azimuth == null || obj.altitude == null) return;
      if (projectionMode === 'planisphere' && obj.altitude < -6) return;

      // Filter layer checks
      if (obj.type === 'star' && !showStars) return;
      if ((obj.type === 'planet' || obj.type === 'sun' || obj.type === 'moon') && !showPlanets) return;
      if (obj.type === 'satellite' && !showSatellites) return;

      const pt = project(obj.azimuth, obj.altitude);
      if (!pt.inView) return;

      const isSelected = selectedObject?.id === obj.id;
      let radius = Math.max(2.5, Math.min(8.5, 5.5 - obj.mag * 0.8));
      if (obj.type === 'sun' || obj.type === 'moon') radius = 12;
      if (obj.type === 'planet') radius = Math.max(5.0, radius * 1.35);

      newProjected.push({ obj, x: pt.x, y: pt.y, radius: Math.max(radius, 14) });

      ctx.save();

      // Selected Object Glowing Ring
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius + 8, 0, Math.PI * 2);
        ctx.strokeStyle = isNightVision ? '#ef4444' : '#22d3ee';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Planet / Star Optical Glow
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

      // Render Body Shape
      if (obj.type === 'moon') {
        const moonPhase = getMoonPhase();
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
        ctx.fill();

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
      } else {
        ctx.fillStyle = isNightVision ? '#fca5a5' : (obj.color || '#f8fafc');
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Labels for Planets, Moon, Sun and Bright Stars
      if (showStarNames && (obj.mag <= 2.2 || obj.type === 'planet' || obj.type === 'moon' || isSelected)) {
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
  }, [
    objects,
    orientation,
    observer.latitude,
    observer.longitude,
    selectedObject,
    projectionMode,
    zoomLevel,
    panOffset,
    showConstellationLines,
    showConstellationNames,
    showStarNames,
    showMotionTrails,
    showEcliptic,
    showGrid,
    isNightVision,
  ]);

  // Handle Resize & Render loop with ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const updateCanvasSize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(10, Math.floor(rect.width));
      const h = Math.max(10, Math.floor(rect.height));

      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      renderSky();
    };

    updateCanvasSize();

    const resizeObserver = new ResizeObserver(() => {
      updateCanvasSize();
    });
    resizeObserver.observe(container);

    window.addEventListener('resize', updateCanvasSize);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateCanvasSize);
    };
  }, [renderSky]);

  // Re-render when dependencies update
  useEffect(() => {
    renderSky();
  }, [renderSky]);

  // Non-passive wheel and gesture listener on canvas for fluid zoom & Safari gesture prevention
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
      setZoomLevel((prev) => Math.max(0.5, Math.min(3.5, prev * zoomFactor)));
    };

    const handleGestureStart = (e: Event) => e.preventDefault();
    const handleGestureChange = (e: Event) => e.preventDefault();
    const handleGestureEnd = (e: Event) => e.preventDefault();

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('gesturestart', handleGestureStart, { passive: false });
    canvas.addEventListener('gesturechange', handleGestureChange, { passive: false });
    canvas.addEventListener('gestureend', handleGestureEnd, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('gesturestart', handleGestureStart);
      canvas.removeEventListener('gesturechange', handleGestureChange);
      canvas.removeEventListener('gestureend', handleGestureEnd);
    };
  }, []);

  // Pointer Click / Touch Hit-Testing in Logical Pixels
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    let clicked: CelestialObject | null = null;
    let minDist = 28;

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

  // Drag Pan Handlers with Smooth Pan Offset in Planisphere Mode
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };

    if (projectionMode === 'planisphere') {
      // In Carta Celeste mode: Translate pan offset
      setPanOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    } else if (onManualLookaround) {
      // In Panoramic mode: Rotate lookaround
      const sensitivity = Math.min(0.24, 0.16 / Math.sqrt(zoomLevel));
      onManualLookaround(-dx * sensitivity, dy * sensitivity);
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // Touch Handlers with Pinch Zoom & Drag
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
    if (e.touches.length === 1 && isDraggingRef.current) {
      const dx = e.touches[0].clientX - lastMousePosRef.current.x;
      const dy = e.touches[0].clientY - lastMousePosRef.current.y;
      lastMousePosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };

      if (projectionMode === 'planisphere') {
        setPanOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      } else if (onManualLookaround) {
        const sensitivity = Math.min(0.24, 0.18 / Math.sqrt(zoomLevel));
        onManualLookaround(-dx * sensitivity, dy * sensitivity);
      }
    } else if (e.touches.length === 2 && touchDistanceRef.current != null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      if (touchDistanceRef.current > 0) {
        const factor = dist / touchDistanceRef.current;
        const smoothFactor = 1 + (factor - 1) * 0.75;
        setZoomLevel((prev) => Math.max(0.5, Math.min(3.5, prev * smoothFactor)));
      }
      touchDistanceRef.current = dist;
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    touchDistanceRef.current = null;
  };

  // Recenter Action
  const handleRecenter = () => {
    playClickSound();
    setPanOffset({ x: 0, y: 0 });
    setZoomLevel(1.0);
    onResetToSensors();
  };

  return (
    <div
      id="celestial-map-container"
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden bg-[#08080a] select-none touch-none ${
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
        className="w-full h-full cursor-grab active:cursor-grabbing block touch-none"
      />

      {/* Floating Status & Projection Mode Bar (Top-Left) */}
      <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10 flex-wrap max-w-[70%]">
        {/* Toggle Projection Mode: Carta Celeste vs Panorâmica */}
        <button
          id="btn-toggle-projection-mode"
          onClick={() => {
            playClickSound();
            setProjectionMode((m) => (m === 'planisphere' ? 'panoramic' : 'planisphere'));
          }}
          title="Alternar entre Carta Celeste (Planisfério 360°) e Visão Panorâmica"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-950/85 backdrop-blur-md border border-cyan-500/60 text-cyan-300 text-[10px] font-mono tracking-wider shadow-lg hover:bg-cyan-900 transition cursor-pointer active:scale-95"
        >
          <MapIcon className="w-3.5 h-3.5" />
          <span className="font-bold uppercase">
            {projectionMode === 'planisphere' ? 'CARTA CELESTE' : 'PANORÂMICA'}
          </span>
        </button>

        {/* Sync with Sensor or Manual Pan Pill */}
        {isManualControl || panOffset.x !== 0 || panOffset.y !== 0 ? (
          <button
            id="btn-re-sync-gyro"
            onClick={handleRecenter}
            title="Recentralizar Mapa e Sincronizar com o Giroscópio"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-950/90 backdrop-blur-md border border-amber-500/60 text-amber-300 text-[10px] font-mono tracking-wider shadow-lg hover:bg-amber-900 transition cursor-pointer active:scale-95 animate-pulse"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>CENTRALIZAR</span>
          </button>
        ) : (
          <div className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-black/75 backdrop-blur-md border border-zinc-800 text-zinc-300 text-[10px] font-mono tracking-wider shadow-lg">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>GIRO ATIVO</span>
          </div>
        )}

        <button
          id="btn-recenter-horizon"
          onClick={handleRecenter}
          title="Centralizar Mapa Celeste no Meio da Tela"
          className="flex items-center gap-1 p-1.5 px-2 rounded-xl bg-black/75 backdrop-blur-md border border-cyan-500/50 text-cyan-300 hover:bg-cyan-950 hover:border-cyan-400 shadow-md transition cursor-pointer active:scale-95"
        >
          <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[10px] font-mono font-bold hidden xs:inline">CENTRALIZAR</span>
        </button>
      </div>

      {/* Zoom Controls (Bottom-Right - Elevated safely above iPhone bottom bar) */}
      <div className="absolute bottom-4 right-2.5 flex flex-col gap-1.5 z-10">
        <button
          id="btn-zoom-in"
          onClick={() => {
            playClickSound();
            setZoomLevel((z) => Math.min(3.5, z + 0.3));
          }}
          title="Aproximar Zoom (+)"
          className="p-2 rounded-xl bg-zinc-900/90 backdrop-blur-md border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 shadow-lg active:scale-95 transition cursor-pointer"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          id="btn-zoom-reset"
          onClick={() => {
            playClickSound();
            setZoomLevel(1.0);
            setPanOffset({ x: 0, y: 0 });
          }}
          title="Zoom Padrão (1.0x)"
          className="px-1.5 py-1 rounded-xl bg-zinc-900/90 backdrop-blur-md border border-zinc-800 text-[9px] font-mono text-zinc-400 hover:text-cyan-300 shadow-lg active:scale-95 transition cursor-pointer text-center"
        >
          {zoomLevel.toFixed(1)}x
        </button>
        <button
          id="btn-zoom-out"
          onClick={() => {
            playClickSound();
            setZoomLevel((z) => Math.max(0.5, z - 0.3));
          }}
          title="Afastar Zoom (-)"
          className="p-2 rounded-xl bg-zinc-900/90 backdrop-blur-md border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 shadow-lg active:scale-95 transition cursor-pointer"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
      </div>

      {/* Layer Quick Toggles at Top-Right */}
      <div className="absolute top-2 right-2 flex items-center gap-1 z-10 flex-wrap justify-end">
        <button
          id="btn-toggle-motion-trails"
          onClick={() => {
            playClickSound();
            if (onUpdateSkyFilters) {
              onUpdateSkyFilters({ showMotionTrails: !showMotionTrails });
            } else {
              setLocalMotionTrails((v) => !v);
            }
          }}
          title="Alternar Linhas de Movimentação e Órbitas"
          className={`flex items-center gap-1 px-2 py-1 rounded-xl backdrop-blur-md border text-[10px] font-mono tracking-wider transition cursor-pointer ${
            showMotionTrails
              ? 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300 shadow-sm'
              : 'bg-zinc-900/80 border-zinc-800 text-zinc-400'
          }`}
        >
          <Route className="w-3 h-3 text-cyan-400" />
          <span className="hidden sm:inline">TRAJETÓRIAS</span>
        </button>

        <button
          id="btn-toggle-ecliptic"
          onClick={() => {
            playClickSound();
            if (onUpdateSkyFilters) {
              onUpdateSkyFilters({ showEcliptic: !showEcliptic });
            } else {
              setLocalEcliptic((v) => !v);
            }
          }}
          title="Alternar Linha da Eclíptica"
          className={`flex items-center gap-1 px-2 py-1 rounded-xl backdrop-blur-md border text-[10px] font-mono tracking-wider transition cursor-pointer ${
            showEcliptic
              ? 'bg-amber-950/80 border-amber-500/50 text-amber-300 shadow-sm'
              : 'bg-zinc-900/80 border-zinc-800 text-zinc-400'
          }`}
        >
          <Orbit className="w-3 h-3 text-amber-400" />
          <span className="hidden sm:inline">ECLÍPTICA</span>
        </button>

        <button
          id="btn-toggle-constellations"
          onClick={() => {
            playClickSound();
            if (onUpdateSkyFilters) {
              onUpdateSkyFilters({ showConstellationLines: !showConstellationLines });
            } else {
              setLocalConstellationLines((v) => !v);
            }
          }}
          title="Alternar Linhas de Constelações"
          className={`px-2 py-1 rounded-xl backdrop-blur-md border text-[10px] font-mono tracking-wider transition cursor-pointer ${
            showConstellationLines
              ? 'bg-indigo-950/80 border-indigo-500/50 text-indigo-300'
              : 'bg-zinc-900/80 border-zinc-800 text-zinc-400'
          }`}
        >
          CONST
        </button>
      </div>

      {/* Selected Object Info Card - Positioned in the Top-Center so it NEVER overlaps with bottom D-Pad or Zoom */}
      {selectedObject && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 pointer-events-auto max-w-[90%] sm:max-w-md animate-fade-in">
          <div className="flex items-center gap-2.5 p-2 px-3 rounded-2xl bg-zinc-950/95 backdrop-blur-md border border-cyan-500/70 text-left shadow-[0_4px_25px_rgba(0,0,0,0.8)]">
            <div
              className="w-3 h-3 rounded-full shrink-0 animate-pulse"
              style={{ backgroundColor: selectedObject.color || '#38bdf8' }}
            />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-cyan-300 truncate flex items-center gap-1.5">
                <span>{selectedObject.name}</span>
                <span className="text-[8px] font-mono px-1 py-0.2 bg-cyan-950 border border-cyan-800 text-cyan-400 rounded uppercase">
                  {selectedObject.type}
                </span>
              </div>
              <div className="text-[10px] text-zinc-400 font-mono truncate">
                Az {Math.round(selectedObject.azimuth || 0)}° • Alt {Math.round(selectedObject.altitude || 0)}° • Mag {selectedObject.mag}
              </div>
            </div>
            <button
              onClick={() => onSelectObject(selectedObject)}
              className="p-1 rounded-lg bg-cyan-950 border border-cyan-800 text-cyan-300 hover:bg-cyan-900 transition cursor-pointer"
              title="Mais Informações"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
