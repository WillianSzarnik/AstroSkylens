import { useState, useEffect, useRef, useCallback } from 'react';
import { DeviceOrientationState, ObserverCoords } from '../types/astronomy';

export const PRESET_CITIES: ObserverCoords[] = [
  { cityName: 'São Paulo, Brasil', latitude: -23.5505, longitude: -46.6333 },
  { cityName: 'Rio de Janeiro, Brasil', latitude: -22.9068, longitude: -43.1729 },
  { cityName: 'Brasília, Brasil', latitude: -15.7975, longitude: -47.8919 },
  { cityName: 'Salvador, Brasil', latitude: -12.9777, longitude: -38.5016 },
  { cityName: 'Manaus, Brasil', latitude: -3.119, longitude: -60.0217 },
  { cityName: 'Porto Alegre, Brasil', latitude: -30.0346, longitude: -51.2177 },
  { cityName: 'Lisboa, Portugal', latitude: 38.7223, longitude: -9.1393 },
  { cityName: 'Nova York, EUA', latitude: 40.7128, longitude: -74.006 },
  { cityName: 'Tóquio, Japão', latitude: 35.6762, longitude: 139.6503 },
  { cityName: 'Sydney, Austrália', latitude: -33.8688, longitude: 151.2093 },
];

export function useDeviceSensors() {
  // 1. Orientation State
  const [orientation, setOrientation] = useState<DeviceOrientationState>({
    heading: 180, // Default pointing South
    pitch: 35, // 35 degrees above horizon
    roll: 0,
    isSupported: false,
    hasPermission: false,
    isCalibrated: true,
  });

  // Manual orientation offset / manual joystick override
  const [manualOffset, setManualOffset] = useState<{ heading: number; pitch: number }>({
    heading: 180,
    pitch: 35,
  });
  const [isManualControl, setIsManualControl] = useState(false);

  // 2. Observer Location
  const [location, setLocation] = useState<ObserverCoords>({
    latitude: -23.5505,
    longitude: -46.6333,
    cityName: 'São Paulo, Brasil (Padrão)',
  });
  const [locationStatus, setLocationStatus] = useState<'idle' | 'locating' | 'success' | 'error'>('idle');

  // 3. Camera State
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  // iOS orientation permission needed check
  const [needsIosPermission, setNeedsIosPermission] = useState(false);

  // Smoothing refs
  const currentHeadingRef = useRef(180);
  const currentPitchRef = useRef(35);

  // Request GPS
  const requestLocation = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setLocationStatus('error');
      return;
    }

    setLocationStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          altitudeMeters: pos.coords.altitude || undefined,
          cityName: `GPS (${pos.coords.latitude.toFixed(2)}°, ${pos.coords.longitude.toFixed(2)}°)`,
        });
        setLocationStatus('success');
      },
      (err) => {
        console.warn('Geolocation error:', err.message);
        setLocationStatus('error');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  // Set Manual City
  const setCity = useCallback((city: ObserverCoords) => {
    setLocation(city);
    setLocationStatus('success');
  }, []);

  // Request iOS Orientation Permission
  const requestOrientationPermission = useCallback(async () => {
    if (
      typeof window !== 'undefined' &&
      typeof (DeviceOrientationEvent as any).requestPermission === 'function'
    ) {
      try {
        const response = await (DeviceOrientationEvent as any).requestPermission();
        if (response === 'granted') {
          setOrientation((prev) => ({ ...prev, hasPermission: true, isSupported: true }));
          setNeedsIosPermission(false);
          setIsManualControl(false);
        } else {
          setNeedsIosPermission(false);
        }
      } catch (err) {
        console.warn('Orientation permission error:', err);
      }
    } else {
      setNeedsIosPermission(false);
      setIsManualControl(false);
    }
  }, []);

  // Setup Device Orientation Listener
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (
      typeof (DeviceOrientationEvent as any) !== 'undefined' &&
      typeof (DeviceOrientationEvent as any).requestPermission === 'function'
    ) {
      setNeedsIosPermission(true);
    }

    const handleOrientation = (e: DeviceOrientationEvent) => {
      // If manual override was active, real sensor input can still be received once reset
      if (isManualControl) return;

      let compassHeading: number | null = null;
      let pitch: number | null = null;
      let roll: number | null = null;

      // 1. iOS webkitCompassHeading (0 = North, clockwise 0..360)
      if ((e as any).webkitCompassHeading != null) {
        compassHeading = (e as any).webkitCompassHeading;
      } else if (e.alpha != null) {
        // Standard alpha (0 to 360) - on Android Chrome / desktop
        // (360 - alpha) converts from counter-clockwise to clockwise compass heading
        compassHeading = (360 - e.alpha) % 360;
      }

      // 2. Beta (-180 to 180): device pitch front-to-back
      // When phone is vertical facing horizon: beta ~ 90 deg -> altitude = 0
      // When phone is pointing up to zenith: beta ~ 0 deg -> altitude = 90
      // When phone is held flat on table screen up: beta ~ 0 deg
      if (e.beta != null) {
        const rawBeta = e.beta;
        pitch = 90 - rawBeta;
        if (pitch < -90) pitch = -90;
        if (pitch > 90) pitch = 90;
      }

      if (e.gamma != null) {
        roll = e.gamma;
      }

      if (compassHeading != null) {
        const targetHeading = ((compassHeading % 360) + 360) % 360;
        const targetPitch = pitch != null ? Math.max(-90, Math.min(90, pitch)) : currentPitchRef.current;

        // Smooth interpolation (lerp) with angle wraparound
        let diff = targetHeading - currentHeadingRef.current;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;

        currentHeadingRef.current = (currentHeadingRef.current + diff * 0.4 + 360) % 360;
        currentPitchRef.current = currentPitchRef.current + (targetPitch - currentPitchRef.current) * 0.4;

        setOrientation({
          heading: currentHeadingRef.current,
          pitch: currentPitchRef.current,
          roll: roll || 0,
          isSupported: true,
          hasPermission: true,
          isCalibrated: true,
        });
      }
    };

    window.addEventListener('deviceorientation', handleOrientation, true);
    if ('ondeviceorientationabsolute' in window) {
      window.addEventListener('deviceorientationabsolute' as any, handleOrientation, true);
    }

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
      if ('ondeviceorientationabsolute' in window) {
        window.removeEventListener('deviceorientationabsolute' as any, handleOrientation);
      }
    };
  }, [isManualControl]);

  // Initial GPS fetch
  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // Camera Management
  const startCamera = useCallback(async (facing: 'environment' | 'user' = cameraFacing) => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('A API de câmera não está disponível neste navegador. Abra o app em uma aba separada (HTTPS/Safari).');
      return;
    }

    try {
      setCameraError(null);
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }

      let stream: MediaStream | null = null;
      let lastError: any = null;

      // Strategy 1: iOS Safari friendly facingMode ideal
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
          },
          audio: false,
        });
      } catch (e1) {
        lastError = e1;
        console.warn('Strategy 1 failed:', e1);
      }

      // Strategy 2: Simple facingMode string
      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: facing,
            },
            audio: false,
          });
        } catch (e2) {
          lastError = e2;
          console.warn('Strategy 2 failed:', e2);
        }
      }

      // Strategy 3: Unconstrained video (universal fallback for iOS / legacy webviews)
      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        } catch (e3) {
          lastError = e3;
          console.warn('Strategy 3 failed:', e3);
        }
      }

      if (!stream) {
        throw lastError || new Error('Não foi possível obter o stream de vídeo.');
      }

      cameraStreamRef.current = stream;
      setCameraStream(stream);

      if (videoRef.current) {
        const vid = videoRef.current;
        vid.setAttribute('playsinline', 'true');
        vid.setAttribute('webkit-playsinline', 'true');
        vid.muted = true;
        vid.defaultMuted = true;
        vid.playsInline = true;
        vid.srcObject = stream;
        
        try {
          await vid.play();
        } catch (playErr) {
          console.warn('Video play() after stream assignment:', playErr);
        }
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const inIframe = window.self !== window.top;

      if (inIframe && isIos) {
        setCameraError(
          'O iOS Safari bloqueia a câmera dentro de iFrames. Toque no botão abaixo para abrir em uma Nova Aba.'
        );
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError(
          'Permissão negada no navegador. No iOS, vá em Ajustes > Safari > Câmera e permita o acesso.'
        );
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('Nenhum sensor de câmera encontrado no dispositivo.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setCameraError('A câmera está ocupada por outro aplicativo.');
      } else {
        setCameraError('Não foi possível iniciar a câmera. Abra o app diretamente no Safari em uma nova aba.');
      }
    }
  }, [cameraFacing]);

  // Stop Camera
  const stopCamera = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    setCameraStream(null);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Toggle Camera Facing
  const toggleCameraFacing = useCallback(() => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(nextFacing);
    startCamera(nextFacing);
  }, [cameraFacing, startCamera]);

  // Attach stream to videoRef whenever it mounts or changes
  const attachVideoElement = useCallback((element: HTMLVideoElement | null) => {
    videoRef.current = element;
    if (element && cameraStreamRef.current) {
      element.srcObject = cameraStreamRef.current;
      element.play().catch(() => {});
    }
  }, []);

  // Capture current frame from camera video
  const takeSnapshot = useCallback((): string | null => {
    if (!videoRef.current) return null;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return null;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(video.videoWidth, 800);
      canvas.height = (canvas.width * video.videoHeight) / video.videoWidth;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.85);
    } catch (err) {
      console.warn('Snapshot failed:', err);
      return null;
    }
  }, []);

  // Update manual orientation (for virtual pan/drag & joystick)
  const updateManualOrientation = useCallback((deltaHeading: number, deltaPitch: number) => {
    setIsManualControl(true);
    setManualOffset((prev) => {
      const newHeading = ((prev.heading + deltaHeading) % 360 + 360) % 360;
      const newPitch = Math.max(-90, Math.min(90, prev.pitch + deltaPitch));
      
      currentHeadingRef.current = newHeading;
      currentPitchRef.current = newPitch;
      
      setOrientation((o) => ({
        ...o,
        heading: newHeading,
        pitch: newPitch,
      }));
      
      return { heading: newHeading, pitch: newPitch };
    });
  }, []);

  const resetToSensors = useCallback(() => {
    setIsManualControl(false);
  }, []);

  return {
    orientation,
    location,
    locationStatus,
    cameraStream,
    cameraFacing,
    cameraError,
    needsIosPermission,
    isManualControl,
    videoRef,
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
  };
}
