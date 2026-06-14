import { jsonError, jsonOk } from "@/lib/api";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computePasses } from "@/lib/satellite-service";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  try {
    const [followed, favorites, alerts, location, recent] = await Promise.all([
      prisma.userFollowedSatellite.findMany({
        where: { userId },
        include: { satellite: true },
      }),
      prisma.userFavorite.findMany({
        where: { userId },
        include: { satellite: true },
      }),
      prisma.alertPreference.findMany({
        where: { userId },
        include: { satellite: true },
      }),
      prisma.userLocation.findUnique({ where: { userId } }),
      prisma.recentlyViewed.findMany({
        where: { userId },
        include: { satellite: true },
        orderBy: { viewedAt: "desc" },
        take: 8,
      }),
    ]);

    let nextPasses: unknown[] = [];
    if (location) {
      nextPasses = await computePasses(location.lat, location.lng);
    }

    const recommended = await prisma.satellite.findMany({
      where: { featured: true },
      take: 6,
    });

    return jsonOk({
      followed: followed.map((f) => f.satellite),
      favorites: favorites.map((f) => f.satellite),
      alerts,
      location,
      recentlyViewed: recent.map((r) => r.satellite),
      nextPasses: nextPasses.slice(0, 5),
      recommended,
    });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Dashboard failed", 500);
  }
}
