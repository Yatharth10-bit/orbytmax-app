import { jsonError, jsonOk } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { SEED_SATELLITES } from "@/lib/seed-catalog";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ satelliteId: string }> }
) {
  const { satelliteId } = await params;
  try {
    const sat = await prisma.satellite.findFirst({
      where: { OR: [{ id: satelliteId }, { slug: satelliteId }] },
      include: { model: true },
    });
    if (!sat?.model) {
      const seed = SEED_SATELLITES.find((item) => item.slug === satelliteId);
      if (!seed?.model) return jsonError("Model not found", 404);
      return jsonOk({
        model: {
          ...seed.model,
          id: `${seed.slug}-model`,
          satelliteId: seed.slug,
          modelUrl: null,
          parts: null,
          satellite: { id: seed.slug, slug: seed.slug, name: seed.name },
        },
      });
    }
    return jsonOk({
      model: {
        ...sat.model,
        parts: sat.model.partsJson ? JSON.parse(sat.model.partsJson) : null,
        satellite: { id: sat.id, slug: sat.slug, name: sat.name },
      },
    });
  } catch {
    const sat = SEED_SATELLITES.find((item) => item.slug === satelliteId);
    if (!sat?.model) return jsonError("Model not found", 404);
    return jsonOk({
      model: {
        ...sat.model,
        id: `${sat.slug}-model`,
        satelliteId: sat.slug,
        modelUrl: null,
        parts: null,
        satellite: { id: sat.slug, slug: sat.slug, name: sat.name },
      },
    });
  }
}
