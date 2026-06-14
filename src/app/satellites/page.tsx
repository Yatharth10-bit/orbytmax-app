import { EmptyState, SatelliteCard, SectionHeader } from "@/components/neo-ui";
import { getSatellitesList } from "@/lib/satellite-service";

export const metadata = {
  title: "Satellites",
  description: "Browse featured satellites and missions.",
};

export const dynamic = "force-dynamic";

export default async function SatellitesPage() {
  const satellites = await getSatellitesList();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-12">
      <SectionHeader
        eyebrow="Directory"
        title="Explore satellites"
        copy="Browse featured spacecraft, ISRO missions, observatories, navigation satellites, and weather sentinels."
      />

      {satellites.length ? (
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {satellites.map((sat) => (
            <SatelliteCard
              key={sat.id}
              href={`/satellite/${sat.slug}`}
              category={sat.category}
              title={sat.name}
              description={sat.shortDescription}
              meta={`${sat.agency} / ${sat.orbitType || "Orbit TBD"}`}
              featured={sat.featured}
            />
          ))}
        </div>
      ) : (
        <div className="mt-10">
          <EmptyState title="No satellites seeded" message="Run the Prisma seed script to fill the mission library." />
        </div>
      )}
    </div>
  );
}
