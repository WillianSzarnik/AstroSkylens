export type CelestialType = 
  | 'star' 
  | 'planet' 
  | 'moon' 
  | 'sun' 
  | 'constellation' 
  | 'galaxy' 
  | 'nebula' 
  | 'cluster' 
  | 'satellite';

export interface CelestialObject {
  id: string;
  name: string;
  brazilianName?: string;
  scientificName: string;
  type: CelestialType;
  ra: number; // Right Ascension in hours (0-24)
  dec: number; // Declination in degrees (-90 to +90)
  mag: number; // Apparent magnitude (lower = brighter)
  distance: string; // e.g. "8.6 anos-luz" or "1.52 UA"
  constellation: string;
  spectralType?: string;
  color?: string; // Hex or CSS color
  description: string;
  mythology?: string;
  facts: string[];
  tips?: string;
  // Calculated live values
  altitude?: number; // In degrees (-90 to +90)
  azimuth?: number; // In degrees (0 to 360)
  screenX?: number;
  screenY?: number;
  isVisible?: boolean;
}

export interface ConstellationData {
  id: string;
  name: string;
  latinName: string;
  brazilianName: string;
  lines: [number, number][]; // pairs of star indices in the constellation's star array or RA/Dec pairs
  centerRa: number;
  centerDec: number;
  description: string;
  mythology: string;
  season: 'Verão' | 'Outono' | 'Inverno' | 'Primavera' | 'Circumpolar Sul' | 'Circumpolar Norte';
  stars: CelestialObject[];
}

export interface MoonPhaseInfo {
  phaseName: string;
  illumination: number; // 0 to 1
  ageDays: number;
  phaseAngle: number;
  nextFullMoonDays: number;
  nextNewMoonDays: number;
  icon: string;
}

export interface ObserverCoords {
  latitude: number;
  longitude: number;
  altitudeMeters?: number;
  cityName?: string;
}

export interface DeviceOrientationState {
  heading: number; // Azimuth / Compass 0-360 deg (0 = North, 90 = East)
  pitch: number; // Altitude / Elevation -90 to +90 deg (0 = Horizon, 90 = Zenith)
  roll: number; // Tilt -180 to +180 deg
  isSupported: boolean;
  hasPermission: boolean;
  isCalibrated: boolean;
}

export interface SkyLensResult {
  name: string;
  scientificName: string;
  type: CelestialType;
  constellation: string;
  apparentMagnitude: string;
  distance: string;
  spectralClassOrComposition: string;
  shortSummary: string;
  mythologyAndHistory: string;
  astrophysicsFacts: string[];
  observationTips: string;
  curiosity: string;
  targetAzimuth?: number;
  targetAltitude?: number;
}

export interface NasaApodData {
  title: string;
  date: string;
  explanation: string;
  url: string;
  hdurl?: string;
  media_type: string;
  copyright?: string;
}

export type ViewMode = 'split' | 'camera_full' | 'sky_full' | 'lens_focus';

export interface MotionPathPoint {
  timeOffsetHours: number;
  timeLabel: string;
  altitude: number;
  azimuth: number;
  isVisible: boolean;
}

export interface DiurnalMotionTrack {
  objectId: string;
  objectName: string;
  color: string;
  points: MotionPathPoint[];
  riseAzimuth?: number;
  setAzimuth?: number;
  culminationAltitude?: number;
}
