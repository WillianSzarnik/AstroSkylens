import React, { useState, useEffect, useRef } from 'react';
import { Camera, Compass, MapPin, Sparkles, CheckCircle2, ChevronRight, Play, Eye } from 'lucide-react';
import { playClickSound, playLockOnSound } from '../utils/audioEffects';
import astroVisionLogo from '../assets/images/astrovision_logo_1786672605652.jpg';

interface SplashScreenProps {
  onComplete: () => void;
  onRequestPermissions: () => Promise<void> | void;
}

const BOOT_STEPS = [
  'Inicializando motor astronômico & efemérides...',
  'Carregando catálogo estelar Hipparcos & Messier...',
  'Calculando órbitas e trajetórias da ISS...',
  'Sincronizando relógio sideral e fase lunar...',
  'Pronto para calibração de sensores...',
];

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onComplete,
  onRequestPermissions,
}) => {
  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [loadingDone, setLoadingDone] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [cameraGranted, setCameraGranted] = useState(false);
  const [sensorsGranted, setSensorsGranted] = useState(false);
  const [gpsGranted, setGpsGranted] = useState(false);

  // Progressive loading animation
  useEffect(() => {
    const duration = 2000;
    const intervalTime = 30;
    const stepIncrement = 100 / (duration / intervalTime);

    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev + stepIncrement;
        if (next >= 100) {
          clearInterval(timer);
          setLoadingDone(true);
          return 100;
        }
        const currentStep = Math.min(
          BOOT_STEPS.length - 1,
          Math.floor((next / 100) * BOOT_STEPS.length)
        );
        setStepIndex(currentStep);
        return next;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, []);

  // Handle Authorize button click (User gesture required for iOS DeviceOrientation & getUserMedia)
  const handleAuthorizeAndEnter = async () => {
    playLockOnSound();
    setIsAuthorizing(true);

    try {
      if (onRequestPermissions) {
        await onRequestPermissions();
      }
      setCameraGranted(true);
      setSensorsGranted(true);
      setGpsGranted(true);
    } catch (err) {
      console.warn('Permissions request handled:', err);
    }

    setTimeout(() => {
      onComplete();
    }, 600);
  };

  return (
    <div
      id="astrovision-splash-screen"
      className="fixed inset-0 z-[99999] bg-[#040407] text-white flex flex-col items-center justify-between p-6 overflow-y-auto select-none backdrop-blur-3xl animate-fade-in"
    >
      {/* Background Starry Nebula Backdrop */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-60">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-cyan-600/20 blur-[100px]" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-purple-600/20 blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-indigo-500/10 blur-[90px]" />
      </div>

      {/* Top spacing */}
      <div className="w-full flex justify-end relative z-10">
        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
          AstroVision v2.5
        </span>
      </div>

      {/* Center Branding & Logo Emblem */}
      <div className="flex flex-col items-center max-w-sm w-full relative z-10 text-center my-auto">
        {/* AstroVision Visual Logo */}
        <div className="relative w-52 h-52 sm:w-60 sm:h-60 mb-3 group flex items-center justify-center">
          {/* Outer glowing backlight aura */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-cyan-500/40 via-indigo-500/40 to-fuchsia-500/40 blur-xl animate-pulse" />

          {/* Logo container */}
          <div className="relative w-full h-full rounded-3xl overflow-hidden border border-cyan-500/30 shadow-[0_0_35px_rgba(6,182,212,0.35)] bg-[#05050d]">
            <img
              src={astroVisionLogo}
              alt="AstroVision Logo"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover rounded-3xl"
            />
          </div>
        </div>

        {/* Brand Typography */}
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white flex items-center justify-center gap-1.5 font-sans">
          <span>Astro</span>
          <span className="bg-gradient-to-r from-cyan-400 via-indigo-300 to-fuchsia-400 bg-clip-text text-transparent">
            Vision
          </span>
          <Sparkles className="w-5 h-5 text-cyan-400 -mt-2 animate-bounce" />
        </h1>

        <p className="text-xs text-zinc-400 tracking-widest font-mono uppercase mt-1">
          Descubra o Céu. Conheça o Universo.
        </p>

        {/* Phase 1: Loading Progress Bar */}
        {!loadingDone ? (
          <div className="w-full mt-8 space-y-3">
            <div className="w-full bg-zinc-900/80 border border-zinc-800 rounded-full h-2.5 overflow-hidden p-0.5 shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-fuchsia-500 rounded-full transition-all duration-75 shadow-[0_0_12px_rgba(6,182,212,0.6)]"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
              <span className="truncate max-w-[240px] text-left text-cyan-300">
                {BOOT_STEPS[stepIndex]}
              </span>
              <span className="font-bold text-white shrink-0">{Math.round(progress)}%</span>
            </div>
          </div>
        ) : (
          /* Phase 2: Permissions Gate */
          <div className="w-full mt-6 space-y-4 animate-fade-in">
            <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 text-left space-y-2.5 shadow-xl">
              <div className="text-xs font-bold text-zinc-200 flex items-center gap-1.5 uppercase font-mono">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Permissões Necessárias</span>
              </div>

              <div className="space-y-2 text-xs">
                {/* 1. Camera */}
                <div className="flex items-center gap-2.5 text-zinc-300">
                  <div className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-400 shrink-0">
                    <Camera className="w-3.5 h-3.5" />
                  </div>
                  <div className="leading-tight">
                    <strong className="text-white block">Câmera Realidade Aumentada (AR)</strong>
                    <span className="text-[10px] text-zinc-400">Para sobrepor constelações e planetas no céu real.</span>
                  </div>
                </div>

                {/* 2. Gyroscope & Motion */}
                <div className="flex items-center gap-2.5 text-zinc-300">
                  <div className="p-1.5 rounded-lg bg-indigo-950/80 border border-indigo-500/40 text-indigo-400 shrink-0">
                    <Compass className="w-3.5 h-3.5" />
                  </div>
                  <div className="leading-tight">
                    <strong className="text-white block">Giroscópio & Movimento 360°</strong>
                    <span className="text-[10px] text-zinc-400">Para apontar o celular em qualquer direção no espaço.</span>
                  </div>
                </div>

                {/* 3. GPS Location */}
                <div className="flex items-center gap-2.5 text-zinc-300">
                  <div className="p-1.5 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 shrink-0">
                    <MapPin className="w-3.5 h-3.5" />
                  </div>
                  <div className="leading-tight">
                    <strong className="text-white block">Localização & GPS</strong>
                    <span className="text-[10px] text-zinc-400">Para calcular a hora sideral e o céu exato da sua cidade.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Glowing Authorize Button */}
            <button
              id="btn-authorize-and-enter"
              onClick={handleAuthorizeAndEnter}
              disabled={isAuthorizing}
              className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-cyan-500 via-indigo-600 to-fuchsia-600 text-white font-bold text-sm tracking-wider uppercase transition-all shadow-[0_0_25px_rgba(6,182,212,0.5)] hover:shadow-[0_0_35px_rgba(6,182,212,0.8)] active:scale-98 cursor-pointer flex items-center justify-center gap-2"
            >
              {isAuthorizing ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin text-white" />
                  <span>Conectando Sensores...</span>
                </>
              ) : (
                <>
                  <span>Autorizar & Entrar no Céu</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>

            <button
              onClick={() => onComplete()}
              className="text-[11px] text-zinc-500 hover:text-zinc-300 underline font-mono transition cursor-pointer"
            >
              Continuar no modo demonstração / desktop
            </button>
          </div>
        )}
      </div>

      {/* Footer System Status */}
      <div className="w-full flex items-center justify-between text-[10px] font-mono text-zinc-600 relative z-10 pt-2 border-t border-zinc-900">
        <span>ASTROENGINE V2.5</span>
        <span className="text-cyan-500/80">ONLINE &bull; PRONTO</span>
      </div>
    </div>
  );
};
