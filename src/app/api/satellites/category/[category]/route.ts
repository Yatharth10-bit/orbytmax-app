import { jsonError, jsonOk } from "@/lib/api";
import { getSatellitesList } from "@/lib/satellite-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ category: string }> }
) {
  const { category } = await params;
  try {
    const satellites = await getSatellitesList(category);
    return jsonOk({ satellites, category });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 500);
  }
}
