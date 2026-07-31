import Link from "next/link";
import { SectionHeader } from "@/components/neo-ui";

export const metadata = {
  title: "LEO vs GEO",
  description: "Compare LEO, MEO, and GEO satellites with simple student-friendly examples.",
};

const orbitRows = [
  ["LEO", "Low Earth orbit", "ISS, Hubble, many Earth-observation satellites", "Fast passes across the sky"],
  ["MEO", "Medium Earth orbit", "Navigation satellites like GPS-style systems", "Useful for global positioning"],
  ["GEO", "Geostationary orbit", "Weather and communication satellites", "Appears fixed above one region"],
];

export default function LeoVsGeoPage() {
  return (
    <article className="learn-article mx-auto max-w-5xl px-4 py-10 sm:py-12">
      <SectionHeader
        eyebrow="Orbit guide"
        title="LEO vs GEO"
        copy="Satellites do different jobs depending on how high they orbit. Lower satellites move fast; geostationary satellites stay above the same part of Earth."
      />

      <section className="orbit-table mt-10" aria-label="Orbit comparison table">
        {orbitRows.map(([code, name, example, clue]) => (
          <div key={code}>
            <span>{code}</span>
            <h2>{name}</h2>
            <p>{example}</p>
            <small>{clue}</small>
          </div>
        ))}
      </section>

      <div className="learn-note">
        <h2>Try it in OrbytMax</h2>
        <p>
          Open the live tracker, choose a satellite, and compare its altitude and orbit label. Then try the quiz to test
          whether you can spot the difference between LEO and GEO.
        </p>
      </div>

      <div className="learn-cta">
        <Link href="/tracker" className="btn-primary">
          Open tracker
        </Link>
        <Link href="/education/quiz" className="btn-secondary">
          Try orbit quiz
        </Link>
      </div>
    </article>
  );
}
