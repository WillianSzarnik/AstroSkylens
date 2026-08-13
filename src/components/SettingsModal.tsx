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
} from 'lucide-react';
import { ObserverCoords } from '../types/astronomy';
import { PRESET_CITIES } from '../hooks/useDeviceSensors';
import { isSoundEnabled, setSoundEnabled, playClickSound } from '../utils/audioEffects';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLocation: ObserverCoords;
  onSelectCity: (city: ObserverCoords) => void;
  onRequestGps: () => void;
  isNightVision: boolean;
  onToggleNightVision: () => void;
  onResetOrientation: () => void;
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
}) => {
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
        className={`w-full max-w-md max-h-[85vh] flex flex-col rounded-3xl bg-[#08080a] border shadow-2xl overflow-hidden animate-slide-up ${
          isNightVision
            ? 'border-red-900/60 shadow-[0_0_30px_rgba(239,68,68,0.2)] night-vision-filter'
            : 'border-zinc-800 shadow-[0_0_50px_rgba(0,0,0,0.8)]'
        }`}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between bg-[#050505]">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-tight">Configurações & Localização</h2>
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-zinc-300">
          {/* Quick Toggles */}
          <div className="space-y-2">
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

          {/* Location Picker */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-mono uppercase text-zinc-500 tracking-wider">
                LOCAL DE OBSERVAÇÃO
              </h3>
              <button
                id="btn-request-gps-settings"
                onClick={() => {
                  playClickSound();
                  onRequestGps();
                }}
                className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition text-[10px] font-mono font-bold uppercase cursor-pointer"
              >
                <Navigation className="w-3 h-3" />
                <span>USAR GPS ATUAL</span>
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
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-zinc-800 bg-[#050505] flex items-center justify-between">
          <button
            id="btn-recenter-orientation"
            onClick={() => {
              playClickSound();
              onResetOrientation();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono transition cursor-pointer border border-zinc-700"
          >
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>RECALIBRAR BÚSSOLA</span>
          </button>
          <button
            id="btn-settings-close-bottom"
            onClick={() => {
              playClickSound();
              onClose();
            }}
            className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition cursor-pointer shadow-md"
          >
            CONCLUIR
          </button>
        </div>
      </div>
    </div>
  );
};
