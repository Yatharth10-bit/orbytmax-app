import * as satellite from "satellite.js";

export const EARTH_RADIUS_KM = 6371;
export const EARTH_RADIUS_3D = 1;
export const ALT_SCALE = EARTH_RADIUS_3D / EARTH_RADIUS_KM;

export type TrackerSatellite = {
  name: string;
  lat: number;
  lon: number;
  alt: number;
  category: string;
  tle1: string;
  tle2: string;
  norad: string;
  velocity?: number;
};

export type SatelliteGeo = {
  lat: number;
  lon: number;
  alt: number;
  vel: number;
};

export type SatelliteRuntime = TrackerSatellite & {
  satrec: satellite.SatRec;
  lastGeo?: SatelliteGeo;
};

const SPRITE_CATEGORY_MAP: Record<string, string> = {
  navigation: "gps",
  nasa: "science",
  scientific: "science",
};

export function spriteCategory(category: string) {
  return SPRITE_CATEGORY_MAP[category] || category;
}

export function categoryEmoji(category: string) {
  const cat = spriteCategory(category);
  const map: Record<string, string> = {
    iss: "🛸",
    starlink: "🛰️",
    gps: "📡",
    navigation: "📡",
    weather: "🌤️",
    gnss: "🗺️",
    science: "🔭",
    nasa: "🔭",
    scientific: "🔭",
    comm: "📺",
    isro: "🇮🇳",
    other: "⬡",
  };
  return map[cat] || "⬡";
}

export function categoryColorHex(category: string) {
  const cat = spriteCategory(category);
  const map: Record<string, string> = {
    iss: "#ffd700",
    starlink: "#00c8ff",
    gps: "#00ff9d",
    navigation: "#00ff9d",
    weather: "#ff8c42",
    gnss: "#9b59b6",
    science: "#ff6b6b",
    nasa: "#ff6b6b",
    scientific: "#ff6b6b",
    comm: "#4ecdc4",
    isro: "#ff9933",
    other: "#95a5a6",
  };
  return map[cat] || "#95a5a6";
}

export function categoryColorInt(category: string) {
  const hex = categoryColorHex(category).replace("#", "");
  return Number.parseInt(hex, 16);
}

export function orbitTypeLabel(altKm: number) {
  if (altKm < 2000) return "LEO";
  if (altKm < 35000) return "MEO";
  if (altKm < 36500) return "GEO";
  return "HEO";
}

export function geoTo3D(lat: number, lon: number, altKm: number) {
  const radius = EARTH_RADIUS_3D + altKm * ALT_SCALE;
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return {
    x: -radius * Math.sin(phi) * Math.cos(theta),
    y: radius * Math.cos(phi),
    z: radius * Math.sin(phi) * Math.sin(theta),
  };
}

export function propagateToGeodetic(satrec: satellite.SatRec, date = new Date()): SatelliteGeo | null {
  try {
    const posVel = satellite.propagate(satrec, date);
    if (!posVel?.position || typeof posVel.position === "boolean") return null;
    const gmst = satellite.gstime(date);
    const geo = satellite.eciToGeodetic(posVel.position, gmst);
    const vel = posVel.velocity
      ? Math.sqrt(posVel.velocity.x ** 2 + posVel.velocity.y ** 2 + posVel.velocity.z ** 2)
      : 7.8;
    return {
      lat: satellite.degreesLat(geo.latitude),
      lon: satellite.degreesLong(geo.longitude),
      alt: geo.height,
      vel,
    };
  } catch {
    return null;
  }
}

export function buildSatelliteRuntime(entry: TrackerSatellite): SatelliteRuntime | null {
  try {
    const satrec = satellite.twoline2satrec(entry.tle1, entry.tle2);
    return { ...entry, satrec };
  } catch {
    return null;
  }
}

export function makeSatelliteCanvas(category: string) {
  const size = 96;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const color = categoryColorHex(category);
  const half = size / 2;
  const gradient = ctx.createRadialGradient(half, half, 1, half, half, half);
  gradient.addColorStop(0, `${color}ff`);
  gradient.addColorStop(0.22, `${color}cc`);
  gradient.addColorStop(0.5, `${color}44`);
  gradient.addColorStop(0.78, `${color}11`);
  gradient.addColorStop(1, "transparent");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = "#c8e8ff";
  ctx.globalAlpha = 0.92;
  ctx.fillRect(half - 5, half - 7, 10, 14);

  ctx.fillStyle = color;
  ctx.globalAlpha = 1;
  ctx.fillRect(half - 24, half - 3, 14, 6);
  ctx.fillRect(half + 10, half - 3, 14, 6);

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(half, half - 10, 4, Math.PI, 0, false);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(half, half - 10);
  ctx.lineTo(half, half - 7);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(half, half, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.globalAlpha = 1;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(half, half, 2, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  return canvas;
}

export function sampleGroundTrack(
  satrec: satellite.SatRec,
  steps = 120
): Array<{ x: number; y: number }> {
  const now = Date.now();
  const periodMs = ((2 * Math.PI) / satrec.no) * 60 * 1000;
  const points: Array<{ x: number; y: number }> = [];
  for (let i = -60; i <= 60; i++) {
    const geo = propagateToGeodetic(satrec, new Date(now + i * (periodMs / steps)));
    if (!geo) continue;
    points.push({
      x: ((geo.lon + 180) / 360) * 280,
      y: ((90 - geo.lat) / 180) * 128,
    });
  }
  return points;
}

export function drawMiniMap(
  canvas: HTMLCanvasElement,
  satrec: satellite.SatRec,
  geo?: SatelliteGeo | null
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#020d1a";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(0,200,255,0.08)";
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= width; x += width / 6) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += height / 3) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  const track = sampleGroundTrack(satrec);
  if (track.length > 1) {
    ctx.strokeStyle = "rgba(0,255,157,0.6)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(track[0].x, track[0].y);
    for (let i = 1; i < track.length; i++) {
      if (Math.abs(track[i].x - track[i - 1].x) > width / 2) ctx.moveTo(track[i].x, track[i].y);
      else ctx.lineTo(track[i].x, track[i].y);
    }
    ctx.stroke();
  }

  const current = geo || propagateToGeodetic(satrec);
  if (!current) return;
  const cx = ((current.lon + 180) / 360) * width;
  const cy = ((90 - current.lat) / 180) * height;
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fillStyle = "#00ff9d";
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1;
  ctx.stroke();
}