import { SEED_SATELLITES } from "@/lib/seed-catalog";
import { FALLBACK_TLE } from "@/lib/fallback-tle";
import { fetchLiveTle, parseTleRecords } from "@/lib/tle";
import { propagateFromTle, categorizeByName, predictPasses } from "@/lib/satellite-math";
import { GET as geocode } from "@/app/api/geocode/route";

let orbitRequest;
let expires = 0;
let feedOffset = 0;
const byId = new Map(SEED_SATELLITES.map(sat => [sat.noradId, sat]));
function orbitData(force) {
  if (!orbitRequest || force || Date.now() >= expires) {
    expires = Date.now() + 15 * 60_000;
    orbitRequest = fetchLiveTle().then(({raw, source}) => ({records: parseTleRecords(raw), source, live:true}))
      .catch(() => {
        expires = Date.now() + 60_000;
        return {records:parseTleRecords(FALLBACK_TLE), source:"Embedded demonstration orbits", live:false};
      });
  }
  return orbitRequest;
}
function recent(record) {
  const token = record.tle1.slice(18,32);
  const yy = Number(token.slice(0,2));
  const epoch = Date.UTC(yy < 57 ? 2000+yy : 1900+yy,0,1) + (Number(token.slice(2))-1)*86400000;
  return Math.abs(Date.now()-epoch) < 7*86400000;
}
export async function appFetch(path, options = {}) {
  const url = new URL(path, location.origin);
  const query = url.searchParams;
  if (url.pathname === "/api/geocode") return geocode(new Request(url));
  if (url.pathname.startsWith("/api/feed")) {
    if (options.method === "POST") feedOffset = (feedOffset + 5) % SEED_SATELLITES.length;
    const items = Array.from({length:Math.min(12, SEED_SATELLITES.length)}, (_,i) => {
      const sat = SEED_SATELLITES[(feedOffset+i)%SEED_SATELLITES.length];
      return {id:sat.slug, title:sat.name, summary:sat.shortDescription, agency:sat.agency,
        category:sat.category, missionType:sat.missionType, orbitType:sat.orbitType, satellite:{slug:sat.slug}};
    });
    return Response.json({items});
  }
  const {records, source, live} = await orbitData(query.has("refresh") || query.has("force"));
  if (url.pathname === "/api/passes") {
    const eligible = live ? records.filter(r => recent(r) && byId.has(r.norad)) : [];
    if (!eligible.length) return Response.json({error:"Fresh orbital records are unavailable. Try again later for observing predictions."},{status:503});
    const passes = eligible.flatMap(r => predictPasses(r.name, r.tle1, r.tle2, Number(query.get("lat")), Number(query.get("lng")), 24*Number(query.get("days") || 1))
      .map(pass => ({...pass, slug:byId.get(r.norad).slug, noradId:r.norad, category:categorizeByName(r.name)})));
    return Response.json({passes:passes.sort((a,b)=>a.start.localeCompare(b.start)).slice(0,72)});
  }
  if (url.pathname === "/api/tracker/positions") {
    const positions = [];
    const ordered = [...records].sort((a,b)=>Number(byId.has(b.norad))-Number(byId.has(a.norad)));
    for (const r of ordered) {
      const p = propagateFromTle(r.tle1,r.tle2);
      if (p) positions.push({...r, lat:p.lat, lon:p.lon, alt:p.altKm, velocity:p.velocityKmS, category:categorizeByName(r.name), slug:byId.get(r.norad)?.slug});
      if (positions.length >= Number(query.get("limit") || 200)) break;
    }
    return Response.json({positions, source, updated:new Date().toISOString()});
  }
  throw new Error("Unknown OrbytMax data request: "+url.pathname);
}
