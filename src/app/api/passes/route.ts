import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { computePasses } from "@/lib/satellite-service";

const schema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = schema.safeParse(params);
  if (!parsed.success) return jsonError("Invalid lat/lng");
  try {
    const passes = await computePasses(parsed.data.lat, parsed.data.lng);
    return jsonOk(
      { passes, location: { lat: parsed.data.lat, lng: parsed.data.lng } },
      { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" } }
    );
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Pass calculation failed", 500);
  }
}
