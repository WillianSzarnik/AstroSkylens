import { ObserverCoords, SatelliteOrbitData, SatellitePassPrediction } from '../types/astronomy';

// Satellite Catalog with orbital parameters
export interface SatelliteDef {
  id: string;
  name: string;
  shortName: string;
  noradId: number;
  type: string;
  altitudeKm: number;
  speedKmH: number;
  periodMinutes: number;
  inclinationDeg: number;
  color: string;
  description: string;
  meanMotionRevDay: number;
  phaseOffsetDeg: number;
}

export const SATELLITES_LIST: SatelliteDef[] = [
  {
    id: 'iss',
    name: 'Estação Espacial Internacional (ISS)',
    shortName: 'ISS',
    noradId: 25544,
    type: 'Estação Espacial Habitada',
    altitudeKm: 420,
    speedKmH: 27600,
    periodMinutes: 92.68,
    inclinationDeg: 51.64,
    color: '#34d399',
    description: 'Maior laboratório orbital tripulado da história, visível a olho nu como estrela muito brilhante.',
    meanMotionRevDay: 15.54,
    phaseOffsetDeg: 45,
  },
  {
    id: 'tiangong',
    name: 'Estação Espacial Tiangong (CSS)',
    shortName: 'Tiangong',
    noradId: 48274,
    type: 'Estação Espacial Habitada',
    altitudeKm: 390,
    speedKmH: 27700,
    periodMinutes: 92.2,
    inclinationDeg: 41.47,
    color: '#f59e0b',
    description: 'Estação orbital modular chinesa composta pelos módulos Tianhe, Wentian e Mengtian.',
    meanMotionRevDay: 15.62,
    phaseOffsetDeg: 120,
  },
  {
    id: 'hst',
    name: 'Telescópio Espacial Hubble (HST)',
    shortName: 'Hubble',
    noradId: 20580,
    type: 'Observatório Espacial',
    altitudeKm: 535,
    speedKmH: 27300,
    periodMinutes: 95.4,
    inclinationDeg: 28.47,
    color: '#38bdf8',
    description: 'O pioneiro telescópio óptico e ultravioleta da NASA/ESA operando desde 1990.',
    meanMotionRevDay: 15.09,
    phaseOffsetDeg: 210,
  },
  {
    id: 'starlink',
    name: 'Starlink Constellation (Líder)',
    shortName: 'Starlink',
    noradId: 44713,
    type: 'Megaconstelação de Comunicação',
    altitudeKm: 550,
    speedKmH: 27200,
    periodMinutes: 95.6,
    inclinationDeg: 53.05,
    color: '#a855f7',
    description: 'Satélite de internet de baixa órbita (LEO) da SpaceX com painel solar reflexivo.',
    meanMotionRevDay: 15.06,
    phaseOffsetDeg: 290,
  },
  {
    id: 'goes16',
    name: 'Satélite Meteorológico GOES-16',
    shortName: 'GOES-16',
    noradId: 41866,
    type: 'Geoestacionário Meteorológico',
    altitudeKm: 35786,
    speedKmH: 11070,
    periodMinutes: 1436.0,
    inclinationDeg: 0.1,
    color: '#ec4899',
    description: 'Satélite da NOAA cobrindo todo o continente Americano e o Brasil para previsão climática.',
    meanMotionRevDay: 1.0,
    phaseOffsetDeg: 0,
  },
];

/**
 * Calculates current ground position (Lat, Lon) for a satellite at a specific timestamp
 */
export function getSatellitePosition(
  sat: SatelliteDef,
  date: Date = new Date()
): { lat: number; lon: number } {
  // Epoch reference
  const timeMs = date.getTime();
  const minutesSinceEpoch = timeMs / 60000;

  if (sat.id === 'goes16') {
    // Geostationary over -75.2° W
    return { lat: 0.1 * Math.sin(minutesSinceEpoch * 0.001), lon: -75.2 };
  }

  // Orbital phase
  const revFraction = (minutesSinceEpoch / sat.periodMinutes) % 1;
  const orbitalAngle = revFraction * 2 * Math.PI + (sat.phaseOffsetDeg * Math.PI) / 180;

  // Latitude oscillates between +inclination and -inclination
  const lat = sat.inclinationDeg * Math.sin(orbitalAngle);

  // Earth rotates eastward 360° every 1440 minutes (0.25° per min)
  const earthRotationDeg = (minutesSinceEpoch * 0.25) % 360;
  
  // Satellite orbital longitude component + nodal regression
  const orbitLonDeg = (Math.atan2(Math.sin(orbitalAngle) * Math.cos((sat.inclinationDeg * Math.PI) / 180), Math.cos(orbitalAngle)) * 180) / Math.PI;

  let lon = (orbitLonDeg - earthRotationDeg + 540) % 360 - 180;

  return { lat, lon };
}

