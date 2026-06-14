import Link from "next/link";
import { SectionHeader } from "@/components/neo-ui";
import { GLOBAL_MISSIONS, ISRO_MISSIONS, SATELLITE_PARTS } from "@/lib/education-content";

export const metadata = {
  title: "Education",
  description: "Explore satellite missions, spacecraft parts, and orbit basics.",
};

const hubCards = [
  {
    href: "/education/isro",
    label: "ISRO",
    title: "ISRO Mission Library",
    copy: "Chandrayaan, Mangalyaan, NavIC, weather, ocean, radar, and resource missions.",
    meta: `${ISRO_MISSIONS.length} missions`,
    tone: "#eaffdf",
  },
  {
    href: "/education/global",
    label: "Global",
    title: "NASA & Global Missions",
    copy: "ISS, Hubble, Landsat, NOAA, ESA, and constellation missions in one fast library.",
    meta: `${GLOBAL_MISSIONS.length} missions`,
    tone: "#e9f7ff",
  },
  {
    href: "/education/parts",
    label: "Build",
    title: "Parts of a Satellite",
    copy: "Solar panels, antennas, payload, propulsion, computers, batteries, and more.",
    meta: `${SATELLITE_PARTS.length} parts`,
    tone: "#fff0f7",
  },
  {
    href: "/education/quiz",
    label: "Quiz",
    title: "Orbit Basics Quiz",
    copy: "Five-question MCQ rounds with instant feedback, score, and playful ranks.",
    meta: "20+ questions",
    tone: "#fff9e8",
  },
];

export default function EducationPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-12">
      <SectionHeader
        eyebrow="Education"
        title="Education hub"
        copy="Choose a learning path. Every card opens a real page with mission details, spacecraft parts, or an interactive orbit quiz."
      />

      <section className="mt-10 grid gap-4 sm:grid-cols-2" aria-label="Education hub sections">
        {hubCards.map((card) => (
          <Link key={card.href} href={card.href} className="edu-hub-card" style={{ background: card.tone }}>
            <span className="sticker-tag">{card.label}</span>
            <h2>{card.title}</h2>
            <p>{card.copy}</p>
            <small>{card.meta}</small>
          </Link>
        ))}
      </section>
    </div>
  );
}
