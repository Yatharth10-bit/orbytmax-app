import Image from "next/image";
import { SectionHeader } from "@/components/neo-ui";
import { SATELLITE_PARTS } from "@/lib/education-content";

export const metadata = {
  title: "Parts of a Satellite",
  description: "Learn the key spacecraft subsystems and why they matter.",
};

export default function SatellitePartsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-12">
      <SectionHeader
        eyebrow="Spacecraft build"
        title="Parts of a satellite"
        copy="A satellite is a team of subsystems. Each card explains the part, why it matters, and a simple visual cue."
      />

      <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Satellite parts">
        {SATELLITE_PARTS.map((part) => (
          <article key={part.slug} className="part-card">
            <div className="part-diagram">
              <Image
                src={part.imageUrl}
                alt={`${part.name} illustration`}
                width={640}
                height={360}
                loading="eager"
                unoptimized
              />
            </div>
            <span className="sticker-tag">{part.signal}</span>
            <h2>{part.name}</h2>
            <p>{part.summary}</p>
            <div>
              <h3>Why it matters</h3>
              <p>{part.why}</p>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
