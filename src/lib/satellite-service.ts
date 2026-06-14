import { prisma } from "@/lib/prisma";
import { FALLBACK_TLE } from "@/lib/fallback-tle";
import { SEED_SATELLITES, type SeedSatellite } from "@/lib/seed-catalog";
import { fetchLiveTle, parseTleRecords, selectMixedTle } from "@/lib/tle";
import { categorizeByName, predictPasses, propagateFromTle, type PassPrediction } from "@/lib/satellite-math";

const TLE_MEMORY_TTL_MS = 30 * 60 * 1000;
const PASS_CACHE_TTL_MS = 5 * 60 * 1000;
const HAS_POSTGRES = /^(postgresql|postgres):\/\//.test(process.env.DATABASE_URL ?? "");

type TleFeedResult = { tle: string; source: string; updated: string };
type PassCacheEntry = { expiresAt: number; passes: PassPrediction[] };

const serviceCache = globalThis as unknown as {
  __orbytMaxTleFeed?: { expiresAt: number; result: TleFeedResult };
  __orbytMaxTleFeedRequest?: Promise<TleFeedResult>;
  __orbytMaxTleRefresh?: Promise<void>;
  __orbytMaxPassCache?: Map<string, PassCacheEntry>;
  __orbytMaxPassRequests?: Map<string, Promise<PassPrediction[]>>;
};

function seedToSatellite(sat: SeedSatellite) {
  return {
    id: sat.slug,
    slug: sat.slug,
    name: sat.name,
    noradId: sat.noradId ?? null,
    agency: sat.agency,
    country: sat.country,
    category: sat.category,
    missionType: sat.missionType,
    description: sat.description,
    shortDescription: sat.shortDescription,
    launchDate: sat.launchDate,
    orbitType: sat.orbitType,
    status: "active",
    tleLine1: null,
    tleLine2: null,
    imageUrl: null,
    seoTitle: `${sat.name} - OrbytMax`,
    seoDescription: sat.shortDescription,
    altitude: sat.altitude ?? null,
    inclination: sat.inclination ?? null,
    factsJson: JSON.stringify(sat.facts),
    timelineJson: JSON.stringify(sat.timeline),
    relatedSlugs: sat.relatedSlugs?.join(",") ?? null,
    featured: sat.featured ?? false,
    feedPriority: sat.feedPriority ?? 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    model: sat.model
      ? {
          id: `${sat.slug}-model`,
          satelliteId: sat.slug,
          modelUrl: null,
          embedUid: sat.model.embedUid ?? null,
          fallbackType: sat.model.fallbackType,
          attribution: sat.model.attribution,
          sourceUrl: sat.model.sourceUrl ?? null,
          license: null,
          commercialUseAllowed: sat.model.commercialUseAllowed ?? false,
          modificationAllowed: sat.model.modificationAllowed ?? false,
          partsJson: null,
        }
      : null,
  };
}

function seedSatellites(category?: string) {
  const items = SEED_SATELLITES.filter((sat) => !category || category === "all" || sat.category === category);
  return items
    .sort((a, b) => Number(b.featured ?? false) - Number(a.featured ?? false) || (b.feedPriority ?? 0) - (a.feedPriority ?? 0))
    .map(seedToSatellite);
}

function seedFeedItems(offset = 0, limit = 12) {
  const items = SEED_SATELLITES.sort((a, b) => (b.feedPriority ?? 0) - (a.feedPriority ?? 0)).map((sat) => ({
    id: `seed-${sat.slug}`,
    satelliteId: sat.slug,
    title: sat.name,
    summary: sat.shortDescription,
    agency: sat.agency,
    missionType: sat.missionType,
    orbitType: sat.orbitType,
    category: sat.category,
    sortOrder: sat.feedPriority ?? 0,
    active: true,
    createdAt: new Date(),
    satellite: { slug: sat.slug },
  }));
  const rotated = [...items.slice(offset), ...items.slice(0, offset)];
  return rotated.slice(0, limit);
}

export async function getSatellitesList(category?: string, options: { preferEmbedded?: boolean } = {}) {
  if (options.preferEmbedded) return seedSatellites(category);
  const where = category && category !== "all" ? { category } : {};
  try {
    const satellites = await prisma.satellite.findMany({
      where,
      orderBy: [{ featured: "desc" }, { name: "asc" }],
      include: { model: true },
    });
    return satellites.length ? satellites : seedSatellites(category);
  } catch {
    return seedSatellites(category);
  }
}

export async function getSatelliteBySlug(slug: string, options: { preferEmbedded?: boolean } = {}) {
  const seed = SEED_SATELLITES.find((sat) => sat.slug === slug);
  if (options.preferEmbedded) return seed ? seedToSatellite(seed) : null;
  try {
    const satellite = await prisma.satellite.findUnique({
      where: { slug },
      include: { model: true },
    });
    if (satellite) return satellite;
  } catch {
    /* Public mission pages can still render from embedded catalog data. */
  }
  return seed ? seedToSatellite(seed) : null;
}

export async function searchSatellites(q: string) {
  const query = q.trim();
  if (!query) return [];
  try {
    const results = await prisma.satellite.findMany({
      where: {
        OR: [
          { name: { contains: query } },
          { slug: { contains: query.toLowerCase() } },
          { agency: { contains: query } },
          { noradId: { contains: query } },
        ],
      },
      take: 20,
      include: { model: true },
    });
    if (results.length) return results;
  } catch {
    /* Fall back to the embedded catalog below. */
  }
  const needle = query.toLowerCase();
  return seedSatellites().filter(
    (sat) =>
      sat.name.toLowerCase().includes(needle) ||
      sat.slug.includes(needle) ||
      sat.agency.toLowerCase().includes(needle) ||
      sat.noradId?.includes(needle)
  );
}

