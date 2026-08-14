import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  CelestialObject,
  SkyLensResult,
  ViewMode,
} from './types/astronomy';
import {
  getAllVisibleObjects,
  findTargetInReticle,
  getMoonPhase,
} from './utils/astronomyEngine';
import { useDeviceSensors } from './hooks/useDeviceSensors';
import { CameraView } from './components/CameraView';
import { CelestialMap } from './components/CelestialMap';
import { HeaderNav } from './components/HeaderNav';
import { SkyLensModal } from './components/SkyLensModal';
import { NasaGalleryModal } from './components/NasaGalleryModal';
import { SettingsModal } from './components/SettingsModal';
import { SensorGuideModal } from './components/SensorGuideModal';
import { VirtualJoystick } from './components/VirtualJoystick';
import { CompassRose } from './components/CompassRose';
import { EarthGlobeWidget } from './components/EarthGlobeWidget';
import { SplitResizer } from './components/SplitResizer';
import { useFullscreen } from './hooks/useFullscreen';
import { playLockOnSound, playClickSound } from './utils/audioEffects';
import { Gamepad2, Sparkles, Navigation2, Compass, Globe } from 'lucide-react';

export default function App() {
  // 1. Device sensors & Hardware state
  const {
    orientation,
    location,
    locationStatus,
    cameraStream,
    cameraFacing,
    cameraError,
    needsIosPermission,
    isManualControl,
    startCamera,
    stopCamera,
    toggleCameraFacing,
    attachVideoElement,
    takeSnapshot,
    requestLocation,
    setCity,
    requestOrientationPermission,
    updateManualOrientation,
    resetToSensors,
  } = useDeviceSensors();

  // 2. UI Layout & View modes
  const [viewMode, setViewMode] = useState<ViewMode>('split'); // 'split' (default), 'camera_full', 'sky_full'
  const [splitRatio, setSplitRatio] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('astrovision_split_ratio');
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val >= 0.2 && val <= 0.8) return val;
      }
    } catch {
      // ignore
    }
    return 0.5;
  });
  const [isNightVision, setIsNightVision] = useState<boolean>(false);
  const [showArHud, setShowArHud] = useState<boolean>(true);
  const [showVirtualJoystick, setShowVirtualJoystick] = useState<boolean>(false);
  const [showCompass, setShowCompass] = useState<boolean>(true);
  const [showGlobe, setShowGlobe] = useState<boolean>(false);

  // Fullscreen support hook
  const { isFullscreen, toggleFullscreen } = useFullscreen();

  // Save splitRatio to localStorage
  const handleSplitRatioChange = useCallback((newRatio: number) => {
    setSplitRatio(newRatio);
    try {
      localStorage.setItem('astrovision_split_ratio', newRatio.toString());
    } catch {
      // ignore
    }
  }, []);

  // 3. Selection & Celestial Calculations
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [selectedObject, setSelectedObject] = useState<CelestialObject | null>(null);
  const lastTargetIdRef = useRef<string | null>(null);

  // 4. Sky Lens & Modals
  const [isSkyLensOpen, setIsSkyLensOpen] = useState<boolean>(false);
  const [isNasaGalleryOpen, setIsNasaGalleryOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isSensorGuideOpen, setIsSensorGuideOpen] = useState<boolean>(false);

  const [skyLensResult, setSkyLensResult] = useState<SkyLensResult | null>(null);
  const [skyLensSnapshot, setSkyLensSnapshot] = useState<string | null>(null);
  const [isScanningWithAi, setIsScanningWithAi] = useState<boolean>(false);

  // Periodic clock update for planetary orbits & sidereal time (every 5 seconds)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Compute all visible celestial bodies
  const visibleObjects = useMemo(() => {
    return getAllVisibleObjects(location, currentTime);
  }, [location, currentTime]);

  // Compute target currently centered in the reticle / camera direction
  const { target: currentTarget, angularDistance, nearby: nearbyObjects } = useMemo(() => {
    return findTargetInReticle(orientation.heading, orientation.pitch, visibleObjects, 16);
  }, [orientation.heading, orientation.pitch, visibleObjects]);

  // Moon phase calculation
  const moonPhase = useMemo(() => {
    return getMoonPhase(currentTime);
  }, [currentTime]);

  // Play subtle sound when reticle locks onto a new celestial object
  useEffect(() => {
    if (currentTarget && currentTarget.id !== lastTargetIdRef.current && angularDistance <= 10) {
      lastTargetIdRef.current = currentTarget.id;
      playLockOnSound();
    } else if (!currentTarget) {
      lastTargetIdRef.current = null;
    }
  }, [currentTarget, angularDistance]);

  // Execute Sky Lens identification via Gemini AI Backend
  const handleIdentifyWithLens = useCallback(
    async (overrideTarget?: CelestialObject) => {
      const target = overrideTarget || currentTarget;
      setIsScanningWithAi(true);
      setIsSkyLensOpen(true);
      setSkyLensResult(null);

      // Capture frame from camera
      const snapshot = takeSnapshot();
      setSkyLensSnapshot(snapshot);

      try {
        const payload = {
          azimuth: orientation.heading,
          altitude: orientation.pitch,
          latitude: location.latitude,
          longitude: location.longitude,
          targetCandidate: target
            ? {
                name: target.name,
                scientificName: target.scientificName,
                type: target.type,
                constellation: target.constellation,
                mag: target.mag,
                dist: target.distance,
                desc: target.description,
              }
            : null,
          nearbyCandidates: nearbyObjects.map((o) => ({
            name: o.name,
            constellation: o.constellation,
            mag: o.mag,
          })),
          imageBase64: snapshot,
        };

        const res = await fetch('/api/identify-sky', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (data && data.data) {
          setSkyLensResult(data.data);
        } else {
          throw new Error('Formato de resposta inválido');
        }
      } catch (err) {
        console.warn('Sky Lens AI identification failed:', err);
        // Fallback to local astronomical data
        if (target) {
          setSkyLensResult({
            name: target.name,
            scientificName: target.scientificName,
            type: target.type,
            constellation: target.constellation,
            apparentMagnitude: String(target.mag),
            distance: target.distance,
            spectralClassOrComposition: target.spectralType || 'Estrela / Corpo Celeste',
            shortSummary: target.description,
            mythologyAndHistory: target.mythology || 'Astro de destaque na abóbada celeste.',
            astrophysicsFacts: target.facts,
            observationTips: target.tips || 'Visível em locais com céu limpo.',
            curiosity: 'As estrelas parecem cintilar devido à turbulência na atmosfera terrestre.',
          });
        }
      } finally {
        setIsScanningWithAi(false);
      }
    },
    [currentTarget, orientation.heading, orientation.pitch, location, nearbyObjects, takeSnapshot]
  );

  // Handle follow-up questions to Gemini inside Sky Lens
  const handleAskFollowup = async (question: string): Promise<string | null> => {
    try {
      const res = await fetch('/api/identify-sky', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          azimuth: orientation.heading,
          altitude: orientation.pitch,
          latitude: location.latitude,
          longitude: location.longitude,
          targetCandidate: currentTarget || selectedObject,
          userQuery: question,
        }),
      });
      const data = await res.json();
      if (data && data.data) {
        return (
          data.data.shortSummary ||
          data.data.astrophysicsFacts?.join('\n\n') ||
          'Informação astronômica obtida com sucesso.'
        );
      }
      return null;
    } catch {
      return null;
    }
  };

  // Object Selection Handler
  const handleSelectObject = (obj: CelestialObject) => {
    setSelectedObject(obj);
    handleIdentifyWithLens(obj);
  };

  return (
    <div
      id="astrovision-app-root"
      className="w-full h-full h-[100dvh] min-h-[100dvh] max-h-[100dvh] overflow-hidden flex flex-col bg-[#050505] text-zinc-100 font-sans select-none"
    >
      {/* 1. Header Navigation & Status Bar */}
      <HeaderNav
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
        orientation={orientation}
        observer={location}
        moonPhase={moonPhase}
        isNightVision={isNightVision}
        onToggleNightVision={() => setIsNightVision((v) => !v)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenNasaGallery={() => setIsNasaGalleryOpen(true)}
        onOpenSensorGuide={() => setIsSensorGuideOpen(true)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
      />

      {/* 2. Main Viewport (Split Half-and-Half or Full Screen) */}
      <main
        id="main-viewport-container"
        className="relative flex-1 w-full h-full overflow-hidden flex flex-col bg-[#050505] touch-none select-none"
      >
        {/* TOP HALF: Live AR Camera View */}
        {(viewMode === 'split' || viewMode === 'camera_full') && (
          <div
            id="camera-half-panel"
            style={
              viewMode === 'split'
                ? { height: `${splitRatio * 100}%` }
                : { height: '100%' }
            }
            className="relative w-full overflow-hidden transition-[height] duration-75 ease-out"
          >
            <CameraView
              orientation={orientation}
              observer={location}
              currentTarget={currentTarget}
              angularDistance={angularDistance}
              nearbyObjects={nearbyObjects}
              cameraStream={cameraStream}
              cameraError={cameraError}
              cameraFacing={cameraFacing}
              isNightVision={isNightVision}
              showArHud={showArHud}
              isScanning={isScanningWithAi}
              onAttachVideo={attachVideoElement}
              onStartCamera={startCamera}
              onToggleCameraFacing={toggleCameraFacing}
              onToggleNightVision={() => setIsNightVision((v) => !v)}
              onToggleArHud={() => setShowArHud((v) => !v)}
              onIdentifyWithLens={() => handleIdentifyWithLens()}
              onSelectObject={handleSelectObject}
              onOpenSensorGuide={() => setIsSensorGuideOpen(true)}
              onRequestIosPermission={requestOrientationPermission}
              needsIosPermission={needsIosPermission}
            />
          </div>
        )}

        {/* MIDDLE RESIZER BAR (in Split Mode) */}
        {viewMode === 'split' && (
          <SplitResizer
            splitRatio={splitRatio}
            onRatioChange={handleSplitRatioChange}
            isNightVision={isNightVision}
            onDoubleReset={() => handleSplitRatioChange(0.5)}
          />
        )}

        {/* BOTTOM HALF: Interactive Celestial Planetarium & Star Map */}
        {(viewMode === 'split' || viewMode === 'sky_full') && (
          <div
            id="sky-map-half-panel"
            style={
              viewMode === 'split'
                ? { height: `${(1 - splitRatio) * 100}%` }
                : { height: '100%' }
            }
            className="relative w-full bg-[#08080a] overflow-hidden transition-[height] duration-75 ease-out"
          >
            <CelestialMap
              objects={visibleObjects}
              orientation={orientation}
              observer={location}
              selectedObject={selectedObject || currentTarget}
              onSelectObject={handleSelectObject}
              onManualLookaround={updateManualOrientation}
              isManualControl={isManualControl}
              onResetToSensors={resetToSensors}
              isNightVision={isNightVision}
            />
          </div>
        )}

        {/* Floating Controls & Navigation HUDs */}
        {/* Bottom-Left Controls Dock - elevated safely above iPhone home indicator */}
        <div className="absolute bottom-3.5 left-2.5 z-30 flex flex-col gap-2 pointer-events-auto">
          {showVirtualJoystick && (
            <div className="animate-fade-in">
              <VirtualJoystick
                onManualPan={updateManualOrientation}
                onReset={resetToSensors}
                isManualControl={isManualControl}
                isNightVision={isNightVision}
              />
            </div>
          )}

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              id="btn-toggle-virtual-joystick"
              onClick={() => {
                playClickSound();
                setShowVirtualJoystick((v) => !v);
              }}
              title={showVirtualJoystick ? 'Ocultar D-Pad Virtual' : 'Mostrar D-Pad Virtual (Controle Manual)'}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full backdrop-blur-md border text-[11px] font-mono tracking-wider transition cursor-pointer shadow-lg active:scale-95 ${
                showVirtualJoystick || isManualControl
                  ? 'bg-cyan-950/90 border-cyan-500/70 text-cyan-300 shadow-cyan-950/50'
                  : 'bg-black/75 border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700'
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>D-PAD</span>
            </button>

            <button
              id="btn-toggle-compass-hud"
              onClick={() => {
                playClickSound();
                setShowCompass((v) => !v);
              }}
              title={showCompass ? 'Ocultar Bússola' : 'Exibir Rosa dos Ventos'}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full backdrop-blur-md border text-[11px] font-mono tracking-wider transition cursor-pointer shadow-lg active:scale-95 ${
                showCompass
                  ? isNightVision
                    ? 'bg-red-950/90 border-red-500/70 text-red-300 shadow-red-950/50'
                    : 'bg-cyan-950/90 border-cyan-500/70 text-cyan-300 shadow-cyan-950/50'
                  : 'bg-black/75 border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700'
              }`}
            >
              <Compass className={`w-3.5 h-3.5 ${isNightVision ? 'text-red-400' : 'text-cyan-400'}`} />
              <span>BÚSSOLA</span>
            </button>

            <button
              id="btn-toggle-globe-hud"
              onClick={() => {
                playClickSound();
                setShowGlobe((v) => !v);
              }}
              title={showGlobe ? 'Ocultar Globo Terrestre' : 'Exibir Globo da Terra 3D'}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full backdrop-blur-md border text-[11px] font-mono tracking-wider transition cursor-pointer shadow-lg active:scale-95 ${
                showGlobe
                  ? isNightVision
                    ? 'bg-red-950/90 border-red-500/70 text-red-300 shadow-red-950/50'
                    : 'bg-indigo-950/90 border-indigo-500/70 text-indigo-300 shadow-indigo-950/50'
                  : 'bg-black/75 border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700'
              }`}
            >
              <Globe className={`w-3.5 h-3.5 ${isNightVision ? 'text-red-400' : 'text-indigo-400'}`} />
              <span>GLOBO 3D</span>
            </button>
          </div>
        </div>

        {/* Floating Draggable Widgets (Rosa dos Ventos & Globo Terrestre) */}
        {showGlobe && (
          <EarthGlobeWidget
            observer={location}
            orientation={orientation}
            isNightVision={isNightVision}
          />
        )}

        {showCompass && (
          <CompassRose
            orientation={orientation}
            isNightVision={isNightVision}
            onAlignNorth={() => {
              const delta = -orientation.heading;
              updateManualOrientation(delta, 0);
            }}
          />
        )}
      </main>

      {/* 3. Modal Dialogs */}
      <SkyLensModal
        isOpen={isSkyLensOpen}
        onClose={() => setIsSkyLensOpen(false)}
        result={skyLensResult}
        targetObject={currentTarget || selectedObject}
        snapshotUrl={skyLensSnapshot}
        isLoading={isScanningWithAi}
        isNightVision={isNightVision}
        onAskFollowup={handleAskFollowup}
      />

      <NasaGalleryModal
        isOpen={isNasaGalleryOpen}
        onClose={() => setIsNasaGalleryOpen(false)}
        isNightVision={isNightVision}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentLocation={location}
        onSelectCity={setCity}
        onRequestGps={requestLocation}
        isNightVision={isNightVision}
        onToggleNightVision={() => setIsNightVision((v) => !v)}
        onResetOrientation={resetToSensors}
      />

      <SensorGuideModal
        isOpen={isSensorGuideOpen}
        onClose={() => setIsSensorGuideOpen(false)}
        onRequestIosPermission={requestOrientationPermission}
        needsIosPermission={needsIosPermission}
        isNightVision={isNightVision}
      />
    </div>
  );
}
