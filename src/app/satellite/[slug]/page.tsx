import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NeoLinkButton, SectionHeader } from "@/components/neo-ui";
import { SatelliteModelPanel } from "@/components/satellite-model-panel";
import { getSatelliteBySlug, serializeSatellite } from "@/lib/satellite-service";
import { prisma } from "@/lib/prisma";
import { SEED_SATELLITES } from "@/lib/seed-catalog";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const sat = await getSatelliteBySlug(slug);
  if (!sat) return { title: "Satellite not found" };
  return {
    title: sat.seoTitle || sat.name,
    description: sat.seoDescription || sat.shortDescription || undefined,
    openGraph: {
      title: sat.seoTitle || sat.name,
      description: sat.seoDescription || sat.shortDescription || undefined,
      type: "article",
    },
  };
}

export default async function SatelliteDetailPage({ params }: Props) {
  const { slug } = await params;
  const raw = await getSatelliteBySlug(slug);
  if (!raw) notFound();
  const sat = serializeSatellite(raw);

  let related: { id: string; name: string; slug: string }[] = [];
  if (sat.relatedSlugs?.length) {
    try {
      related = await prisma.satellite.findMany({
        where: { slug: { in: sat.relatedSlugs } },
        select: { id: true, name: true, slug: true },
      });
    } catch {
      related = SEED_SATELLITES.filter((item) => sat.relatedSlugs.includes(item.slug)).map((item) => ({
        id: item.slug,
        name: item.name,
        slug: item.slug,
      }));
    }
  }

  return (
    <article className="mx-auto max-w-6xl px-4 py-10 sm:py-12">
      <nav className="flex flex-wrap gap-2 text-sm font-bold text-[var(--muted)]" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-[var(--text)]">
          Home
        </Link>
        <span>/</span>
        <Link href="/satellites" className="hover:text-[var(--text)]">
          Satellites
        </Link>
        <span>/</span>
        <span className="break-words">{sat.name}</span>
      </nav>

      <header className="mt-8">
        <SectionHeader
          eyebrow={sat.missionType || sat.category}
          title={sat.name}
          copy={sat.shortDescription || sat.description}
          action={
            <div className="grid gap-3 sm:flex">
              <NeoLinkButton href="/sky-tonight">Find passes</NeoLinkButton>
              <NeoLinkButton href="/tracker" variant="secondary">
                Open tracker
              </NeoLinkButton>
            </div>
          }
        />
      </header>

      <section className="mt-10" aria-labelledby="model-title">
        <p className="neo-eyebrow">3D Model</p>
        <h2 id="model-title" className="mt-4 text-3xl font-extrabold uppercase leading-none">
          Inspect spacecraft
        </h2>
        <div className="mt-5">
          <SatelliteModelPanel
            attribution={sat.model?.attribution}
            fallbackType={sat.model?.fallbackType}
            modelUrl={sat.model?.modelUrl}
            name={sat.name}
          />
        </div>
      </section>

      <section className="mt-12 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="card bg-[#e9f7ff]">
          <span className="sticker-tag">Overview</span>
          <p className="mt-4 text-[var(--muted)]">{sat.description}</p>
          <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
            {[
              ["Agency", sat.agency],
              ["Country", sat.country],
              ["Launch", sat.launchDate || "TBD"],
              ["Orbit", sat.orbitType || "TBD"],
              ["NORAD", sat.noradId || "TBD"],
              ["Altitude", sat.altitude || (sat.position ? `${sat.position.altKm.toFixed(0)} km` : "TBD")],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[14px] border-2 border-[var(--border)] bg-white p-3">
                <dt className="font-mono text-[0.68rem] font-bold uppercase text-[var(--muted)]">{label}</dt>
                <dd className="mt-1 break-words font-bold">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="card bg-[#fff0f7]">
          <span className="sticker-tag">Facts</span>
          <ul className="mt-4 grid gap-3 text-[var(--muted)]">
            {(sat.facts as string[]).map((fact) => (
              <li key={fact} className="rounded-[14px] border-2 border-[var(--border)] bg-white p-3">
                {fact}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {(sat.timeline as { date: string; title: string }[])?.length > 0 && (
        <section className="mt-12">
          <p className="neo-eyebrow">Timeline</p>
          <ol className="mt-5 grid gap-3">
            {(sat.timeline as { date: string; title: string }[]).map((event) => (
              <li key={`${event.date}-${event.title}`} className="card flex flex-wrap items-center gap-3 bg-[#fff9e8]">
                <span className="sticker-tag">{event.date}</span>
                <p className="font-bold">{event.title}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-12">
          <p className="neo-eyebrow">Related</p>
          <div className="mt-5 flex flex-wrap gap-3">
            {related.map((item) => (
              <Link key={item.id} href={`/satellite/${item.slug}`} className="btn-secondary text-sm">
                {item.name}
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
