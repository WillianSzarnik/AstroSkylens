import React from 'react';
import {
  Compass,
  Sparkles,
  Settings,
  Image as ImageIcon,
  Columns,
  Maximize2,
  Minimize2,
  Globe,
  Eye,
  Sliders,
  HelpCircle,
  Expand,
  Shrink,
} from 'lucide-react';
import { DeviceOrientationState, MoonPhaseInfo, ObserverCoords, ViewMode } from '../types/astronomy';
import { playClickSound } from '../utils/audioEffects';
import astroVisionLogo from '../assets/images/astrovision_logo_1786672605652.jpg';

interface HeaderNavProps {
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;
  orientation: DeviceOrientationState;
  observer: ObserverCoords;
  moonPhase: MoonPhaseInfo;
  isNightVision: boolean;
  onToggleNightVision: () => void;
  onOpenSettings: () => void;
  onOpenNasaGallery: () => void;
  onOpenSensorGuide: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  viewMode,
  onChangeViewMode,
  orientation,
  observer,
  moonPhase,
  isNightVision,
  onToggleNightVision,
  onOpenSettings,
  onOpenNasaGallery,
  onOpenSensorGuide,
  isFullscreen = false,
  onToggleFullscreen,
}) => {
  return (
    <header
      id="main-app-header"
      className={`relative z-30 w-full px-3 py-2 border-b flex items-center justify-between transition-colors ${
        isNightVision
          ? 'bg-[#08080a] border-red-900/60 text-red-100 night-vision-filter'
          : 'bg-[#08080a]/95 border-zinc-800 text-zinc-100 backdrop-blur-md'
      }`}
    >
      {/* Brand & GPS Badge */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg overflow-hidden border border-cyan-500/40 flex items-center justify-center bg-[#060611] shadow-[0_0_12px_rgba(6,182,212,0.3)] shrink-0">
            <img
              src={astroVisionLogo}
              alt="AstroVision"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs tracking-tight text-zinc-100 uppercase">
                AstroVision
              </span>
              <span className="text-[9px] font-mono tracking-widest px-1.5 py-0.2 rounded bg-cyan-950/60 border border-cyan-500/40 text-cyan-400">
                AR LENS
              </span>
            </div>
            <button
              id="btn-header-location-badge"
              onClick={() => {
                playClickSound();
                onOpenSettings();
              }}
              className="text-[10px] text-zinc-400 hover:text-cyan-400 transition truncate max-w-[130px] sm:max-w-[200px] flex items-center gap-1 text-left cursor-pointer font-mono"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block shrink-0" />
              <span className="truncate">{observer.cityName || 'GPS Local'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Center: View Layout Mode Switcher (1. AR Camera, 2. Split, 3. Sky Map, 4. Earth Orbit) */}
      <div className="flex items-center bg-[#050505] border border-zinc-800 p-0.5 rounded-xl shadow-inner">
        <button
          id="btn-mode-camera-full"
          onClick={() => {
            playClickSound();
            onChangeViewMode('camera_full');
          }}
          title="1. Modo AR Câmera (Tela Cheia)"
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono tracking-wider transition cursor-pointer ${
            viewMode === 'camera_full'
              ? 'bg-cyan-600 text-white font-semibold shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">AR CÂMERA</span>
        </button>

        <button
          id="btn-mode-split"
          onClick={() => {
            playClickSound();
            onChangeViewMode('split');
          }}
          title="2. Modo Dividido (Câmera Superior + Mapa Inferior)"
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono tracking-wider transition cursor-pointer ${
            viewMode === 'split'
              ? 'bg-cyan-600 text-white font-semibold shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Columns className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">DIVIDIDO</span>
        </button>

        <button
          id="btn-mode-sky-full"
          onClick={() => {
            playClickSound();
            onChangeViewMode('sky_full');
          }}
          title="3. Modo Mapa Celeste / Carta Estelar"
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono tracking-wider transition cursor-pointer ${
            viewMode === 'sky_full'
              ? 'bg-cyan-600 text-white font-semibold shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">MAPA CELESTE</span>
        </button>

        <button
          id="btn-mode-earth-orbit"
          onClick={() => {
            playClickSound();
            onChangeViewMode('earth_orbit');
          }}
          title="4. Modo Terra & Órbitas (Trajetória da ISS e Satélites sobre o Mapa Mundi)"
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono tracking-wider transition cursor-pointer ${
            viewMode === 'earth_orbit'
              ? 'bg-cyan-600 text-white font-semibold shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">TERRA & ÓRBITAS</span>
        </button>
      </div>

      {/* Right: Quick Tools */}
      <div className="flex items-center gap-1.5">
        {/* Moon Phase Badge */}
        <div
          title={`Fase Lunar: ${moonPhase.phaseName} (${Math.round(moonPhase.illumination * 100)}% iluminada)`}
          className="hidden md:flex items-center gap-1.5 px-2 py-1 bg-zinc-900/80 border border-zinc-800 rounded-lg text-xs text-zinc-300 font-mono"
        >
          <span className="text-sm">{moonPhase.icon}</span>
          <span className="text-[10px] text-zinc-400">{Math.round(moonPhase.illumination * 100)}%</span>
        </div>

        {/* Fullscreen Button */}
        {onToggleFullscreen && (
          <button
            id="btn-toggle-fullscreen"
            onClick={() => {
              playClickSound();
              onToggleFullscreen();
            }}
            title={isFullscreen ? 'Sair do Modo Tela Cheia' : 'Entrar em Tela Cheia (Bloqueia Gestos do Navegador)'}
            className={`p-1.5 rounded-xl border transition cursor-pointer ${
              isFullscreen
                ? 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300 shadow-sm shadow-cyan-950/40'
                : 'bg-zinc-900/90 border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 hover:border-zinc-700'
            }`}
          >
            {isFullscreen ? <Shrink className="w-4 h-4 text-cyan-400" /> : <Expand className="w-4 h-4" />}
          </button>
        )}

        {/* NASA APOD Gallery Button */}
        <button
          id="btn-open-nasa-apod"
          onClick={() => {
            playClickSound();
            onOpenNasaGallery();
          }}
          title="Ver Imagens Espaciais da NASA"
          className="p-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800 text-cyan-400 hover:text-cyan-300 hover:bg-zinc-800 hover:border-zinc-700 transition cursor-pointer"
        >
          <ImageIcon className="w-4 h-4" />
        </button>

        {/* Settings Button */}
        <button
          id="btn-open-settings"
          onClick={() => {
            playClickSound();
            onOpenSettings();
          }}
          title="Configurações e Localização"
          className="p-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 hover:border-zinc-700 transition cursor-pointer"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
