import Link from "next/link";
import { SectionHeader } from "@/components/neo-ui";
import { ISRO_MISSIONS } from "@/lib/education-content";

export const metadata = {
  title: "ISRO Mission Library",
  description: "Explore ISRO satellite and planetary missions.",
};

export default function IsroMissionLibraryPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-12">
      <SectionHeader
        eyebrow="ISRO"
        title="Mission library"
        copy="Indian missions across lunar exploration, Mars orbit, Earth observation, navigation, weather, ocean, and resource monitoring."
      />

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ISRO_MISSIONS.map((mission) => (
          <Link key={mission.slug} href={`/education/isro/${mission.slug}`} className="mission-link-card">
            <span className="sticker-tag">{mission.category}</span>
            <h2>{mission.name}</h2>
            <p>{mission.purpose}</p>
            <small>
              {mission.agency} / {mission.launchDate} / {mission.orbitType}
            </small>
          </Link>
        ))}
      </div>
    </div>
  );
}
