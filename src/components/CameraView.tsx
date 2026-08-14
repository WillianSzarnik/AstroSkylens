import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Camera,
  RefreshCw,
  Sparkles,
  Eye,
  Crosshair,
  Compass,
  Zap,
  Info,
  Layers,
  AlertCircle,
  Search,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  X,
  Target,
  CheckCircle2,
  Sliders,
} from 'lucide-react';
import { CelestialObject, DeviceOrientationState, ObserverCoords } from '../types/astronomy';
import { playScanSound, playClickSound, playLockOnSound } from '../utils/audioEffects';

function getCardinal(deg: number): string {
  const normalized = ((deg % 360) + 360) % 360;
  const directions = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'];
  const index = Math.round(normalized / 45) % 8;
  return directions[index];
}

interface CameraViewProps {
  orientation: DeviceOrientationState;
  observer: ObserverCoords;
  currentTarget: CelestialObject | null;
  angularDistance: number;
  nearbyObjects: CelestialObject[];
  allObjects: CelestialObject[];
  cameraStream: MediaStream | null;
  cameraError: string | null;
  cameraFacing: 'environment' | 'user';
  isNightVision: boolean;
  showArHud: boolean;
  isScanning: boolean;
  onAttachVideo: (el: HTMLVideoElement | null) => void;
  onStartCamera: () => void;
  onToggleCameraFacing: () => void;
  onToggleNightVision: () => void;
  onToggleArHud: () => void;
  onIdentifyWithLens: () => void;
  onSelectObject: (obj: CelestialObject) => void;
  onOpenSettings: () => void;
  onRequestIosPermission?: () => void;
  needsIosPermission?: boolean;
}

