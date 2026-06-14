import { jsonError, jsonOk } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getFeedItems } from "@/lib/satellite-service";
import { SEED_SATELLITES } from "@/lib/seed-catalog";

export async function POST() {
  try {
    const count = await prisma.feedItem.count({ where: { active: true } }).catch(() => SEED_SATELLITES.length);
    const offset = count > 0 ? Math.floor(Math.random() * count) : 0;
    const items = await getFeedItems(offset, 12);
    return jsonOk({ items, offset, refreshedAt: new Date().toISOString() });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Refresh failed", 500);
  }
}
