import { jsonError, jsonOk } from "@/lib/api";
import { getTrackerPositions, refreshTleCacheInBackground } from "@/lib/tracker-positions";

export async function GET(request: Request) {
  const limit = Math.min(Number(new URL(request.url).searchParams.get("limit") || 150), 500);
  const refresh = new URL(request.url).searchParams.get("refresh") === "1";

  try {
    if (refresh) {
      refreshTleCacheInBackground();
    }
    const result = await getTrackerPositions(limit);
    return jsonOk(result, {
      headers: {
        "Cache-Control": refresh ? "no-store" : "public, max-age=60, stale-while-revalidate=120",
      },
    });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Positions unavailable", 503);
  }
}
