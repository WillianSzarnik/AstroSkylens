import React, { useState } from 'react';
import {
  X,
  MapPin,
  Compass,
  Volume2,
  VolumeX,
  Eye,
  Check,
  Navigation,
  Smartphone,
  Sparkles,
  Layers,
  Orbit,
  Sliders,
  HelpCircle,
  Activity,
  RotateCcw,
} from 'lucide-react';
import { DeviceOrientationState, ObserverCoords, SkyFiltersState } from '../types/astronomy';
import { PRESET_CITIES } from '../hooks/useDeviceSensors';
import { isSoundEnabled, setSoundEnabled, playClickSound } from '../utils/audioEffects';
import astroVisionLogo from '../assets/images/astrovision_logo_1786672605652.jpg';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLocation: ObserverCoords;
  onSelectCity: (city: ObserverCoords) => void;
  onRequestGps: () => void;
  isNightVision: boolean;
  onToggleNightVision: () => void;
  onResetOrientation: () => void;
  orientation?: DeviceOrientationState;
  onRequestIosPermission?: () => void;
  needsIosPermission?: boolean;
  skyFilters: SkyFiltersState;
  onUpdateSkyFilters: (filters: Partial<SkyFiltersState>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentLocation,
  onSelectCity,
  onRequestGps,
  isNightVision,
  onToggleNightVision,
  onResetOrientation,
  orientation,
  onRequestIosPermission,
  needsIosPermission,
  skyFilters,
  onUpdateSkyFilters,
}) => {
  const [activeTab, setActiveTab] = useState<'filters' | 'sensors' | 'location' | 'audio'>('filters');
  const [soundOn, setSoundOn] = useState<boolean>(isSoundEnabled());
  const [customLat, setCustomLat] = useState<string>(String(currentLocation.latitude));
  const [customLon, setCustomLon] = useState<string>(String(currentLocation.longitude));
  const [showCustomCoords, setShowCustomCoords] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleToggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    if (next) playClickSound();
  };

  const handleApplyCustomCoords = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(customLat);
    const lon = parseFloat(customLon);
    if (!isNaN(lat) && !isNaN(lon)) {
      onSelectCity({
        latitude: Math.max(-90, Math.min(90, lat)),
        longitude: Math.max(-180, Math.min(180, lon)),
        cityName: `Coordenadas (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`,
      });
      playClickSound();
      setShowCustomCoords(false);
    }
  };

  return (
    <div
      id="settings-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in"
    >
      <div
        id="settings-modal-content"
        className={`w-full max-w-lg max-h-[90vh] flex flex-col rounded-3xl bg-[#08080a] border shadow-2xl overflow-hidden animate-slide-up ${
          isNightVision
            ? 'border-red-900/60 shadow-[0_0_30px_rgba(239,68,68,0.2)] night-vision-filter'
            : 'border-zinc-800 shadow-[0_0_50px_rgba(0,0,0,0.8)]'
        }`}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between bg-[#050505]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg overflow-hidden border border-cyan-500/40 bg-black shrink-0">
              <img
                src={astroVisionLogo}
                alt="AstroVision"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h2 className="text-xs font-bold text-zinc-100 uppercase tracking-tight">
                Painel de Configurações & Sensores
              </h2>
              <p className="text-[10px] text-zinc-400 font-mono">AstroVision v2.5</p>
            </div>
          </div>

          <button
            id="btn-close-settings"
            onClick={() => {
              playClickSound();
              onClose();
            }}
            className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-4 py-2 border-b border-zinc-800 bg-[#060608] flex items-center gap-1.5 overflow-x-auto text-[11px] font-mono">
          <button
            onClick={() => {
              playClickSound();
              setActiveTab('filters');
            }}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'filters'
                ? 'bg-cyan-600 text-white font-bold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>FILTROS DO CÉU</span>
          </button>

          <button
            onClick={() => {
              playClickSound();
              setActiveTab('sensors');
            }}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'sensors'
                ? 'bg-cyan-600 text-white font-bold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>SENSORES & GIROSCÓPIO</span>
          </button>

          <button
            onClick={() => {
              playClickSound();
              setActiveTab('location');
            }}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'location'
                ? 'bg-cyan-600 text-white font-bold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>LOCALIZAÇÃO</span>
          </button>

          <button
            onClick={() => {
              playClickSound();
              setActiveTab('audio');
            }}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'audio'
                ? 'bg-cyan-600 text-white font-bold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>VISUAL & SOM</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs text-zinc-300">
          {/* TAB 1: FILTROS DO CÉU */}
          {activeTab === 'filters' && (
            <div className="space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-zinc-100 text-sm">Filtros de Camadas Celestes</h3>
                  <p className="text-[11px] text-zinc-400">
                    Ative ou oculte elementos no mapa estelar e na câmera AR.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {/* 1. Constellations Lines */}
                <div className="p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-zinc-200">Constelações (Linhas)</div>
                    <div className="text-[10px] text-zinc-400">Desenhos geométricos no céu</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={skyFilters.showConstellationLines}
                    onChange={(e) => {
                      playClickSound();
                      onUpdateSkyFilters({ showConstellationLines: e.target.checked });
                    }}
                    className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                  />
                </div>

                {/* 2. Constellations Names */}
                <div className="p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-zinc-200">Nomes de Constelações</div>
                    <div className="text-[10px] text-zinc-400">Rótulos (Órion, Cruzeiro do Sul)</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={skyFilters.showConstellationNames}
                    onChange={(e) => {
                      playClickSound();
                      onUpdateSkyFilters({ showConstellationNames: e.target.checked });
                    }}
                    className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                  />
                </div>

                {/* 3. Star Systems */}
                <div className="p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-zinc-200">Sistemas de Estrelas</div>
                    <div className="text-[10px] text-zinc-400">Estrelas principais e catálogos</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={skyFilters.showStars}
                    onChange={(e) => {
                      playClickSound();
                      onUpdateSkyFilters({ showStars: e.target.checked });
                    }}
                    className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                  />
                </div>

                {/* 4. Star Names */}
                <div className="p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-zinc-200">Nomes das Estrelas</div>
                    <div className="text-[10px] text-zinc-400">Rótulos de Sirius, Canopus, etc.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={skyFilters.showStarNames}
                    onChange={(e) => {
                      playClickSound();
                      onUpdateSkyFilters({ showStarNames: e.target.checked });
                    }}
                    className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                  />
                </div>

                {/* 5. Planets & Solar System */}
                <div className="p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-zinc-200">Planetas & Sistema Solar</div>
                    <div className="text-[10px] text-zinc-400">Sol, Lua, Vênus, Marte, Júpiter</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={skyFilters.showPlanets}
                    onChange={(e) => {
                      playClickSound();
                      onUpdateSkyFilters({ showPlanets: e.target.checked });
                    }}
                    className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                  />
                </div>

                {/* 6. Satellites & ISS */}
                <div className="p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-zinc-200">Satélites & ISS</div>
                    <div className="text-[10px] text-zinc-400">Estação Espacial, Hubble, JWST</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={skyFilters.showSatellites}
                    onChange={(e) => {
                      playClickSound();
                      onUpdateSkyFilters({ showSatellites: e.target.checked });
                    }}
                    className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                  />
                </div>

                {/* 7. Motion Trails */}
                <div className="p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-zinc-200">Trajetória Diurna 24h</div>
                    <div className="text-[10px] text-zinc-400">Linha de movimento do astro</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={skyFilters.showMotionTrails}
                    onChange={(e) => {
                      playClickSound();
                      onUpdateSkyFilters({ showMotionTrails: e.target.checked });
                    }}
                    className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                  />
                </div>

                {/* 8. Ecliptic & Grid */}
                <div className="p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-zinc-200">Eclíptica & Grade Celestial</div>
                    <div className="text-[10px] text-zinc-400">Plano do sistema solar e azimute</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={skyFilters.showEcliptic && skyFilters.showGrid}
                    onChange={(e) => {
                      playClickSound();
                      onUpdateSkyFilters({
                        showEcliptic: e.target.checked,
                        showGrid: e.target.checked,
                      });
                    }}
                    className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SENSORES, GIROSCÓPIO & CALIBRAÇÃO */}
          {activeTab === 'sensors' && (
            <div className="space-y-3.5 animate-fade-in">
              {/* Real-time Sensor Status Card */}
              <div className="p-3.5 rounded-2xl bg-zinc-900/70 border border-cyan-500/40 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
                    <span className="font-mono font-bold text-zinc-100 uppercase text-xs">
                      Status dos Sensores em Tempo Real
                    </span>
                  </div>
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-700">
                    ATIVO (360°)
                  </span>
                </div>

                {orientation && (
                  <div className="grid grid-cols-3 gap-2 text-center font-mono text-xs pt-1">
                    <div className="p-2 rounded-xl bg-black/60 border border-zinc-800">
                      <div className="text-zinc-500 text-[10px]">AZIMUTE (BÚSSOLA)</div>
                      <div className="text-cyan-400 font-bold text-sm">{Math.round(orientation.heading)}°</div>
                    </div>
                    <div className="p-2 rounded-xl bg-black/60 border border-zinc-800">
                      <div className="text-zinc-500 text-[10px]">ELEVAÇÃO (PITCH)</div>
                      <div className="text-cyan-400 font-bold text-sm">{Math.round(orientation.pitch)}°</div>
                    </div>
                    <div className="p-2 rounded-xl bg-black/60 border border-zinc-800">
                      <div className="text-zinc-500 text-[10px]">INCLINAÇÃO (ROLL)</div>
                      <div className="text-zinc-200 font-bold text-sm">{Math.round(orientation.roll)}°</div>
                    </div>
                  </div>
                )}
              </div>

              {/* iOS Safari Permission Button */}
              {needsIosPermission && onRequestIosPermission && (
                <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/60 space-y-2">
                  <div className="font-bold text-amber-200 uppercase font-mono text-xs">
                    Dispositivo iOS / Safari Detectado
                  </div>
                  <p className="text-amber-300/80 text-[11px]">
                    No iPhone / iPad, a Apple exige autorização explícita para ler o giroscópio.
                  </p>
                  <button
                    onClick={onRequestIosPermission}
                    className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition cursor-pointer shadow-md"
                  >
                    Autorizar Sensores de Movimento
                  </button>
                </div>
              )}

              {/* Step 1: Calibrate in Figure 8 */}
              <div className="p-3.5 rounded-2xl bg-zinc-900/50 border border-zinc-800 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-800 text-cyan-400 shrink-0">
                  <Compass className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-zinc-100 font-mono uppercase text-xs mb-1">
                    Como Calibrar a Bússola
                  </h4>
                  <p className="text-zinc-400 text-[11px] leading-relaxed">
                    Movimente o celular no ar fazendo o desenho de um <strong>oito infinito (∞)</strong> por 3 a 5 segundos para calibrar o magnetômetro e eliminar interferências magnéticas.
                  </p>
                </div>
              </div>

              {/* Step 2: Recenter & Reset */}
              <div className="p-3.5 rounded-2xl bg-zinc-900/50 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-zinc-200">Recalibrar Alinhamento do Norte</div>
                  <div className="text-[11px] text-zinc-400">Restaura a leitura direta dos sensores físicos</div>
                </div>
                <button
                  onClick={() => {
                    playClickSound();
                    onResetOrientation();
                  }}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-cyan-400 border border-zinc-700 rounded-xl text-xs font-mono font-bold uppercase transition cursor-pointer"
                >
                  RECALIBRAR
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: LOCALIZAÇÃO */}
          {activeTab === 'location' && (
            <div className="space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-zinc-100 text-sm">Local de Observação</h3>
                  <p className="text-[11px] text-zinc-400">Usado para calcular a hora sideral e o céu exato.</p>
                </div>
                <button
                  id="btn-request-gps-settings"
                  onClick={() => {
                    playClickSound();
                    onRequestGps();
                  }}
                  className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition text-[10px] font-mono font-bold uppercase cursor-pointer"
                >
                  <Navigation className="w-3 h-3" />
                  <span>USAR GPS</span>
                </button>
              </div>

              <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-cyan-500/40">
                <div className="text-[9px] text-cyan-400 font-mono tracking-wider font-bold">LOCAL ATUAL DEFINIDO</div>
                <div className="font-bold text-zinc-100 text-sm">{currentLocation.cityName || 'Coordenadas Personalizadas'}</div>
                <div className="text-[11px] text-zinc-400 font-mono">
                  Lat: {currentLocation.latitude.toFixed(4)}° &bull; Lon: {currentLocation.longitude.toFixed(4)}°
                </div>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {PRESET_CITIES.map((city, idx) => {
                  const isSelected =
                    Math.abs(currentLocation.latitude - city.latitude) < 0.01 &&
                    Math.abs(currentLocation.longitude - city.longitude) < 0.01;

                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        playClickSound();
                        onSelectCity(city);
                      }}
                      className={`w-full p-2.5 rounded-xl border flex items-center justify-between transition text-left cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-950/60 border-cyan-500/80 text-cyan-300 font-medium'
                          : 'bg-zinc-900/40 border-zinc-800 text-zinc-300 hover:bg-zinc-800/60 hover:text-zinc-100'
                      }`}
                    >
                      <span>{city.cityName}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                    </button>
                  );
                })}
              </div>

              {/* Custom Coordinates Toggle */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowCustomCoords(!showCustomCoords)}
                  className="text-xs text-zinc-400 hover:text-zinc-200 underline cursor-pointer"
                >
                  {showCustomCoords ? 'Ocultar Coordenadas Manuais' : 'Inserir Latitude / Longitude Manualmente'}
                </button>

                {showCustomCoords && (
                  <form onSubmit={handleApplyCustomCoords} className="mt-2.5 p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-zinc-400 font-mono block mb-1">Latitude (-90 a 90)</label>
                        <input
                          type="number"
                          step="0.0001"
                          value={customLat}
                          onChange={(e) => setCustomLat(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-[#050505] border border-zinc-800 rounded-lg text-xs text-zinc-100 font-mono focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-400 font-mono block mb-1">Longitude (-180 a 180)</label>
                        <input
                          type="number"
                          step="0.0001"
                          value={customLon}
                          onChange={(e) => setCustomLon(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-[#050505] border border-zinc-800 rounded-lg text-xs text-zinc-100 font-mono focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition cursor-pointer"
                    >
                      Aplicar Coordenadas
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: VISUAL & SOM */}
          {activeTab === 'audio' && (
            <div className="space-y-3 animate-fade-in">
              <h3 className="text-[10px] font-mono uppercase text-zinc-500 tracking-wider">
                PREFERÊNCIAS VISUAIS E ÁUDIO
              </h3>

              {/* Night vision toggle */}
              <div className="p-3.5 rounded-2xl bg-zinc-900/50 border border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-red-950/80 border border-red-800/60 text-red-400">
                    <Eye className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-zinc-200">Modo Luz Vermelha (Night Vision)</div>
                    <div className="text-[11px] text-zinc-400">Preserva a adaptação dos olhos ao escuro real.</div>
                  </div>
                </div>
                <button
                  id="btn-toggle-night-vision-settings"
                  onClick={() => {
                    playClickSound();
                    onToggleNightVision();
                  }}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                    isNightVision ? 'bg-red-600' : 'bg-zinc-700'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                      isNightVision ? 'left-6' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              {/* Sound FX Toggle */}
              <div className="p-3.5 rounded-2xl bg-zinc-900/50 border border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
                    {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="font-semibold text-zinc-200">Efeitos Sonoros Sci-Fi</div>
                    <div className="text-[11px] text-zinc-400">Bips de mira e radar sintetizados via Web Audio.</div>
                  </div>
                </div>
                <button
                  id="btn-toggle-sound-settings"
                  onClick={handleToggleSound}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                    soundOn ? 'bg-cyan-600' : 'bg-zinc-700'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                      soundOn ? 'left-6' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-zinc-800 bg-[#050505] flex items-center justify-end">
          <button
            id="btn-settings-close-bottom"
            onClick={() => {
              playClickSound();
              onClose();
            }}
            className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition cursor-pointer shadow-md"
          >
            CONCLUIR
          </button>
        </div>
      </div>
    </div>
  );
};
