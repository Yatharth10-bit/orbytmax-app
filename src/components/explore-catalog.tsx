import Link from "next/link";
import { EmptyState, SatelliteCard, SectionHeader } from "@/components/neo-ui";
import { GLOBAL_MISSIONS, ISRO_MISSIONS, SATELLITE_PARTS } from "@/lib/education-content";
type CatalogEntry = { slug: string; name: string; category: string; agency: string; shortDescription: string | null; orbitType: string | null; featured?: boolean };

const educationCards = [
  {
    href: "/education/isro",
    label: "ISRO",
    title: "ISRO Mission Library",
    copy: "Chandrayaan, Mangalyaan, NavIC, weather, ocean, radar, and resource missions.",
    meta: `${ISRO_MISSIONS.length} missions`,
  },
  {
    href: "/education/global",
    label: "Global",
    title: "NASA & Global Missions",
    copy: "ISS, Hubble, Landsat, NOAA, ESA, and constellation missions in one fast library.",
    meta: `${GLOBAL_MISSIONS.length} missions`,
  },
  {
    href: "/education/parts",
    label: "Build",
    title: "Parts of a Satellite",
    copy: "Real satellite hardware photos for power, antennas, payloads, propulsion, computers, and more.",
    meta: `${SATELLITE_PARTS.length} parts`,
  },
  {
    href: "/education/quiz",
    label: "Quiz",
    title: "Orbit Basics Quiz",
    copy: "Five-question MCQ rounds with instant feedback, sounds, scores, and playful ranks.",
    meta: "20+ questions",
  },
];

const guides = [
  {
    href: "/learn/how-to-see-iss-tonight",
    label: "Sky guide",
    title: "How to see the ISS tonight",
    copy: "Learn when to look, what direction to face, and how to follow the station.",
  },
  {
    href: "/learn/leo-vs-geo",
    label: "Orbit guide",
    title: "LEO vs GEO",
    copy: "Compare low Earth orbit, medium orbit, and geostationary satellites with simple examples.",
  },
  {
    href: "/learn/why-satellites-dont-fall",
    label: "Physics guide",
    title: "Why satellites do not fall",
    copy: "A clear explanation of sideways speed, gravity, and orbit using student-friendly language.",
  },
];

export function ExploreCatalog({ satellites }: { satellites: readonly CatalogEntry[] }) {

  return (
    <div className="explore-page mx-auto max-w-6xl px-4 py-10 sm:py-12">
      <SectionHeader
        eyebrow="Explore"
        title="Satellites, lessons, and guides"
        copy="One place for the mission library, student activities, satellite parts, and quick learning guides."
      />

      <nav className="explore-jump-grid" aria-label="Explore sections">
        <a href="#satellites">
          <span>01</span>
          <strong>Satellites</strong>
          <small>Browse real missions</small>
        </a>
        <a href="#education">
          <span>02</span>
          <strong>Education</strong>
          <small>Build, inspect, quiz</small>
        </a>
        <a href="#learn">
          <span>03</span>
          <strong>Learn</strong>
          <small>Read short guides</small>
        </a>
      </nav>

      <section id="satellites" className="explore-section" aria-label="Satellite directory">
        <div className="explore-section-head">
          <span className="sticker-tag">Directory</span>
          <h2>Explore satellites</h2>
          <p>Featured spacecraft, ISRO missions, observatories, navigation satellites, and weather sentinels.</p>
        </div>
        {satellites.length ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {satellites.map((sat) => (
              <SatelliteCard
                key={sat.slug}
                href={`/satellite/${sat.slug}`}
                category={sat.category}
                title={sat.name}
                description={sat.shortDescription ?? undefined}
                meta={`${sat.agency} / ${sat.orbitType || "Orbit TBD"}`}
                featured={!!sat.featured}
              />
            ))}
          </div>
        ) : (
          <div className="mt-6">
            <EmptyState title="No satellites seeded" message="Run the seed script to fill the mission library." />
          </div>
        )}
      </section>

      <section id="education" className="explore-section" aria-label="Education hub">
        <div className="explore-section-head">
          <span className="sticker-tag">Education</span>
          <h2>Choose a learning path</h2>
          <p>Every card opens a real activity with mission details, spacecraft parts, or orbit practice.</p>
        </div>
        <div className="explore-card-grid mt-6">
          {educationCards.map((card) => (
            <Link key={card.href} href={card.href} className="edu-hub-card">
              <span className="sticker-tag">{card.label}</span>
              <h2>{card.title}</h2>
              <p>{card.copy}</p>
              <small>{card.meta}</small>
            </Link>
          ))}
        </div>
      </section>

      <section id="learn" className="explore-section" aria-label="Student space guides">
        <div className="explore-section-head">
          <span className="sticker-tag">Learn</span>
          <h2>Student space guides</h2>
          <p>Short explanations built around things students can do inside OrbytMax: spot, follow, compare, and quiz.</p>
        </div>
        <div className="learn-card-grid mt-6">
          {guides.map((guide) => (
            <Link key={guide.href} href={guide.href} className="learn-guide-card">
              <span>{guide.label}</span>
              <h2>{guide.title}</h2>
              <p>{guide.copy}</p>
              <small>Open guide</small>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

