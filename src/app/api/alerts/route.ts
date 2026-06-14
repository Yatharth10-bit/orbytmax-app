import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  satelliteId: z.string().min(1),
  minutesBefore: z.number().int().min(5).max(60).default(10),
  pushEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
});

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  const alerts = await prisma.alertPreference.findMany({
    where: { userId },
    include: { satellite: true },
  });
  return jsonOk({ alerts });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  try {
    const body = schema.parse(await request.json());
    const alert = await prisma.alertPreference.upsert({
      where: { userId_satelliteId: { userId, satelliteId: body.satelliteId } },
      create: {
        userId,
        satelliteId: body.satelliteId,
        minutesBefore: body.minutesBefore,
        pushEnabled: body.pushEnabled ?? true,
        emailEnabled: body.emailEnabled ?? false,
      },
      update: {
        minutesBefore: body.minutesBefore,
        pushEnabled: body.pushEnabled,
        emailEnabled: body.emailEnabled,
      },
      include: { satellite: true },
    });
    await prisma.userFollowedSatellite.upsert({
      where: { userId_satelliteId: { userId, satelliteId: body.satelliteId } },
      create: { userId, satelliteId: body.satelliteId },
      update: {},
    });
    return jsonOk({ alert });
  } catch (e) {
    if (e instanceof z.ZodError) return jsonError("Invalid input");
    return jsonError(e instanceof Error ? e.message : "Failed", 500);
  }
}
