const CELESTRAK_URLS = [
  "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle",
  "https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle",
];

const CACHE_TTL_MS = 30 * 60 * 1000;
const FETCH_TIMEOUT_MS = 1800;

export type TleRecord = {
  name: string;
  tle1: string;
  tle2: string;
  norad: string;
};

export function parseTleRecords(raw: string): TleRecord[] {
  const records: TleRecord[] = [];
  const seen = new Set<string>();
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length - 2; i++) {
    const name = lines[i].replace(/^0 /, "").trim();
    const tle1 = lines[i + 1];
    const tle2 = lines[i + 2];
    if (!tle1.startsWith("1 ") || !tle2.startsWith("2 ")) continue;
    const norad = tle2.substring(2, 7).trim() || tle1.substring(2, 7).trim();
    const key = norad || name.toUpperCase();
    if (!seen.has(key)) {
      seen.add(key);
      records.push({ name, tle1, tle2, norad });
    }
    i += 2;
  }
  return records;
}

function shuffle<T>(items: T[], seed: number): T[] {
  const out = items.slice();
  let x = Math.max(1, Math.floor(seed) % 2147483647);
  const next = () => {
    x = (x * 48271) % 2147483647;
    return x / 2147483647;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function selectMixedTle(raw: string, limit = 96, force = false): string {
  const records = parseTleRecords(raw);
  const seed = force ? Date.now() : Math.floor(Date.now() / CACHE_TTL_MS);
  return shuffle(records, seed)
    .slice(0, Math.min(records.length, limit))
    .flatMap((r) => [r.name, r.tle1, r.tle2])
    .join("\n");
}

export async function fetchLiveTle(): Promise<{ raw: string; source: string }> {
  const errors: string[] = [];
  for (const url of CELESTRAK_URLS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "OrbytMax-Satellite-Tracker/2.0" },
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const text = await res.text();
      if (text.includes("\n1 ") && text.includes("\n2 ")) {
        return { raw: text, source: url.includes("stations") ? "celestrak-stations" : "celestrak-active" };
      }
      errors.push(`${url}: invalid TLE`);
    } catch (e) {
      errors.push(`${url}: ${e instanceof Error ? e.message : "error"}`);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(errors.join("; "));
}

export function recordsToText(records: TleRecord[]): string {
  return `${records.flatMap((r) => [r.name, r.tle1, r.tle2]).join("\n")}\n`;
}
