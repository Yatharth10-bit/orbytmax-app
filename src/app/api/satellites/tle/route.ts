import { jsonError } from "@/lib/api";
import { getTleFeed } from "@/lib/satellite-service";

export async function GET(request: Request) {
  const force = new URL(request.url).searchParams.get("refresh") === "1";
  try {
    const feed = await getTleFeed(force);
    return new Response(feed.tle, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-OrbytMax-Source": feed.source,
        "X-OrbytMax-Updated": feed.updated,
      },
    });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "TLE unavailable", 503);
  }
}
