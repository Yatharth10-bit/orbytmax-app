import * as satellite from "satellite.js";

export type GeodeticPosition = {
  lat: number;
  lon: number;
  altKm: number;
  velocityKmS: number;
};

export function propagateFromTle(
  tle1: string,
  tle2: string,
  date = new Date()
): GeodeticPosition | null {
  try {
    const satrec = satellite.twoline2satrec(tle1, tle2);
    const posVel = satellite.propagate(satrec, date);
    if (!posVel?.position || typeof posVel.position === "boolean") return null;
    const gmst = satellite.gstime(date);
    const geo = satellite.eciToGeodetic(posVel.position, gmst);
    const velocityKmS = posVel.velocity
      ? Math.sqrt(posVel.velocity.x ** 2 + posVel.velocity.y ** 2 + posVel.velocity.z ** 2)
      : 7.8;
    return {
      lat: satellite.degreesLat(geo.latitude),
      lon: satellite.degreesLong(geo.longitude),
      altKm: geo.height,
      velocityKmS,
    };
  } catch {
    return null;
  }
}

export function getOrbitTypeLabel(altKm: number): string {
  if (altKm < 2000) return "LEO";
  if (altKm < 35000) return "MEO";
  if (altKm < 36500) return "GEO";
  return "HEO";
}

export type PassPrediction = {
  name: string;
  slug?: string;
  noradId?: string;
  category: string;
  start: string;
  maxTime: string;
  end: string;
  maxElevation: number;
  durationSec: number;
  brightness: string;
  direction: string;
};

function observerGeodetic(lat: number, lon: number) {
  return {
    latitude: satellite.degreesToRadians(lat),
    longitude: satellite.degreesToRadians(lon),
    height: 0,
  };
}

function elevationDeg(
  satrec: ReturnType<typeof satellite.twoline2satrec>,
  date: Date,
  lat: number,
  lon: number
): number | null {
  const posVel = satellite.propagate(satrec, date);
  if (!posVel?.position || typeof posVel.position === "boolean") return null;
  const gmst = satellite.gstime(date);
  const positionEcf = satellite.eciToEcf(posVel.position, gmst);
  const look = satellite.ecfToLookAngles(observerGeodetic(lat, lon), positionEcf);
  return satellite.degreesLat(look.elevation);
}

export function predictPasses(
  name: string,
  tle1: string,
  tle2: string,
  lat: number,
  lon: number,
  hours = 24,
  minElevation = 10
): PassPrediction[] {
  const satrec = satellite.twoline2satrec(tle1, tle2);
  const passes: PassPrediction[] = [];
  const start = new Date();
  const end = new Date(start.getTime() + hours * 3600 * 1000);
  let cursor = new Date(start);
  let inPass = false;
  let passStart: Date | null = null;
  let maxEl = 0;
  let maxTime: Date | null = null;

  while (cursor <= end && passes.length < 12) {
    const el = elevationDeg(satrec, cursor, lat, lon) ?? -90;
    if (!inPass && el >= minElevation) {
      inPass = true;
      passStart = new Date(cursor);
      maxEl = el;
      maxTime = new Date(cursor);
    } else if (inPass) {
      if (el > maxEl) {
        maxEl = el;
        maxTime = new Date(cursor);
      }
      if (el < minElevation) {
        const passEnd = new Date(cursor);
        if (passStart && maxTime) {
          const durationSec = Math.round((passEnd.getTime() - passStart.getTime()) / 1000);
          passes.push({
            name,
            category: "tracked",
            start: passStart.toISOString(),
            maxTime: maxTime.toISOString(),
            end: passEnd.toISOString(),
            maxElevation: Math.round(maxEl),
            durationSec,
            brightness: maxEl >= 45 ? "Very bright" : maxEl >= 25 ? "Bright" : "Moderate",
            direction: maxEl >= 35 ? "High in sky" : "Low horizon",
          });
        }
        inPass = false;
        passStart = null;
        maxEl = 0;
        maxTime = null;
      }
    }
    cursor = new Date(cursor.getTime() + 30_000);
  }
  return passes;
}

export function categorizeByName(name: string): string {
  const n = name.toUpperCase();
  if (n.includes("ISS") || n.includes("ZARYA")) return "iss";
  if (n.includes("STARLINK")) return "starlink";
  if (n.includes("GPS") || n.includes("NAVSTAR")) return "navigation";
  if (n.includes("GOES") || n.includes("NOAA") || n.includes("METEOR")) return "weather";
  if (
    n.includes("CARTOSAT") ||
    n.includes("RISAT") ||
    n.includes("INSAT") ||
    n.includes("OCEANSAT") ||
    n.includes("RESOURCESAT") ||
    n.includes("IRNSS") ||
    n.includes("NAVIC") ||
    n.includes("CHANDRAYAAN") ||
    n.includes("GSAT")
  )
    return "isro";
  if (n.includes("LANDSAT") || n.includes("HUBBLE") || n.includes("TERRA")) return "nasa";
  return "scientific";
}
