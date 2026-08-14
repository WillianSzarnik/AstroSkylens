import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  Globe,
  Map as MapIcon,
  Satellite,
  Clock,
  Navigation,
  Compass,
  Radio,
  Eye,
  Info,
  Calendar,
  Layers,
  Sparkles,
  ChevronRight,
  Maximize2,
  RefreshCw,
  MapPin,
  Flame,
} from 'lucide-react';
import { ObserverCoords } from '../types/astronomy';
import {
  SATELLITES_LIST,
  SatelliteDef,
  getAllSatellitesOrbitData,
  predictSatellitePasses,
  haversineDistanceKm,
  getSatellitePosition,
} from '../utils/satelliteTracker';
import { calculateSubsolarPoint } from '../utils/astronomyEngine';
import { playClickSound, playLockOnSound } from '../utils/audioEffects';
import { WORLD_REAL_LANDMASSES } from '../data/worldMapGeoData';

interface EarthOrbitViewProps {
  observer: ObserverCoords;
  isNightVision: boolean;
  onSelectCity?: (city: ObserverCoords) => void;
}

// Major cities catalog with coordinates
const KEY_CITIES = [
  { name: 'Curitiba', state: 'PR', lat: -25.43, lon: -49.27, isTarget: true },
  { name: 'São Paulo', state: 'SP', lat: -23.55, lon: -46.63 },
  { name: 'Rio de Janeiro', state: 'RJ', lat: -22.90, lon: -43.17 },
  { name: 'Brasília', state: 'DF', lat: -15.79, lon: -47.88 },
  { name: 'Porto Alegre', state: 'RS', lat: -30.03, lon: -51.23 },
  { name: 'Belo Horizonte', state: 'MG', lat: -19.92, lon: -43.94 },
  { name: 'Salvador', state: 'BA', lat: -12.97, lon: -38.51 },
  { name: 'Fortaleza', state: 'CE', lat: -3.73, lon: -38.52 },
  { name: 'Manaus', state: 'AM', lat: -3.11, lon: -60.02 },
  { name: 'Recife', state: 'PE', lat: -8.05, lon: -34.88 },
  { name: 'Lisboa', country: 'PT', lat: 38.72, lon: -9.14 },
  { name: 'Nova York', country: 'EUA', lat: 40.71, lon: -74.00 },
  { name: 'Tóquio', country: 'JP', lat: 35.68, lon: 139.69 },
  { name: 'Londres', country: 'UK', lat: 51.51, lon: -0.13 },
  { name: 'Sydney', country: 'AU', lat: -33.86, lon: 151.20 },
];