export async function getTleFeed(force = false) {
  const memory = serviceCache.__orbytMaxTleFeed;
  if (!force && memory && memory.expiresAt > Date.now()) return memory.result;
  if (!force && serviceCache.__orbytMaxTleFeedRequest) return serviceCache.__orbytMaxTleFeedRequest;

  const request = loadTleFeed(force).finally(() => {
    serviceCache.__orbytMaxTleFeedRequest = undefined;
  });
  if (!force) serviceCache.__orbytMaxTleFeedRequest = request;
  const result = await request;
  serviceCache.__orbytMaxTleFeed = { result, expiresAt: Date.now() + TLE_MEMORY_TTL_MS };
  return result;
}

async function loadTleFeed(force = false): Promise<TleFeedResult> {
  refreshTleFeedInBackground();
  return {
    tle: selectMixedTle(FALLBACK_TLE, 96, force),
    source: "embedded fallback (refreshing)",
    updated: new Date().toISOString(),
  };
}

function refreshTleFeedInBackground() {
  if (serviceCache.__orbytMaxTleRefresh) return serviceCache.__orbytMaxTleRefresh;
  serviceCache.__orbytMaxTleRefresh = (async () => {
    try {
      const live = await fetchLiveTle();
      const result = { tle: selectMixedTle(live.raw, 96), source: live.source, updated: new Date().toISOString() };
      serviceCache.__orbytMaxTleFeed = { result, expiresAt: Date.now() + TLE_MEMORY_TTL_MS };
      if (HAS_POSTGRES) {
        await prisma.tleCache.upsert({
          where: { id: "global" },
          create: { id: "global", source: live.source, rawTle: live.raw },
          update: { source: live.source, rawTle: live.raw, updatedAt: new Date() },
        });
      }
    } catch {
      /* Embedded TLEs keep public requests responsive while live data is unavailable. */
    } finally {
      serviceCache.__orbytMaxTleRefresh = undefined;
    }
  })();
  return serviceCache.__orbytMaxTleRefresh;
}

export async function getFeedItems(offset = 0, limit = 12) {
  let items;
  try {
    items = await prisma.feedItem.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "desc" }, { createdAt: "desc" }],
      include: { satellite: true },
    });
  } catch {
    return seedFeedItems(offset, limit);
  }
  if (!items.length) return seedFeedItems(offset, limit);
  const rotated = [...items.slice(offset), ...items.slice(0, offset)];
  return rotated.slice(0, limit);
}

export async function computePasses(lat: number, lng: number) {
  const key = `${lat.toFixed(2)}:${lng.toFixed(2)}`;
  const cache = (serviceCache.__orbytMaxPassCache ??= new Map());
  const requests = (serviceCache.__orbytMaxPassRequests ??= new Map());
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.passes;
  const pending = requests.get(key);
  if (pending) return pending;

  const request = computePassesUncached(lat, lng)
    .then((passes) => {
      cache.set(key, { passes, expiresAt: Date.now() + PASS_CACHE_TTL_MS });
      return passes;
    })
    .finally(() => requests.delete(key));
  requests.set(key, request);
  return request;
}

async function computePassesUncached(lat: number, lng: number) {
  const satellites = seedSatellites().filter((sat) => sat.noradId || sat.tleLine1);

  const tleFeed = await getTleFeed().catch(() => null);
  const tleByNorad = new Map(parseTleRecords(tleFeed?.tle ?? "").map((record) => [record.norad, record]));
  const passes: Awaited<ReturnType<typeof predictPasses>> = [];

  const priority = ["iss", "starlink", "isro", "nasa"];
  const sorted = [...satellites].sort((a, b) => {
    const ai = priority.indexOf(a.category);
    const bi = priority.indexOf(b.category);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  for (const sat of sorted) {
    let tle1: string | null = sat.tleLine1;
    let tle2: string | null = sat.tleLine2;
    if ((!tle1 || !tle2) && sat.noradId && tleFeed?.tle) {
      const record = tleByNorad.get(sat.noradId);
      tle1 = record?.tle1 ?? tle1;
      tle2 = record?.tle2 ?? tle2;
    }
    if (!tle1 || !tle2) continue;
    const satPasses = predictPasses(sat.name, tle1, tle2, lat, lng, 12);
    for (const p of satPasses) {
      passes.push({ ...p, slug: sat.slug, noradId: sat.noradId ?? undefined, category: sat.category });
    }
    if (passes.length >= 24) break;
  }

  passes.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  return passes.slice(0, 20);
}

export function serializeSatellite(sat: NonNullable<Awaited<ReturnType<typeof getSatelliteBySlug>>>) {
  let position = null;
  if (sat.tleLine1 && sat.tleLine2) {
    const pos = propagateFromTle(sat.tleLine1, sat.tleLine2);
    if (pos) {
      position = {
        ...pos,
        orbitType: sat.orbitType ?? getOrbitTypeLabel(pos.altKm),
      };
    }
  }
  return {
    ...sat,
    facts: sat.factsJson ? JSON.parse(sat.factsJson) : [],
    timeline: sat.timelineJson ? JSON.parse(sat.timelineJson) : [],
    relatedSlugs: sat.relatedSlugs?.split(",").filter(Boolean) ?? [],
    position,
  };
}

function getOrbitTypeLabel(altKm: number) {
  if (altKm < 2000) return "LEO";
  if (altKm < 35000) return "MEO";
  if (altKm < 36500) return "GEO";
  return "HEO";
}

export { categorizeByName };
