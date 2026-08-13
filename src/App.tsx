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
import { playLockOnSound, playClickSound } from './utils/audioEffects';
import { Gamepad2, Sparkles, Navigation2 } from 'lucide-react';

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
  const [isNightVision, setIsNightVision] = useState<boolean>(false);
  const [showArHud, setShowArHud] = useState<boolean>(true);
  const [showVirtualJoystick, setShowVirtualJoystick] = useState<boolean>(false);

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
      className="w-screen h-screen overflow-hidden flex flex-col bg-[#050505] text-zinc-100 font-sans select-none"
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
      />

      {/* 2. Main Viewport (Split Half-and-Half or Full Screen) */}
      <main id="main-viewport-container" className="relative flex-1 w-full h-full overflow-hidden flex flex-col bg-[#050505]">
        {/* TOP HALF: Live AR Camera View */}
        {(viewMode === 'split' || viewMode === 'camera_full') && (
          <div
            id="camera-half-panel"
            className={`relative w-full transition-all duration-300 ${
              viewMode === 'split' ? 'h-1/2 border-b border-zinc-800' : 'h-full'
            }`}
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

        {/* BOTTOM HALF: Interactive Celestial Planetarium & Star Map */}
        {(viewMode === 'split' || viewMode === 'sky_full') && (
          <div
            id="sky-map-half-panel"
            className={`relative w-full transition-all duration-300 ${
              viewMode === 'split' ? 'h-1/2 bg-[#08080a]' : 'h-full bg-[#08080a]'
            }`}
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

        {/* Floating Virtual D-Pad / Joystick Toggle */}
        <div className="absolute bottom-4 left-3 z-30 flex flex-col gap-2">
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

          <button
            id="btn-toggle-virtual-joystick"
            onClick={() => {
              playClickSound();
              setShowVirtualJoystick((v) => !v);
            }}
            title={showVirtualJoystick ? 'Ocultar D-Pad Virtual' : 'Mostrar D-Pad Virtual (Controle Manual)'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md border text-xs font-mono tracking-wider transition cursor-pointer shadow-lg ${
              showVirtualJoystick || isManualControl
                ? 'bg-cyan-950/80 border-cyan-500/60 text-cyan-300 shadow-cyan-950/50'
                : 'bg-black/60 border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:border-zinc-700'
            }`}
          >
            <Gamepad2 className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">D-PAD 360°</span>
          </button>
        </div>
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
