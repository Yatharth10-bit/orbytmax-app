import bcrypt from "bcryptjs";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(80).optional(),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const email = body.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return jsonError("Email already registered", 409);
    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash, name: body.name },
      select: { id: true, email: true, name: true },
    });
    return jsonOk({ user }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return jsonError(e.issues[0]?.message || "Invalid input");
    return jsonError(e instanceof Error ? e.message : "Signup failed", 500);
  }
}
