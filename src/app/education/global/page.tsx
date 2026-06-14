import Link from "next/link";
import { SectionHeader } from "@/components/neo-ui";
import { GLOBAL_MISSIONS } from "@/lib/education-content";

export const metadata = {
  title: "NASA & Global Missions",
  description: "Explore NASA, ESA, NOAA, SpaceX, and international missions.",
};

export default function GlobalMissionLibraryPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-12">
      <SectionHeader
        eyebrow="Global"
        title="Mission library"
        copy="Space stations, observatories, Earth imagers, weather sentinels, and satellite constellations from NASA and global agencies."
      />

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GLOBAL_MISSIONS.map((mission) => (
          <Link key={mission.slug} href={`/education/global/${mission.slug}`} className="mission-link-card">
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
