import { jsonError, jsonOk } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { EDUCATION_PAGES } from "@/lib/seed-catalog";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  try {
    const page = await prisma.educationPage.findUnique({ where: { slug } });
    if (!page) return jsonError("Not found", 404);
    return jsonOk({
      page: {
        ...page,
        body: page.bodyJson ? JSON.parse(page.bodyJson) : null,
      },
    });
  } catch {
    const page = EDUCATION_PAGES.find((item) => item.slug === slug);
    if (!page) return jsonError("Not found", 404);
    return jsonOk({
      page: {
        ...page,
        body: page.bodyJson ? JSON.parse(page.bodyJson) : null,
      },
    });
  }
}
