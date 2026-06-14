import { jsonError, jsonOk } from "@/lib/api";
import { getSatellitesList } from "@/lib/satellite-service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") ?? undefined;
    const satellites = await getSatellitesList(category, { preferEmbedded: searchParams.get("fast") === "1" });
    return jsonOk(
      { satellites, count: satellites.length },
      { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } }
    );
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed to load satellites", 500);
  }
}
