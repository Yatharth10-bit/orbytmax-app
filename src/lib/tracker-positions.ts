import { prisma } from "@/lib/prisma";
import { FALLBACK_TLE } from "@/lib/fallback-tle";
import { categorizeByName, propagateFromTle } from "@/lib/satellite-math";
import { fetchLiveTle, parseTleRecords, selectMixedTle } from "@/lib/tle";

export type TrackerPosition = {
  name: string;
  lat: number;
  lon: number;
  alt: number;
  category: string;
  tle1: string;
  tle2: string;
  norad: string;
  velocity: number;
};

type CachedPayload = {
  positions: TrackerPosition[];
  updated: string;
  source: string;
  at: number;
};

const POSITIONS_TTL_MS = 90_000;
const TLE_STALE_MS = 30 * 60 * 1000;
const PRIORITY = /ISS|ZARYA|STARLINK|HUBBLE|GPS|GOES|NOAA|IRNSS|NAVIC|CARTOSAT|INSAT/i;
const HAS_POSTGRES = /^(postgresql|postgres):\/\//.test(process.env.DATABASE_URL ?? "");

const globalCache = globalThis as unknown as {
  __orbytMaxTrackerCache?: CachedPayload | null;
  __orbytMaxTleRefresh?: Promise<void> | null;
};

function getMemCache(): CachedPayload | null {
  const c = globalCache.__orbytMaxTrackerCache;
  if (!c) return null;
  if (Date.now() - c.at > POSITIONS_TTL_MS) return null;
  return c;
}

function setMemCache(payload: Omit<CachedPayload, "at">) {
  globalCache.__orbytMaxTrackerCache = { ...payload, at: Date.now() };
}

async function readTleText(force = false): Promise<{ tle: string; source: string; updated: string }> {
  return {
    tle: selectMixedTle(FALLBACK_TLE, 32, force),
    source: "embedded fallback (refreshing)",
    updated: new Date().toISOString(),
  };
}

function sortRecords(records: ReturnType<typeof parseTleRecords>) {
  return [...records].sort((a, b) => {
    const ap = PRIORITY.test(a.name) ? 0 : 1;
    const bp = PRIORITY.test(b.name) ? 0 : 1;
    return ap - bp || a.name.localeCompare(b.name);
  });
}

function computePositions(tle: string, limit: number): TrackerPosition[] {
  const now = new Date();
  const records = sortRecords(parseTleRecords(tle));
  const positions: TrackerPosition[] = [];
  for (const rec of records) {
    const pos = propagateFromTle(rec.tle1, rec.tle2, now);
    if (!pos) continue;
    positions.push({
      name: rec.name,
      lat: pos.lat,
      lon: pos.lon,
      alt: pos.altKm,
      category: categorizeByName(rec.name),
      tle1: rec.tle1,
      tle2: rec.tle2,
      norad: rec.norad,
      velocity: pos.velocityKmS,
    });
    if (positions.length >= limit) break;
  }
  return positions;
}

export function refreshTleCacheInBackground() {
  if (globalCache.__orbytMaxTleRefresh) return globalCache.__orbytMaxTleRefresh;
  globalCache.__orbytMaxTleRefresh = (async () => {
    try {
      const live = await fetchLiveTle();
      const tle = selectMixedTle(live.raw, 200);
      const positions = computePositions(tle, 400);
      setMemCache({ positions, updated: new Date().toISOString(), source: `${live.source} (refreshed)` });
      if (HAS_POSTGRES) {
        await prisma.tleCache.upsert({
          where: { id: "global" },
          create: { id: "global", source: live.source, rawTle: live.raw },
          update: { source: live.source, rawTle: live.raw, updatedAt: new Date() },
        });
      }
    } catch {
      /* keep serving cache/fallback */
    } finally {
      globalCache.__orbytMaxTleRefresh = null;
    }
  })();
  return globalCache.__orbytMaxTleRefresh;
}

function scheduleRefreshIfStale() {
  if (!HAS_POSTGRES) {
    refreshTleCacheInBackground();
    return;
  }
  prisma.tleCache
    .findUnique({ where: { id: "global" } })
    .then((row) => {
      const stale = !row || Date.now() - row.updatedAt.getTime() > TLE_STALE_MS;
      if (stale) refreshTleCacheInBackground();
    })
    .catch(() => refreshTleCacheInBackground());
}

export async function getTrackerPositions(limit = 200, options: { force?: boolean } = {}) {
  const mem = options.force ? null : getMemCache();
  if (mem) {
    scheduleRefreshIfStale();
    return {
      positions: mem.positions.slice(0, limit),
      updated: mem.updated,
      source: mem.source,
      count: Math.min(mem.positions.length, limit),
      cached: true,
    };
  }

  const { tle, source, updated } = await readTleText(options.force);
  const positions = computePositions(tle, Math.max(limit, 250));
  setMemCache({ positions, updated, source: options.force ? `${source} (manual refresh)` : source });
  scheduleRefreshIfStale();

  return {
    positions: positions.slice(0, limit),
    updated,
    source: options.force ? `${source} (manual refresh)` : source,
    count: Math.min(positions.length, limit),
    cached: false,
  };
}