/**
 * Generates ground track trajectory points for a satellite over +/- 90 minutes
 */
export function getSatelliteTrajectory(
  sat: SatelliteDef,
  baseDate: Date = new Date(),
  spanMinutes: number = 100,
  stepMinutes: number = 2
): [number, number][] {
  const points: [number, number][] = [];
  const startMs = baseDate.getTime() - (spanMinutes / 2) * 60000;

  for (let m = 0; m <= spanMinutes; m += stepMinutes) {
    const t = new Date(startMs + m * 60000);
    const pos = getSatellitePosition(sat, t);
    points.push([pos.lat, pos.lon]);
  }

  return points;
}

/**
 * Great-circle distance between two points on Earth in kilometers
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Predicts upcoming visible passes for satellites over a given observer location
 */
export function predictSatellitePasses(
  observer: ObserverCoords,
  sat: SatelliteDef,
  now: Date = new Date()
): SatellitePassPrediction[] {
  const predictions: SatellitePassPrediction[] = [];
  const maxSearchMinutes = 1440; // Next 24 hours
  const stepMin = 1.5;

  let inPass = false;
  let passStartTime: Date | null = null;
  let minDistanceKm = Infinity;
  let peakTime: Date | null = null;

  // Max horizon distance for LEO satellite (~1800 km)
  const visualHorizonKm = Math.sqrt(2 * 6371 * sat.altitudeKm + sat.altitudeKm * sat.altitudeKm);

  for (let m = 0; m < maxSearchMinutes; m += stepMin) {
    const testTime = new Date(now.getTime() + m * 60000);
    const pos = getSatellitePosition(sat, testTime);
    const dist = haversineDistanceKm(observer.latitude, observer.longitude, pos.lat, pos.lon);

    if (dist <= visualHorizonKm) {
      if (!inPass) {
        inPass = true;
        passStartTime = testTime;
        minDistanceKm = dist;
        peakTime = testTime;
      } else {
        if (dist < minDistanceKm) {
          minDistanceKm = dist;
          peakTime = testTime;
        }
      }
    } else {
      if (inPass && passStartTime && peakTime) {
        // Pass completed, calculate metrics
        const durationMinutes = Math.max(3, Math.round((testTime.getTime() - passStartTime.getTime()) / 60000));
        
        // Approximate elevation angle from distance
        const elevRad = Math.atan2(sat.altitudeKm, minDistanceKm);
        const maxAltitude = Math.min(90, Math.max(10, Math.round((elevRad * 180) / Math.PI)));

        const minutesUntilPass = Math.round((passStartTime.getTime() - now.getTime()) / 60000);

        // Direction of pass
        const startPos = getSatellitePosition(sat, passStartTime);
        const dLon = startPos.lon - observer.longitude;
        const direction = dLon < 0 ? 'SO -> NE' : 'NO -> SE';

        predictions.push({
          satelliteId: sat.id,
          satelliteName: sat.name,
          cityName: observer.cityName || 'Local Atual',
          startTime: passStartTime,
          maxAltitude,
          durationMinutes,
          magnitude: sat.id === 'iss' ? -3.2 : sat.id === 'tiangong' ? -1.8 : 1.2,
          direction,
          isFlyoverImminent: minutesUntilPass <= 15 && minutesUntilPass >= 0,
          minutesUntilPass,
        });

        inPass = false;
        passStartTime = null;
        minDistanceKm = Infinity;

        if (predictions.length >= 4) break;
      }
    }
  }

  return predictions;
}

/**
 * Gets complete live satellite data for all satellites
 */
export function getAllSatellitesOrbitData(
  now: Date = new Date()
): SatelliteOrbitData[] {
  return SATELLITES_LIST.map((sat) => {
    const pos = getSatellitePosition(sat, now);
    const trajectory = getSatelliteTrajectory(sat, now, 120, 2);
    const footprintRadiusKm = Math.round(
      Math.sqrt(2 * 6371 * sat.altitudeKm + sat.altitudeKm * sat.altitudeKm)
    );

    return {
      id: sat.id,
      name: sat.name,
      noradId: sat.noradId,
      type: sat.type,
      altitudeKm: sat.altitudeKm,
      speedKmH: sat.speedKmH,
      periodMinutes: sat.periodMinutes,
      inclinationDeg: sat.inclinationDeg,
      color: sat.color,
      description: sat.description,
      currentLat: pos.lat,
      currentLon: pos.lon,
      footprintRadiusKm,
      trajectory,
    };
  });
}
