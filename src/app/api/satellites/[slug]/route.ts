import { jsonError, jsonOk } from "@/lib/api";
import { getSatelliteBySlug, serializeSatellite } from "@/lib/satellite-service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  try {
    const sat = await getSatelliteBySlug(slug, { preferEmbedded: new URL(request.url).searchParams.get("fast") === "1" });
    if (!sat) return jsonError("Satellite not found", 404);
    return jsonOk({ satellite: serializeSatellite(sat) });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed to load satellite", 500);
  }
}
