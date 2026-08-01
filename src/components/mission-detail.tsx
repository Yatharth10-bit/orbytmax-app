import Link from "next/link";
import { NeoLinkButton, SectionHeader } from "@/components/neo-ui";
import { SatelliteModelPanel } from "@/components/satellite-model-panel";
import type { MissionEntry } from "@/lib/education-content";

export function MissionDetail({
  mission,
  backHref,
  backLabel,
}: {
  mission: MissionEntry;
  backHref: string;
  backLabel: string;
}) {
  return (
    <article className="mx-auto max-w-6xl px-4 py-10 sm:py-12">
      <nav className="flex flex-wrap gap-2 text-sm font-bold text-[var(--muted)]" aria-label="Breadcrumb">
        <Link href="/explore#education" className="hover:text-[var(--text)]">
          Explore
        </Link>
        <span>/</span>
        <Link href={backHref} className="hover:text-[var(--text)]">
          {backLabel}
        </Link>
        <span>/</span>
        <span className="break-words">{mission.name}</span>
      </nav>

      <header className="mt-8">
        <SectionHeader
          eyebrow={mission.category}
          title={mission.name}
          copy={mission.purpose}
          action={
            <div className="grid gap-3 sm:flex">
              <NeoLinkButton href={`/satellite/${mission.slug}`}>Open tracker detail</NeoLinkButton>
              <NeoLinkButton href="/whats-overhead" variant="secondary">
                Find passes
              </NeoLinkButton>
            </div>
          }
        />
      </header>

      <section className="mt-10 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <div className="card mission-detail-card mission-file-card">
          <span className="sticker-tag">Mission file</span>
          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ["Agency", mission.agency],
              ["Launch", mission.launchDate],
              ["Category", mission.category],
              ["Orbit", mission.orbitType],
            ].map(([label, value]) => (
              <div key={label} className="mission-info-cell">
                <dt className="font-mono text-[0.68rem] font-bold uppercase text-[var(--muted)]">{label}</dt>
                <dd className="mt-1 break-words font-bold">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="card mission-detail-card mission-facts-card">
          <span className="sticker-tag">Key facts</span>
          <ul className="mt-4 grid gap-3">
            {mission.facts.map((fact) => (
              <li key={fact} className="mission-fact-item">
                {fact}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {mission.model && (
        <section className="mt-12" aria-labelledby="mission-model-title">
          <p className="neo-eyebrow">Visual</p>
          <h2 id="mission-model-title" className="mt-4 text-3xl font-extrabold uppercase leading-none">
            Spacecraft model
          </h2>
          <div className="mt-5">
            <SatelliteModelPanel
              attribution={mission.model.attribution}
              fallbackType={mission.model.fallbackType}
              modelUrl={mission.model.modelUrl}
              name={mission.name}
            />
          </div>
        </section>
      )}
    </article>
  );
}