export const CameraView: React.FC<CameraViewProps> = ({
  orientation,
  currentTarget,
  angularDistance,
  nearbyObjects,
  allObjects,
  cameraStream,
  cameraError,
  cameraFacing,
  isNightVision,
  showArHud,
  isScanning,
  onAttachVideo,
  onStartCamera,
  onToggleCameraFacing,
  onToggleNightVision,
  onToggleArHud,
  onIdentifyWithLens,
  onSelectObject,
  onOpenSettings,
  onRequestIosPermission,
  needsIosPermission,
}) => {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const isInitializedRef = useRef<boolean>(false);
  const isIos = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const inIframe = typeof window !== 'undefined' && window.self !== window.top;

  // Selected target for AR Guidance Pointer (e.g. Venus, Sirius, ISS, Mars)
  const [guidedTarget, setGuidedTarget] = useState<CelestialObject | null>(null);
  const [isTargetFinderOpen, setIsTargetFinderOpen] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Request camera on mount
  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      onStartCamera();
    }
  }, [onStartCamera]);

  // Bind cameraStream to video
  useEffect(() => {
    const video = localVideoRef.current;
    if (!video) return;

    if (cameraStream) {
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.srcObject = cameraStream;

      const playVideo = async () => {
        try {
          await video.play();
        } catch (err) {
          console.warn('Video autoPlay prevented or delayed:', err);
        }
      };

      video.addEventListener('loadedmetadata', playVideo);
      video.addEventListener('canplay', playVideo);
      playVideo();

      if (onAttachVideo) {
        onAttachVideo(video);
      }

      return () => {
        video.removeEventListener('loadedmetadata', playVideo);
        video.removeEventListener('canplay', playVideo);
      };
    } else {
      video.srcObject = null;
      if (onAttachVideo) {
        onAttachVideo(null);
      }
    }
  }, [cameraStream, onAttachVideo]);

  const handleActivateAll = () => {
    onStartCamera();
    if (needsIosPermission && onRequestIosPermission) {
      onRequestIosPermission();
    }
  };

  const handleOpenNewTab = () => {
    if (typeof window !== 'undefined') {
      window.open(window.location.href, '_blank');
    }
  };

  // Find updated coordinates of the guided target from allObjects
  const activeGuidedObject = useMemo(() => {
    if (!guidedTarget) return null;
    return allObjects.find((o) => o.id === guidedTarget.id) || guidedTarget;
  }, [guidedTarget, allObjects]);

  // Calculate Guidance Offsets
  const guidanceMath = useMemo(() => {
    if (!activeGuidedObject || activeGuidedObject.azimuth == null || activeGuidedObject.altitude == null) {
      return null;
    }

    // Heading delta: -180 to +180 deg (negative = turn left, positive = turn right)
    const deltaAz = ((activeGuidedObject.azimuth - orientation.heading + 540) % 360) - 180;
    // Pitch delta: negative = look down, positive = look up
    const deltaAlt = activeGuidedObject.altitude - orientation.pitch;

    // Total angular distance
    const totalDist = Math.sqrt(deltaAz * deltaAz + deltaAlt * deltaAlt);
    const isLockedOn = Math.abs(deltaAz) <= 8 && Math.abs(deltaAlt) <= 8;

    return {
      deltaAz,
      deltaAlt,
      totalDist,
      isLockedOn,
      isAboveHorizon: activeGuidedObject.altitude > 0,
    };
  }, [activeGuidedObject, orientation.heading, orientation.pitch]);

  // Filtered objects for Target Finder modal
  const searchableObjects = useMemo(() => {
    const term = searchFilter.toLowerCase().trim();
    if (!term) {
      // Prioritize planets, famous stars, and ISS
      return allObjects.filter(
        (o) =>
          o.type === 'planet' ||
          o.id === 'sun' ||
          o.id === 'moon' ||
          o.id === 'iss_space_station' ||
          o.mag < 1.0
      );
    }
    return allObjects.filter(
      (o) =>
        o.name.toLowerCase().includes(term) ||
        o.scientificName.toLowerCase().includes(term) ||
        o.constellation.toLowerCase().includes(term) ||
        o.type.toLowerCase().includes(term)
    );
  }, [allObjects, searchFilter]);

  const headingText = `${Math.round(orientation.heading)}° ${getCardinal(orientation.heading)}`;
  const altitudeText = `${Math.round(orientation.pitch)}°`;
  const isTargetLocked = currentTarget && angularDistance <= 10;

  return (
    <div
      id="camera-view-container"
      className={`relative w-full h-full overflow-hidden bg-[#050505] select-none ${
        isNightVision ? 'night-vision-filter' : ''
      }`}
    >
      {/* 1. Camera Video Feed */}
      <video
        id="ar-camera-feed"
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
          cameraStream ? 'opacity-100' : 'opacity-0 pointer-events-none'
        } ${cameraFacing === 'user' ? 'scale-x-[-1]' : ''}`}
      />

      {/* Fallback / Permission Request Overlay */}
      {!cameraStream && (
        <div
          id="camera-fallback"
          className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#050505] via-[#08080a] to-[#050505] p-6 text-center z-10"
        >
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-cyan-400 mb-4 shadow-xl">
            {cameraError ? (
              <AlertCircle className="w-8 h-8 text-amber-400 animate-pulse" />
            ) : (
              <Camera className="w-8 h-8 animate-pulse" />
            )}
          </div>
          <h3 className="text-sm font-bold tracking-tight text-zinc-100 uppercase mb-1">
            {cameraError ? 'Acesso à Câmera Requerido' : 'Visualizador AR do Céu Noturno'}
          </h3>
          <p className="text-xs text-zinc-400 max-w-xs mb-4">
            {cameraError ||
              (isIos
                ? 'No iPhone, toque no botão abaixo para autorizar o acesso à câmera traseira e giroscópio no Safari.'
                : 'Permita o uso da câmera para sobrepor as estrelas, planetas e constelações em tempo real na abóbada celeste.')}
          </p>

          <div className="flex flex-col sm:flex-row flex-wrap gap-2.5 justify-center items-center">
            <button
              id="btn-enable-camera"
              onClick={handleActivateAll}
              className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-mono font-bold tracking-wider transition shadow-lg flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Camera className="w-4 h-4" />
              <span>{cameraError ? 'TENTAR NOVAMENTE' : 'ATIVAR CÂMERA & AR'}</span>
            </button>

            {inIframe && (
              <button
                id="btn-open-in-new-tab"
                onClick={handleOpenNewTab}
                title="Abrir diretamente no Safari"
                className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-cyan-400 border border-zinc-700 rounded-xl text-xs font-mono font-semibold tracking-wider transition shadow-md flex items-center gap-2 cursor-pointer"
              >
                <span>ABRIR NO SAFARI (NOVA ABA)</span>
              </button>
            )}

            {needsIosPermission && (
              <button
                id="btn-ios-gyro-perm"
                onClick={onRequestIosPermission}
                className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-xl text-xs font-mono font-semibold tracking-wider transition shadow-md flex items-center gap-2 cursor-pointer"
              >
                <Compass className="w-4 h-4 text-cyan-400" />
                <span>AUTORIZAR SENSORES</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 2. AR HUD Overlays */}
      {showArHud && (
        <div id="ar-hud-overlay" className="absolute inset-0 pointer-events-none">
          {/* Compass Tape at Top */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3.5 py-1 bg-black/80 backdrop-blur-md border border-cyan-500/40 rounded-full text-cyan-400 text-[10px] font-mono tracking-widest uppercase shadow-lg">
            <Compass className="w-3.5 h-3.5 text-cyan-400 animate-spin-slow" />
            <span>AZ {headingText}</span>
            <span className="text-zinc-600">|</span>
            <span>ALT {altitudeText}</span>
          </div>

          {/* Central Aiming Reticle */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className={`relative transition-all duration-300 ${
                guidanceMath?.isLockedOn || isTargetLocked
                  ? 'w-36 h-36 border-cyan-400 scale-105 shadow-[0_0_25px_rgba(6,182,212,0.5)]'
                  : 'w-28 h-28 border-white/30'
              }`}
            >
              {/* Corner brackets */}
              <div
                className={`absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 transition-colors ${
                  guidanceMath?.isLockedOn || isTargetLocked
                    ? 'border-emerald-400 shadow-[0_0_12px_#34d399]'
                    : 'border-white/50'
                }`}
              />
              <div
                className={`absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 transition-colors ${
                  guidanceMath?.isLockedOn || isTargetLocked
                    ? 'border-emerald-400 shadow-[0_0_12px_#34d399]'
                    : 'border-white/50'
                }`}
              />
              <div
                className={`absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 transition-colors ${
                  guidanceMath?.isLockedOn || isTargetLocked
                    ? 'border-emerald-400 shadow-[0_0_12px_#34d399]'
                    : 'border-white/50'
                }`}
              />
              <div
                className={`absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 transition-colors ${
                  guidanceMath?.isLockedOn || isTargetLocked
                    ? 'border-emerald-400 shadow-[0_0_12px_#34d399]'
                    : 'border-white/50'
                }`}
              />

              {/* Center Dot / Crosshair */}
              <div className="absolute inset-0 flex items-center justify-center">
                {guidanceMath?.isLockedOn || isTargetLocked ? (
                  <div className="relative flex items-center justify-center">
                    <Crosshair className="w-6 h-6 text-emerald-400 animate-pulse" />
                    <span className="absolute w-2 h-2 bg-emerald-400 rounded-full" />
                  </div>
                ) : (
                  <div className="w-1.5 h-1.5 bg-white/40 rounded-full" />
                )}
              </div>

              {/* Scanning Laser Animation */}
              {isScanning && (
                <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#38bdf8] animate-scan" />
              )}
            </div>
          </div>

          {/* ============================================================ */}
          {/* TARGET FINDER GUIDANCE POINTER HUD (e.g. "Onde está Vênus?") */}
          {/* ============================================================ */}
          {activeGuidedObject && guidanceMath && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-4 z-20">
              {/* Top Guidance Direction Banner */}
              <div className="mt-10 px-4 py-2.5 rounded-2xl bg-black/90 backdrop-blur-md border border-cyan-400/80 shadow-2xl flex items-center gap-3 animate-slide-down pointer-events-auto">
                <div className="p-2 rounded-xl bg-cyan-950 border border-cyan-500/60 text-cyan-400">
                  <Target className="w-4 h-4 animate-spin-slow" />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-zinc-100 uppercase tracking-tight">
                      Buscando: {activeGuidedObject.name}
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-700">
                      {guidanceMath.isAboveHorizon ? 'NO CÉU' : 'ABAIXO DO HORIZONTE'}
                    </span>
                  </div>

                  {/* Dynamic Tactical Visual Commands */}
                  <div className="flex items-center gap-2 text-xs font-mono font-bold mt-0.5">
                    {guidanceMath.isLockedOn ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        🎯 ALVO ENQUADRADO NO CENTRO DA MIRA!
                      </span>
                    ) : (
                      <div className="flex items-center gap-2.5 flex-wrap">
                        {/* Horizontal Guidance */}
                        {guidanceMath.deltaAz > 10 && (
                          <span className="text-amber-300 flex items-center gap-1 animate-pulse">
                            <ArrowRight className="w-3.5 h-3.5" />
                            Gire para a DIREITA ({Math.round(guidanceMath.deltaAz)}°)
                          </span>
                        )}
                        {guidanceMath.deltaAz < -10 && (
                          <span className="text-amber-300 flex items-center gap-1 animate-pulse">
                            <ArrowLeft className="w-3.5 h-3.5" />
                            Gire para a ESQUERDA ({Math.round(Math.abs(guidanceMath.deltaAz))}°)
                          </span>
                        )}

                        {/* Vertical Guidance */}
                        {guidanceMath.deltaAlt > 8 && (
                          <span className="text-cyan-300 flex items-center gap-1 animate-pulse">
                            <ArrowUp className="w-3.5 h-3.5" />
                            Olhe para CIMA (+{Math.round(guidanceMath.deltaAlt)}°)
                          </span>
                        )}
                        {guidanceMath.deltaAlt < -8 && (
                          <span className="text-cyan-300 flex items-center gap-1 animate-pulse">
                            <ArrowDown className="w-3.5 h-3.5" />
                            Olhe para BAIXO ({Math.round(guidanceMath.deltaAlt)}°)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Cancel Guidance Button */}
                <button
                  onClick={() => {
                    playClickSound();
                    setGuidedTarget(null);
                  }}
                  className="p-1 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer ml-2"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Directional Edge Indicators (Arrows pointing to target if off-screen) */}
              {!guidanceMath.isLockedOn && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-between px-3">
                  {guidanceMath.deltaAz < -15 && (
                    <div className="p-2.5 rounded-full bg-cyan-950/90 border-2 border-cyan-400 text-cyan-300 shadow-[0_0_20px_#22d3ee] animate-bounce-horizontal-left flex items-center gap-1 font-mono text-[10px] font-bold">
                      <ArrowLeft className="w-4 h-4" />
                      <span>{Math.round(Math.abs(guidanceMath.deltaAz))}°</span>
                    </div>
                  )}

                  <div className="flex-1" />

                  {guidanceMath.deltaAz > 15 && (
                    <div className="p-2.5 rounded-full bg-cyan-950/90 border-2 border-cyan-400 text-cyan-300 shadow-[0_0_20px_#22d3ee] animate-bounce-horizontal-right flex items-center gap-1 font-mono text-[10px] font-bold">
                      <span>{Math.round(guidanceMath.deltaAz)}°</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Locked Object Live Badge (Positioned safely above D-pad / controls) */}
          {currentTarget && !guidedTarget && (
            <div className="absolute top-14 left-1/2 -translate-x-1/2 pointer-events-auto max-w-[90%] z-20">
              <button
                id="btn-quick-target-info"
                onClick={() => onSelectObject(currentTarget)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl backdrop-blur-md border text-left transition shadow-xl ${
                  isTargetLocked
                    ? 'bg-black/90 border-cyan-400/90 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                    : 'bg-black/80 border-zinc-800 text-zinc-300'
                }`}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full animate-ping"
                  style={{ backgroundColor: currentTarget.color || '#38bdf8' }}
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate flex items-center gap-1">
                    <span>{currentTarget.name}</span>
                    <span className="text-[9px] font-mono px-1 py-0.2 bg-cyan-950 border border-cyan-800 text-cyan-300 rounded uppercase">
                      {currentTarget.type}
                    </span>
                  </div>
                  <div className="text-[10px] text-zinc-400 truncate font-mono">
                    {currentTarget.constellation} • Mag {currentTarget.mag} • {currentTarget.distance}
                  </div>
                </div>
                <Info className="w-3.5 h-3.5 text-cyan-400 ml-1 shrink-0" />
              </button>
            </div>
          )}

          {/* Horizon Level Line */}
          <div
            className="absolute left-0 right-0 h-px bg-cyan-500/20 pointer-events-none"
            style={{
              top: `${Math.max(10, Math.min(90, 50 - orientation.pitch * 0.8))}%`,
            }}
          >
            <div className="absolute left-2 text-[9px] font-mono text-cyan-500/70 -top-3 tracking-wider">
              HORIZONTE 0°
            </div>
          </div>
        </div>
      )}

      {/* 3. Top-Left Quick SkyLens & Find Target Buttons */}
      <div className="absolute top-2 left-2 flex items-center gap-1.5 z-20">
        <button
          id="btn-identify-sky-lens-circular"
          onClick={() => {
            playScanSound();
            onIdentifyWithLens();
          }}
          disabled={isScanning}
          title="SkyLens: Identificar Objeto Celeste com IA"
          className={`relative group flex items-center gap-1.5 p-2 px-2.5 rounded-full font-mono text-xs text-white shadow-xl transition-all duration-200 cursor-pointer overflow-hidden backdrop-blur-md active:scale-95 ${
            isScanning
              ? 'bg-zinc-800/90 border border-zinc-700 cursor-not-allowed opacity-80'
              : isNightVision
              ? 'bg-red-950/90 hover:bg-red-900 border border-red-500/70 text-red-300 shadow-[0_0_12px_rgba(239,68,68,0.4)]'
              : 'bg-cyan-950/90 hover:bg-cyan-900/90 border border-cyan-400/60 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.35)]'
          }`}
        >
          <div className="relative flex items-center justify-center">
            <Sparkles
              className={`w-4 h-4 text-cyan-300 ${
                isScanning ? 'animate-spin text-amber-400' : 'group-hover:scale-110'
              }`}
            />
            {!isScanning && (
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping" />
            )}
          </div>
          <span className="text-[10px] font-bold tracking-wider uppercase pr-0.5">
            {isScanning ? 'LENS...' : 'SKYLENS'}
          </span>
        </button>

        {/* Find Astro / Target Selector Button */}
        <button
          id="btn-open-target-finder"
          onClick={() => {
            playClickSound();
            setIsTargetFinderOpen(true);
          }}
          title="Localizar Astro no Céu (Vênus, Marte, Júpiter, ISS, etc.)"
          className={`flex items-center gap-1.5 px-2.5 py-2 rounded-full font-mono text-xs shadow-xl backdrop-blur-md border transition cursor-pointer active:scale-95 ${
            guidedTarget
              ? 'bg-amber-950/90 border-amber-500 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.4)] font-bold'
              : 'bg-black/80 hover:bg-zinc-900 border-zinc-700 text-zinc-200'
          }`}
        >
          <Target className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[10px] uppercase">
            {guidedTarget ? guidedTarget.name.split(' ')[0] : 'LOCALIZAR ASTRO'}
          </span>
        </button>
      </div>

      {/* 4. Top-Right Quick Action Bar */}
      <div className="absolute top-2 right-2 flex items-center gap-1.5 z-20">
        <button
          id="btn-night-vision"
          onClick={onToggleNightVision}
          title={isNightVision ? 'Desativar Visão Noturna Vermelha' : 'Ativar Visão Noturna (Red Light)'}
          className={`p-2 rounded-xl backdrop-blur-md border transition cursor-pointer ${
            isNightVision
              ? 'bg-red-950/90 border-red-500 text-red-300 shadow-[0_0_10px_#ef4444]'
              : 'bg-zinc-900/90 border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700'
          }`}
        >
          <Eye className="w-4 h-4" />
        </button>

        <button
          id="btn-toggle-hud"
          onClick={onToggleArHud}
          title={showArHud ? 'Ocultar Mira HUD' : 'Mostrar Mira HUD'}
          className={`p-2 rounded-xl backdrop-blur-md border transition cursor-pointer ${
            showArHud
              ? 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300'
              : 'bg-zinc-900/90 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
          }`}
        >
          <Layers className="w-4 h-4" />
        </button>

        {cameraStream && (
          <button
            id="btn-flip-camera"
            onClick={onToggleCameraFacing}
            title="Alternar Câmera Frontal / Traseira"
            className="p-2 rounded-xl bg-zinc-900/90 backdrop-blur-md border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}

        <button
          id="btn-camera-settings"
          onClick={onOpenSettings}
          title="Configurações e Sensores"
          className="p-2 rounded-xl bg-zinc-900/90 backdrop-blur-md border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 transition cursor-pointer"
        >
          <Sliders className="w-4 h-4" />
        </button>
      </div>

      {/* 5. Target Finder Modal / Popover */}
      {isTargetFinderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md max-h-[80vh] flex flex-col rounded-3xl bg-[#08080a] border border-zinc-800 shadow-2xl overflow-hidden animate-slide-up">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between bg-[#050505]">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-tight">
                  Localizar Astro no Céu (Guia AR)
                </h3>
              </div>
              <button
                onClick={() => setIsTargetFinderOpen(false)}
                className="p-1 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-3 border-b border-zinc-800 bg-[#060608]">
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Buscar Vênus, Marte, Sirius, ISS, Cruzeiro do Sul..."
                  className="w-full pl-9 pr-3 py-2 bg-zinc-900/90 border border-zinc-700 rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            {/* Quick Filter Categories */}
            <div className="px-3 py-2 border-b border-zinc-800/80 bg-[#050505] flex items-center gap-1.5 overflow-x-auto text-[10px] font-mono">
              <button
                onClick={() => setSearchFilter('Vênus')}
                className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-zinc-700 shrink-0 cursor-pointer"
              >
                🌟 Vênus
              </button>
              <button
                onClick={() => setSearchFilter('Marte')}
                className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-red-400 border border-zinc-700 shrink-0 cursor-pointer"
              >
                🔴 Marte
              </button>
              <button
                onClick={() => setSearchFilter('Júpiter')}
                className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-yellow-300 border border-zinc-700 shrink-0 cursor-pointer"
              >
                🪐 Júpiter
              </button>
              <button
                onClick={() => setSearchFilter('ISS')}
                className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-emerald-400 border border-zinc-700 shrink-0 cursor-pointer"
              >
                🛰️ ISS
              </button>
              <button
                onClick={() => setSearchFilter('Cruzeiro')}
                className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-cyan-400 border border-zinc-700 shrink-0 cursor-pointer"
              >
                ✝️ Cruzeiro do Sul
              </button>
            </div>

            {/* List of Targets */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5 text-xs">
              {searchableObjects.map((obj) => {
                const isAboveHorizon = (obj.altitude || 0) > 0;
                return (
                  <button
                    key={obj.id}
                    onClick={() => {
                      playLockOnSound();
                      setGuidedTarget(obj);
                      setIsTargetFinderOpen(false);
                    }}
                    className="w-full p-2.5 rounded-xl bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800 hover:border-cyan-500/60 flex items-center justify-between text-left transition cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: obj.color || '#38bdf8' }}
                      />
                      <div className="min-w-0">
                        <div className="font-bold text-zinc-100 group-hover:text-cyan-300 flex items-center gap-1.5">
                          <span>{obj.name}</span>
                          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-black/60 text-zinc-400 border border-zinc-800">
                            {obj.type}
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-400 font-mono truncate">
                          {obj.constellation} • Mag {obj.mag}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 pl-2">
                      <div
                        className={`text-[10px] font-mono font-bold ${
                          isAboveHorizon ? 'text-emerald-400' : 'text-zinc-500'
                        }`}
                      >
                        {isAboveHorizon ? `Alt ${Math.round(obj.altitude || 0)}°` : 'Abaixo 0°'}
                      </div>
                      <div className="text-[9px] text-cyan-400 group-hover:underline flex items-center gap-0.5 justify-end">
                        <span>GUIAR</span>
                        <ArrowRight className="w-2.5 h-2.5" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
