import { jsonError, jsonOk } from "@/lib/api";
import { getFeedItems } from "@/lib/satellite-service";

export async function GET(request: Request) {
  const offset = Number(new URL(request.url).searchParams.get("offset") || 0);
  try {
    const items = await getFeedItems(offset, 12);
    return jsonOk({ items, offset });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Feed failed", 500);
  }
}
