import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { hasUsablePostgresUrl } from "@/lib/database-status";
import { NEWSLETTER } from "@/lib/newsletter";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  email: z.string().trim().email().max(160),
  website: z.string().trim().max(200).optional(),
  source: z.string().trim().max(60).optional(),
});

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 5;

type RateEntry = { count: number; resetAt: number };
type ResendResult = { id?: string };

const globalCache = globalThis as unknown as {
  __orbytMaxNewsletterRate?: Map<string, RateEntry>;
};

function getClientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}

function isRateLimited(ip: string) {
  const now = Date.now();
  const cache = (globalCache.__orbytMaxNewsletterRate ??= new Map());
  const current = cache.get(ip);
  if (!current || current.resetAt <= now) {
    cache.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > RATE_LIMIT;
}

async function addResendContact(email: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!apiKey || !audienceId) return null;

  const response = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, unsubscribed: false }),
  });

  if (response.status === 409) return { id: "already_subscribed" } satisfies ResendResult;
  if (!response.ok) throw new Error("Newsletter provider could not save this email.");
  return (await response.json()) as ResendResult;
}

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const email = body.email.toLowerCase();
    if (body.website) {
      return jsonOk({
        status: "accepted",
        message: `You are on ${NEWSLETTER.name}.`,
      });
    }

    if (isRateLimited(getClientIp(request))) {
      return jsonError("Too many signup attempts. Please try again later.", 429);
    }

    const providerResult = await addResendContact(email);
    if (!hasUsablePostgresUrl()) {
      return jsonOk({
        status: providerResult ? "subscribed" : "demo",
        saved: false,
        message: providerResult
          ? `Check your inbox to finish joining ${NEWSLETTER.name}.`
          : `You're on ${NEWSLETTER.name}. Connect a database or email provider before launch to store signups centrally.`,
      });
    }

    const existing = await prisma.newsletterSubscriber.findUnique({ where: { email } });
    if (existing) {
      return jsonOk({
        status: "already_subscribed",
        saved: true,
        message: `You are already on ${NEWSLETTER.name}.`,
      });
    }

    const subscriber = await prisma.newsletterSubscriber.upsert({
      where: { email },
      create: {
        email,
        interests: null,
        source: body.source || "newsletter",
      },
      update: {
        source: body.source || "newsletter",
      },
    });

    return jsonOk({
      status: "subscribed",
      saved: true,
      subscriber: { id: subscriber.id, email: subscriber.email },
      message: providerResult
        ? `Check your inbox to finish joining ${NEWSLETTER.name}.`
        : `You are on ${NEWSLETTER.name}.`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) return jsonError("Enter a valid email address.");
    return jsonError(error instanceof Error ? error.message : "Could not join right now. Please try again.");
  }
}