export const EarthOrbitView: React.FC<EarthOrbitViewProps> = ({
  observer,
  isNightVision,
  onSelectCity,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [selectedSatId, setSelectedSatId] = useState<string>('iss');
  const [mapProjection, setMapProjection] = useState<'2d' | '3d'>('2d');
  const [showFootprints, setShowFootprints] = useState<boolean>(true);
  const [showCities, setShowCities] = useState<boolean>(true);
  const [showTerminator, setShowTerminator] = useState<boolean>(true);
  const [now, setNow] = useState<Date>(new Date());

  // 3D Globe rotation angles
  const [globeRotLat, setGlobeRotLat] = useState<number>(observer.latitude);
  const [globeRotLon, setGlobeRotLon] = useState<number>(observer.longitude);
  const isDragging3DRef = useRef<boolean>(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Update live clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const selectedSatDef = useMemo(() => {
    return SATELLITES_LIST.find((s) => s.id === selectedSatId) || SATELLITES_LIST[0];
  }, [selectedSatId]);

  const allSatellitesData = useMemo(() => {
    return getAllSatellitesOrbitData(now);
  }, [now]);

  const activeSatData = useMemo(() => {
    return allSatellitesData.find((s) => s.id === selectedSatId) || allSatellitesData[0];
  }, [allSatellitesData, selectedSatId]);

  // Compute upcoming passes over the observer's location + Curitiba
  const observerPasses = useMemo(() => {
    return predictSatellitePasses(observer, selectedSatDef, now);
  }, [observer, selectedSatDef, now]);

  const curitibaPasses = useMemo(() => {
    const curitibaCoords: ObserverCoords = {
      latitude: -25.43,
      longitude: -49.27,
      cityName: 'Curitiba (PR)',
    };
    return predictSatellitePasses(curitibaCoords, selectedSatDef, now);
  }, [selectedSatDef, now]);

  // Distance from selected satellite to observer
  const distToObserverKm = useMemo(() => {
    return Math.round(
      haversineDistanceKm(
        observer.latitude,
        observer.longitude,
        activeSatData.currentLat,
        activeSatData.currentLon
      )
    );
  }, [observer.latitude, observer.longitude, activeSatData.currentLat, activeSatData.currentLon]);

  // Distance from satellite to Curitiba
  const distToCuritibaKm = useMemo(() => {
    return Math.round(
      haversineDistanceKm(-25.43, -49.27, activeSatData.currentLat, activeSatData.currentLon)
    );
  }, [activeSatData.currentLat, activeSatData.currentLon]);

  // Render 2D Equirectangular or 3D Globe Canvas
  const renderMap = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    if (width === 0 || height === 0) return;

    // Adjust canvas resolution
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const deg2rad = Math.PI / 180;
    const rad2deg = 180 / Math.PI;

    if (mapProjection === '2d') {
      // ==========================================
      // 2D EQUIRECTANGULAR CYLINDRICAL MAP PROJECTION
      // ==========================================
      const mapPaddingX = 24;
      const mapPaddingY = 32;
      const mapW = width - mapPaddingX * 2;
      const mapH = height - mapPaddingY * 2;
      const mapX0 = mapPaddingX;
      const mapY0 = mapPaddingY;

      // Project (lat, lon) -> (x, y)
      const project2D = (lat: number, lon: number): { x: number; y: number } => {
        const normLon = ((lon + 180) % 360) / 360; // 0..1
        const normLat = (90 - lat) / 180; // 0..1
        return {
          x: mapX0 + normLon * mapW,
          y: mapY0 + normLat * mapH,
        };
      };

      // 1. Ocean Background
      ctx.fillStyle = isNightVision ? '#110303' : '#050c18';
      ctx.fillRect(mapX0, mapY0, mapW, mapH);

      // 2. Graticule Lines (Parallels and Meridians)
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = isNightVision ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.12)';

      // Latitudes (-60 to +60)
      for (let lat = -60; lat <= 60; lat += 30) {
        const pt = project2D(lat, -180);
        ctx.beginPath();
        ctx.moveTo(mapX0, pt.y);
        ctx.lineTo(mapX0 + mapW, pt.y);
        ctx.stroke();

        ctx.fillStyle = isNightVision ? '#7f1d1d' : '#1e3a8a';
        ctx.font = '8px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${lat}°`, mapX0 - 4, pt.y + 3);
      }

      // Longitudes (-180 to +180)
      for (let lon = -180; lon <= 180; lon += 30) {
        const pt = project2D(0, lon);
        ctx.beginPath();
        ctx.moveTo(pt.x, mapY0);
        ctx.lineTo(pt.x, mapY0 + mapH);
        ctx.stroke();

        ctx.fillStyle = isNightVision ? '#7f1d1d' : '#1e3a8a';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${lon}°`, pt.x, mapY0 + mapH + 12);
      }

      // Equator Highlight (Lat = 0)
      const eqPt = project2D(0, 0);
      ctx.lineWidth = 1;
      ctx.strokeStyle = isNightVision ? 'rgba(239, 68, 68, 0.4)' : 'rgba(34, 211, 238, 0.35)';
      ctx.beginPath();
      ctx.moveTo(mapX0, eqPt.y);
      ctx.lineTo(mapX0 + mapW, eqPt.y);
      ctx.stroke();

      // 3. Solar Day/Night Terminator Shading
      if (showTerminator) {
        const subsolar = calculateSubsolarPoint(now);
        ctx.save();
        ctx.beginPath();
        ctx.rect(mapX0, mapY0, mapW, mapH);
        ctx.clip();

        // Sample terminator sinusoidal line
        ctx.fillStyle = isNightVision ? 'rgba(0, 0, 0, 0.65)' : 'rgba(0, 0, 0, 0.55)';
        ctx.beginPath();
        ctx.moveTo(mapX0, mapY0 + mapH);

        for (let lon = -180; lon <= 180; lon += 3) {
          // Night shadow boundary: cosine curve based on solar declination
          const deltaLon = (lon - subsolar.longitude) * deg2rad;
          const termLat = Math.atan(-Math.cos(deltaLon) / Math.tan(subsolar.latitude * deg2rad)) * rad2deg;
          const pt = project2D(termLat, lon);
          ctx.lineTo(pt.x, pt.y);
        }

        ctx.lineTo(mapX0 + mapW, mapY0 + mapH);
        ctx.closePath();
        ctx.fill();

        // Subsolar point (Sun directly overhead)
        const sunPt = project2D(subsolar.latitude, subsolar.longitude);
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(sunPt.x, sunPt.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(sunPt.x, sunPt.y, 8, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
      }

      // 4. Continents Landmass Polygons (Real Coastline Geometry)
      ctx.fillStyle = isNightVision ? 'rgba(185, 28, 28, 0.45)' : 'rgba(16, 185, 129, 0.35)';
      ctx.strokeStyle = isNightVision ? 'rgba(239, 68, 68, 0.85)' : 'rgba(52, 211, 153, 0.85)';
      ctx.lineWidth = 1.3;

      WORLD_REAL_LANDMASSES.forEach((landmass) => {
        ctx.beginPath();
        landmass.points.forEach(([lat, lon], idx) => {
          const pt = project2D(lat, lon);
          if (idx === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      });

      // 5. Ground Track Orbits for All Satellites
      allSatellitesData.forEach((sat) => {
        const isSelected = sat.id === selectedSatId;
        ctx.save();
        ctx.lineWidth = isSelected ? 2.2 : 1.0;
        ctx.strokeStyle = isSelected ? sat.color : 'rgba(148, 163, 184, 0.35)';

        if (!isSelected) {
          ctx.setLineDash([3, 4]);
        }

        // Draw trajectory with wraparound handling
        ctx.beginPath();
        let prevLon: number | null = null;
        sat.trajectory.forEach(([lat, lon], idx) => {
          const pt = project2D(lat, lon);
          if (idx === 0 || prevLon === null || Math.abs(lon - prevLon) > 100) {
            ctx.moveTo(pt.x, pt.y);
          } else {
            ctx.lineTo(pt.x, pt.y);
          }
          prevLon = lon;
        });
        ctx.stroke();
        ctx.restore();

        // Satellite Footprint (Visual Coverage Area)
        if (showFootprints && isSelected) {
          const centerPt = project2D(sat.currentLat, sat.currentLon);
          const radiusPixels = (sat.footprintRadiusKm / 40075) * mapW;

          ctx.save();
          ctx.fillStyle = `${sat.color}15`;
          ctx.strokeStyle = `${sat.color}80`;
          ctx.lineWidth = 1.2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(centerPt.x, centerPt.y, radiusPixels, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }

        // Satellite Current Location Marker
        const satPt = project2D(sat.currentLat, sat.currentLon);

        ctx.fillStyle = sat.color;
        ctx.beginPath();
        ctx.arc(satPt.x, satPt.y, isSelected ? 5.5 : 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(satPt.x, satPt.y, isSelected ? 9.5 : 5.5, 0, Math.PI * 2);
        ctx.stroke();

        // Label
        if (isSelected) {
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`🛰️ ${sat.shortName || sat.name}`, satPt.x, satPt.y - 14);

          ctx.fillStyle = sat.color;
          ctx.font = '8px monospace';
          ctx.fillText(`${sat.altitudeKm}km • ${sat.speedKmH}km/h`, satPt.x, satPt.y + 18);
        }
      });

      // 6. Cities and Key Locations
      if (showCities) {
        KEY_CITIES.forEach((city) => {
          const pt = project2D(city.lat, city.lon);
          const isCuritiba = city.name === 'Curitiba';

          ctx.fillStyle = isCuritiba ? '#38bdf8' : '#e2e8f0';
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, isCuritiba ? 3.5 : 2.2, 0, Math.PI * 2);
          ctx.fill();

          if (isCuritiba) {
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 6.5, 0, Math.PI * 2);
            ctx.stroke();
          }

          ctx.fillStyle = isCuritiba ? '#38bdf8' : 'rgba(203, 213, 225, 0.75)';
          ctx.font = isCuritiba ? 'bold 9px monospace' : '7.5px monospace';
          ctx.textAlign = 'left';
          ctx.fillText(city.name, pt.x + 5, pt.y + 2.5);
        });

        // Observer Location Marker
        const obsPt = project2D(observer.latitude, observer.longitude);
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(obsPt.x, obsPt.y, 4.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(obsPt.x, obsPt.y, 8, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#fca5a5';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`📍 VOCÊ (${observer.cityName || 'Local'})`, obsPt.x, obsPt.y - 10);
      }

      // Map Border
      ctx.strokeStyle = isNightVision ? 'rgba(239, 68, 68, 0.6)' : 'rgba(34, 211, 238, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(mapX0, mapY0, mapW, mapH);
    } else {
      // ==========================================
      // 3D ORTHOGRAPHIC GLOBE PROJECTION
      // ==========================================
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) * 0.42;

      const centerLatRad = globeRotLat * deg2rad;
      const centerLonRad = globeRotLon * deg2rad;

      const project3D = (
        latDeg: number,
        lonDeg: number
      ): { x: number; y: number; visible: boolean } => {
        const lat = latDeg * deg2rad;
        const lon = lonDeg * deg2rad;

        const cosLat = Math.cos(lat);
        const sinLat = Math.sin(lat);
        const cosLonDiff = Math.cos(lon - centerLonRad);
        const sinLonDiff = Math.sin(lon - centerLonRad);

        const cosCenterLat = Math.cos(centerLatRad);
        const sinCenterLat = Math.sin(centerLatRad);

        const x3d = cosLat * sinLonDiff;
        const y3d = cosCenterLat * sinLat - sinCenterLat * cosLat * cosLonDiff;
        const z3d = sinCenterLat * sinLat + cosCenterLat * cosLat * cosLonDiff;

        return {
          x: centerX + x3d * radius,
          y: centerY - y3d * radius,
          visible: z3d > 0.02,
        };
      };

      // Ocean Globe
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
        oceanGrad.addColorStop(0.7, '#140303');
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
      ctx.clip();

      // Graticule
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = isNightVision ? 'rgba(239, 68, 68, 0.18)' : 'rgba(56, 189, 248, 0.16)';
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

      // Continents (High Fidelity Real Geometries)
      ctx.fillStyle = isNightVision ? 'rgba(185, 28, 28, 0.45)' : 'rgba(16, 185, 129, 0.4)';
      ctx.strokeStyle = isNightVision ? 'rgba(239, 68, 68, 0.8)' : 'rgba(52, 211, 153, 0.8)';
      ctx.lineWidth = 1.0;

      WORLD_REAL_LANDMASSES.forEach((landmass) => {
        ctx.beginPath();
        let fillStarted = false;
        landmass.points.forEach(([lat, lon]) => {
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
          ctx.stroke();
        }
      });

      // Active Satellite Orbit Ground Track on 3D Globe
      allSatellitesData.forEach((sat) => {
        const isSelected = sat.id === selectedSatId;
        ctx.save();
        ctx.lineWidth = isSelected ? 2.0 : 1.0;
        ctx.strokeStyle = isSelected ? sat.color : 'rgba(148, 163, 184, 0.35)';

        ctx.beginPath();
        let trackStarted = false;
        sat.trajectory.forEach(([lat, lon]) => {
          const pt = project3D(lat, lon);
          if (pt.visible) {
            if (!trackStarted) {
              ctx.moveTo(pt.x, pt.y);
              trackStarted = true;
            } else {
              ctx.lineTo(pt.x, pt.y);
            }
          } else {
            trackStarted = false;
          }
        });
        ctx.stroke();
        ctx.restore();

        // Satellite Marker
        const satPt = project3D(sat.currentLat, sat.currentLon);
        if (satPt.visible) {
          ctx.fillStyle = sat.color;
          ctx.beginPath();
          ctx.arc(satPt.x, satPt.y, isSelected ? 5.5 : 3.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(satPt.x, satPt.y, isSelected ? 9.5 : 5.5, 0, Math.PI * 2);
          ctx.stroke();

          if (isSelected) {
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`🛰️ ${sat.shortName || sat.name}`, satPt.x, satPt.y - 12);
          }
        }
      });

      // Cities on 3D Globe
      KEY_CITIES.forEach((city) => {
        const pt = project3D(city.lat, city.lon);
        if (pt.visible) {
          const isCuritiba = city.name === 'Curitiba';
          ctx.fillStyle = isCuritiba ? '#38bdf8' : '#ffffff';
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, isCuritiba ? 3.5 : 2, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = isCuritiba ? '#38bdf8' : '#cbd5e1';
          ctx.font = isCuritiba ? 'bold 9px monospace' : '7.5px monospace';
          ctx.textAlign = 'left';
          ctx.fillText(city.name, pt.x + 4, pt.y + 2);
        }
      });

      // Observer
      const obsPt = project3D(observer.latitude, observer.longitude);
      if (obsPt.visible) {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(obsPt.x, obsPt.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.restore();

      // Atmospheric Ring
      ctx.strokeStyle = isNightVision ? 'rgba(239, 68, 68, 0.6)' : 'rgba(56, 189, 248, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, [
    mapProjection,
    isNightVision,
    now,
    showTerminator,
    allSatellitesData,
    selectedSatId,
    showFootprints,
    showCities,
    observer.latitude,
    observer.longitude,
    observer.cityName,
    globeRotLat,
    globeRotLon,
  ]);

  // Canvas resize and render
  useEffect(() => {
    renderMap();
  }, [renderMap]);

  // Handle 3D Globe Drag Rotation
  const handleMouseDown = (e: React.MouseEvent) => {
    if (mapProjection !== '3d') return;
    isDragging3DRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging3DRef.current || mapProjection !== '3d') return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };

    setGlobeRotLon((prev) => ((prev - dx * 0.7 + 180) % 360 + 360) % 360 - 180);
    setGlobeRotLat((prev) => Math.max(-80, Math.min(80, prev + dy * 0.7)));
  };

  const handleMouseUp = () => {
    isDragging3DRef.current = false;
  };

  return (
    <div
      id="earth-orbit-view-root"
      className={`w-full h-full flex flex-col overflow-hidden select-none ${
        isNightVision ? 'bg-[#060101] text-red-100 night-vision-filter' : 'bg-[#050508] text-zinc-100'
      }`}
    >
      {/* Top Banner: Real-time Satellite Flyover Alert */}
      <div className="px-3.5 py-2 bg-[#08080c] border-b border-zinc-800 flex items-center justify-between flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-950 border border-cyan-500/50 text-cyan-400">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
          </div>
          <div>
            <div className="font-bold flex items-center gap-1.5">
              <span className="text-zinc-100 uppercase">{selectedSatDef.name}</span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-700">
                AO VIVO
              </span>
            </div>
            <div className="text-[10px] text-zinc-400 font-mono">
              Lat: {activeSatData.currentLat.toFixed(2)}° • Lon: {activeSatData.currentLon.toFixed(2)}° • Alt: {activeSatData.altitudeKm} km
            </div>
          </div>
        </div>

        {/* Proximity / Curitiba Pass Alert Pill */}
        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 rounded-xl bg-indigo-950/70 border border-indigo-500/40 text-indigo-200 font-mono text-[10px] flex items-center gap-1.5 shadow-sm">
            <MapPin className="w-3 h-3 text-cyan-400 shrink-0" />
            <span>
              Distância de Curitiba:{' '}
              <strong className="text-cyan-300">{distToCuritibaKm} km</strong>
            </span>
          </div>

          <div className="flex items-center bg-black/60 border border-zinc-800 rounded-lg p-0.5">
            <button
              id="btn-proj-2d"
              onClick={() => {
                playClickSound();
                setMapProjection('2d');
              }}
              className={`px-2 py-0.8 rounded text-[10px] font-mono transition cursor-pointer ${
                mapProjection === '2d' ? 'bg-cyan-600 text-white font-bold' : 'text-zinc-400'
              }`}
            >
              2D MAPA
            </button>
            <button
              id="btn-proj-3d"
              onClick={() => {
                playClickSound();
                setMapProjection('3d');
              }}
              className={`px-2 py-0.8 rounded text-[10px] font-mono transition cursor-pointer ${
                mapProjection === '3d' ? 'bg-cyan-600 text-white font-bold' : 'text-zinc-400'
              }`}
            >
              3D GLOBO
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area: Map + Orbital Prediction Sidebar */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Left/Center: Interactive Map Canvas */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="flex-1 h-full min-h-[300px] relative overflow-hidden bg-[#030305] cursor-crosshair"
        >
          <canvas ref={canvasRef} className="block w-full h-full" />

          {/* Quick Satellite Switcher Bar */}
          <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1 flex-wrap max-w-[85%]">
            {SATELLITES_LIST.map((sat) => {
              const isSelected = sat.id === selectedSatId;
              return (
                <button
                  key={sat.id}
                  onClick={() => {
                    playLockOnSound();
                    setSelectedSatId(sat.id);
                  }}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-mono tracking-wider transition-all flex items-center gap-1.5 cursor-pointer backdrop-blur-md border shadow-md active:scale-95 ${
                    isSelected
                      ? 'bg-cyan-950/95 border-cyan-400 text-white font-bold shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                      : 'bg-black/80 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: sat.color }}
                  />
                  <span>{sat.shortName || sat.name}</span>
                </button>
              );
            })}
          </div>

          {/* Canvas Map Controls (Footprints, Cities, Terminator) */}
          <div className="absolute bottom-2.5 left-2.5 z-20 flex items-center gap-1.5 bg-black/85 backdrop-blur-md p-1 rounded-xl border border-zinc-800 text-[10px] font-mono">
            <button
              onClick={() => {
                playClickSound();
                setShowFootprints((v) => !v);
              }}
              className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                showFootprints ? 'bg-zinc-800 text-cyan-300 font-bold' : 'text-zinc-500'
              }`}
            >
              RAIO VISUAL
            </button>
            <button
              onClick={() => {
                playClickSound();
                setShowCities((v) => !v);
              }}
              className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                showCities ? 'bg-zinc-800 text-cyan-300 font-bold' : 'text-zinc-500'
              }`}
            >
              CIDADES
            </button>
            <button
              onClick={() => {
                playClickSound();
                setShowTerminator((v) => !v);
              }}
              className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                showTerminator ? 'bg-zinc-800 text-amber-300 font-bold' : 'text-zinc-500'
              }`}
            >
              DIA / NOITE
            </button>
          </div>
        </div>

        {/* Right: Satellite Pass Predictions & Telemetry Panel */}
        <div className="w-full lg:w-80 h-64 lg:h-full border-t lg:border-t-0 lg:border-l border-zinc-800 bg-[#08080a] flex flex-col overflow-y-auto p-3.5 space-y-3.5 text-xs">
          {/* Active Satellite Card */}
          <div className="p-3 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-cyan-400 font-bold">
                TELEMETRIA ORBITAL
              </span>
              <span className="text-[9px] font-mono text-zinc-500">NORAD #{activeSatData.noradId}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
              <div className="p-2 rounded-xl bg-black/50 border border-zinc-800/80">
                <div className="text-zinc-500">VELOCIDADE</div>
                <div className="text-zinc-100 font-bold text-xs">{activeSatData.speedKmH.toLocaleString()} km/h</div>
              </div>
              <div className="p-2 rounded-xl bg-black/50 border border-zinc-800/80">
                <div className="text-zinc-500">ALTITUDE</div>
                <div className="text-cyan-400 font-bold text-xs">{activeSatData.altitudeKm} km</div>
              </div>
              <div className="p-2 rounded-xl bg-black/50 border border-zinc-800/80">
                <div className="text-zinc-500">PERÍODO</div>
                <div className="text-zinc-100 font-bold text-xs">{activeSatData.periodMinutes.toFixed(1)} min</div>
              </div>
              <div className="p-2 rounded-xl bg-black/50 border border-zinc-800/80">
                <div className="text-zinc-500">INCLINAÇÃO</div>
                <div className="text-zinc-100 font-bold text-xs">{activeSatData.inclinationDeg}°</div>
              </div>
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed pt-1">
              {activeSatData.description}
            </p>
          </div>

          {/* Pass Prediction for Curitiba & Brazil */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-zinc-400 font-bold">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                <span>PRÓXIMAS PASSAGENS (CURITIBA)</span>
              </div>
              <span className="text-[9px] font-mono text-cyan-400 font-bold">VISÍVEL A OLHO NU</span>
            </div>

            {curitibaPasses.length > 0 ? (
              <div className="space-y-1.5">
                {curitibaPasses.map((pass, idx) => {
                  const startTimeFormatted = pass.startTime.toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-xl border flex flex-col gap-1 transition ${
                        pass.isFlyoverImminent
                          ? 'bg-amber-950/60 border-amber-500/80 text-amber-200'
                          : 'bg-zinc-900/50 border-zinc-800/80 text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <div className="flex items-center gap-1.5">
                          <span className="text-cyan-400 font-mono">{startTimeFormatted}</span>
                          <span>(em {pass.minutesUntilPass} min)</span>
                        </div>
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-black/60 text-emerald-400 border border-emerald-800">
                          MAG {pass.magnitude}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                        <span>Elevação Máx: <strong className="text-zinc-200">{pass.maxAltitude}°</strong></span>
                        <span>Duração: <strong className="text-zinc-200">{pass.durationMinutes} min</strong></span>
                        <span>{pass.direction}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-zinc-900/40 border border-zinc-800 text-[11px] text-zinc-400 text-center">
                Calculando órbitas e janelas de visibilidade para as próximas 24 horas...
              </div>
            )}
          </div>

          {/* Pass Prediction for User's Active Location */}
          {observer.cityName && observer.cityName !== 'Curitiba' && (
            <div className="space-y-2 pt-1 border-t border-zinc-800/80">
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-zinc-400 font-bold">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                <span>PASSAGENS EM {observer.cityName.toUpperCase()}</span>
              </div>

              {observerPasses.slice(0, 2).map((pass, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded-xl bg-zinc-900/50 border border-zinc-800/80 flex items-center justify-between text-[10px] font-mono"
                >
                  <div>
                    <div className="font-bold text-zinc-200">
                      {pass.startTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} (em {pass.minutesUntilPass}m)
                    </div>
                    <div className="text-zinc-500">Trajetória: {pass.direction}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-cyan-400 font-bold">Alt: {pass.maxAltitude}°</div>
                    <div className="text-zinc-500">{pass.durationMinutes} min</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
