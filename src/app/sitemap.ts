import type { MetadataRoute } from "next";
import { SEED_SATELLITES } from "@/lib/seed-catalog";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://orbytmax.com";

const staticRoutes = [
  "",
  "/tracker",
  "/sky-tonight",
  "/explore",
  "/education/isro",
  "/education/global",
  "/education/parts",
  "/education/quiz",
  "/learn/how-to-see-iss-tonight",
  "/learn/leo-vs-geo",
  "/learn/why-satellites-dont-fall",
  "/newsletter",
  "/privacy",
  "/teachers",
];

function entry(path: string, priority: number, changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]) {
  return {
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  };
}

export default function sitemap(): MetadataRoute.Sitemap {
  const satelliteRoutes = SEED_SATELLITES.map((satellite) =>
    entry(`/satellite/${satellite.slug}`, satellite.featured ? 0.82 : 0.72, "weekly")
  );

  return [
    ...staticRoutes.map((route, index) => entry(route, index === 0 ? 1 : 0.86, "weekly")),
    ...satelliteRoutes,
  ];
}
