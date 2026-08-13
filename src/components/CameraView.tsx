import React, { useEffect, useRef } from 'react';
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
  HelpCircle,
  AlertCircle,
} from 'lucide-react';
import { CelestialObject, DeviceOrientationState, ObserverCoords } from '../types/astronomy';
import { playScanSound } from '../utils/audioEffects';

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
  onOpenSensorGuide: () => void;
  onRequestIosPermission?: () => void;
  needsIosPermission?: boolean;
}

export const CameraView: React.FC<CameraViewProps> = ({
  orientation,
  currentTarget,
  angularDistance,
  nearbyObjects,
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
  onOpenSensorGuide,
  onRequestIosPermission,
  needsIosPermission,
}) => {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const isInitializedRef = useRef<boolean>(false);
  const isIos = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const inIframe = typeof window !== 'undefined' && window.self !== window.top;

  // Request camera on mount (works on desktop/Android; on iOS touch fallback takes over if blocked)
  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      onStartCamera();
    }
  }, [onStartCamera]);

  // Robustly bind cameraStream to video element and handle autoplay on iOS/WebKit
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
      {/* 1. Camera Video Feed (always present to prevent lifecycle detach) */}
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

      {/* Fallback / Permission Request Overlay if no active stream */}
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

          {isIos && (
            <div className="mt-4 p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-[11px] text-zinc-400 max-w-xs leading-relaxed">
              <strong className="text-zinc-200">Dica iOS:</strong> Caso apareça a mensagem de bloqueio, verifique em <em>Ajustes &gt; Safari &gt; Câmera (Permitir)</em> ou abra o link em uma nova aba no Safari.
            </div>
          )}
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

          {/* Central Aiming Reticle (Google Lens Style) */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className={`relative transition-all duration-300 ${
                isTargetLocked
                  ? 'w-36 h-36 border-cyan-400 scale-105'
                  : 'w-28 h-28 border-white/30'
              }`}
            >
              {/* Corner brackets */}
              <div
                className={`absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 transition-colors ${
                  isTargetLocked ? 'border-cyan-400 shadow-[0_0_12px_#22d3ee]' : 'border-white/50'
                }`}
              />
              <div
                className={`absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 transition-colors ${
                  isTargetLocked ? 'border-cyan-400 shadow-[0_0_12px_#22d3ee]' : 'border-white/50'
                }`}
              />
              <div
                className={`absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 transition-colors ${
                  isTargetLocked ? 'border-cyan-400 shadow-[0_0_12px_#22d3ee]' : 'border-white/50'
                }`}
              />
              <div
                className={`absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 transition-colors ${
                  isTargetLocked ? 'border-cyan-400 shadow-[0_0_12px_#22d3ee]' : 'border-white/50'
                }`}
              />

              {/* Center Dot / Crosshair with red tactical pulse */}
              <div className="absolute inset-0 flex items-center justify-center">
                {isTargetLocked ? (
                  <div className="relative flex items-center justify-center">
                    <Crosshair className="w-5 h-5 text-cyan-400 animate-pulse" />
                    <span className="absolute w-1.5 h-1.5 bg-red-500 rounded-full" />
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

          {/* Locked Object Live Badge */}
          {currentTarget && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 pointer-events-auto max-w-[90%]">
              <button
                id="btn-quick-target-info"
                onClick={() => onSelectObject(currentTarget)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl backdrop-blur-md border text-left transition shadow-xl ${
                  isTargetLocked
                    ? 'bg-black/85 border-cyan-400/80 text-cyan-300'
                    : 'bg-black/75 border-zinc-800 text-zinc-300'
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

      {/* 3. Top-Right Quick Action Bar */}
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
          id="btn-sensor-guide"
          onClick={onOpenSensorGuide}
          title="Ajuda sobre Sensores e Giroscópio"
          className="p-2 rounded-xl bg-zinc-900/90 backdrop-blur-md border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition cursor-pointer"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>

      {/* 4. Bottom Main Sky Lens Identify Trigger */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
        <button
          id="btn-identify-sky-lens"
          onClick={() => {
            playScanSound();
            onIdentifyWithLens();
          }}
          disabled={isScanning}
          className={`group relative flex items-center gap-2.5 px-5 py-2.5 rounded-full font-mono text-xs text-white shadow-xl transition-all duration-300 cursor-pointer overflow-hidden ${
            isScanning
              ? 'bg-zinc-800 border border-zinc-700 cursor-not-allowed opacity-80'
              : 'bg-cyan-600 hover:bg-cyan-500 border border-cyan-400/50 shadow-lg shadow-cyan-950/60 hover:shadow-[0_0_20px_#06b6d4]'
          }`}
        >
          <Sparkles
            className={`w-4 h-4 text-white ${
              isScanning ? 'animate-spin' : 'group-hover:scale-110'
            }`}
          />
          <span className="tracking-widest uppercase font-bold">
            {isScanning ? 'IDENTIFICANDO...' : 'SKY LENS (IDENTIFICAR)'}
          </span>
          <Zap className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
        </button>
      </div>
    </div>
  );
};
