import { jsonError, jsonOk } from "@/lib/api";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  const { id } = await params;
  await prisma.alertPreference.deleteMany({ where: { id, userId } });
  return jsonOk({ ok: true });
}
