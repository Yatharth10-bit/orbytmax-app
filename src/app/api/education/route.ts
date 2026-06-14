import { jsonOk } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { EDUCATION_PAGES, QUIZ_SEED } from "@/lib/seed-catalog";

export async function GET() {
  try {
    const pages = await prisma.educationPage.findMany({ orderBy: { title: "asc" } });
    const quizzes = await prisma.quiz.findMany({
      include: { questions: true },
      orderBy: { title: "asc" },
    });
    return jsonOk({
      pages: pages.length ? pages : EDUCATION_PAGES,
      quizzes: quizzes.length ? quizzes : [QUIZ_SEED],
    });
  } catch {
    return jsonOk({ pages: EDUCATION_PAGES, quizzes: [QUIZ_SEED] });
  }
}
