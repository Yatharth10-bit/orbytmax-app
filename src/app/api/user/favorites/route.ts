import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ satelliteId: z.string().min(1) });

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  try {
    const { satelliteId } = schema.parse(await request.json());
    const fav = await prisma.userFavorite.upsert({
      where: { userId_satelliteId: { userId, satelliteId } },
      create: { userId, satelliteId },
      update: {},
      include: { satellite: true },
    });
    return jsonOk({ favorite: fav });
  } catch (e) {
    if (e instanceof z.ZodError) return jsonError("Invalid input");
    return jsonError(e instanceof Error ? e.message : "Failed", 500);
  }
}
