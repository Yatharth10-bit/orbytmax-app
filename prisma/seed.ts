import { PrismaClient } from "@prisma/client";
import { FALLBACK_TLE } from "../src/lib/fallback-tle";
import { EDUCATION_PAGES, QUIZ_SEED, SEED_SATELLITES } from "../src/lib/seed-catalog";

const prisma = new PrismaClient();

async function upsertSatelliteCatalog() {
  for (const sat of SEED_SATELLITES) {
    const satellite = await prisma.satellite.upsert({
      where: { slug: sat.slug },
      create: {
        slug: sat.slug,
        name: sat.name,
        noradId: sat.noradId,
        agency: sat.agency,
        country: sat.country,
        category: sat.category,
        missionType: sat.missionType,
        description: sat.description,
        shortDescription: sat.shortDescription,
        launchDate: sat.launchDate,
        orbitType: sat.orbitType,
        altitude: sat.altitude,
        inclination: sat.inclination,
        factsJson: JSON.stringify(sat.facts),
        timelineJson: JSON.stringify(sat.timeline),
        relatedSlugs: sat.relatedSlugs?.join(","),
        featured: sat.featured ?? false,
        feedPriority: sat.feedPriority ?? 0,
        seoTitle: `${sat.name} - OrbytMax`,
        seoDescription: sat.shortDescription,
      },
      update: {
        name: sat.name,
        noradId: sat.noradId,
        agency: sat.agency,
        country: sat.country,
        category: sat.category,
        missionType: sat.missionType,
        description: sat.description,
        shortDescription: sat.shortDescription,
        launchDate: sat.launchDate,
        orbitType: sat.orbitType,
        altitude: sat.altitude,
        inclination: sat.inclination,
        factsJson: JSON.stringify(sat.facts),
        timelineJson: JSON.stringify(sat.timeline),
        relatedSlugs: sat.relatedSlugs?.join(","),
        featured: sat.featured ?? false,
        feedPriority: sat.feedPriority ?? 0,
        seoTitle: `${sat.name} - OrbytMax`,
        seoDescription: sat.shortDescription,
      },
    });

    if (sat.model) {
      await prisma.modelAsset.upsert({
        where: { satelliteId: satellite.id },
        create: {
          satelliteId: satellite.id,
          fallbackType: sat.model.fallbackType,
          attribution: sat.model.attribution,
          embedUid: sat.model.embedUid,
          sourceUrl: sat.model.sourceUrl,
          commercialUseAllowed: sat.model.commercialUseAllowed ?? false,
          modificationAllowed: sat.model.modificationAllowed ?? false,
        },
        update: {
          fallbackType: sat.model.fallbackType,
          attribution: sat.model.attribution,
          embedUid: sat.model.embedUid,
          sourceUrl: sat.model.sourceUrl,
          commercialUseAllowed: sat.model.commercialUseAllowed ?? false,
          modificationAllowed: sat.model.modificationAllowed ?? false,
        },
      });
    }

    const existingFeedItem = await prisma.feedItem.findFirst({
      where: { satelliteId: satellite.id, title: sat.name },
    });
    const feedData = {
      satelliteId: satellite.id,
      title: sat.name,
      summary: sat.shortDescription,
      agency: sat.agency,
      missionType: sat.missionType,
      orbitType: sat.orbitType ?? "LEO",
      category: sat.category,
      sortOrder: sat.feedPriority ?? 0,
      active: true,
    };
    if (existingFeedItem) {
      await prisma.feedItem.update({ where: { id: existingFeedItem.id }, data: feedData });
    } else {
      await prisma.feedItem.create({ data: feedData });
    }
  }
}

async function upsertEducationContent() {
  for (const page of EDUCATION_PAGES) {
    await prisma.educationPage.upsert({
      where: { slug: page.slug },
      create: page,
      update: page,
    });
  }

  const quiz = await prisma.quiz.upsert({
    where: { slug: QUIZ_SEED.slug },
    create: {
      slug: QUIZ_SEED.slug,
      title: QUIZ_SEED.title,
      description: QUIZ_SEED.description,
    },
    update: {
      title: QUIZ_SEED.title,
      description: QUIZ_SEED.description,
    },
  });

  await prisma.quizQuestion.deleteMany({ where: { quizId: quiz.id } });
  for (const q of QUIZ_SEED.questions) {
    await prisma.quizQuestion.create({
      data: {
        quizId: quiz.id,
        question: q.question,
        optionsJson: JSON.stringify(q.options),
        correctIndex: q.correctIndex,
        explanation: q.explanation,
      },
    });
  }
}

async function main() {
  await prisma.tleCache.upsert({
    where: { id: "global" },
    create: { id: "global", source: "seed fallback", rawTle: FALLBACK_TLE },
    update: { source: "seed fallback", rawTle: FALLBACK_TLE, updatedAt: new Date() },
  });

  await upsertSatelliteCatalog();
  await upsertEducationContent();

  console.log(`Seeded or updated ${SEED_SATELLITES.length} satellites, education pages, and quiz content.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
