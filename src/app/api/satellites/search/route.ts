import { jsonError, jsonOk } from "@/lib/api";
import { searchSatellites } from "@/lib/satellite-service";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") || "";
  if (!q.trim()) return jsonError("Query required");
  try {
    const satellites = await searchSatellites(q);
    return jsonOk({ satellites });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Search failed", 500);
  }
}
