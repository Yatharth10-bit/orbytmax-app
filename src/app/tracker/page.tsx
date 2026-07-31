import { TrackerView } from "@/components/tracker-view";
import { SectionHeader } from "@/components/neo-ui";

export const metadata = {
  title: "Satellite Tracker",
  description: "Live satellite positions with NORAD IDs, orbital data timestamps, and an interactive student-friendly globe.",
};

export default function TrackerPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <SectionHeader
        eyebrow="Tracker"
        title="Live satellite map"
        copy="Refresh live orbital data, follow one object, and keep the 3D globe usable on small screens."
      />
      <section className="tracker-trust-grid mt-8" aria-label="Tracker data quality notes">
        <article>
          <span>01</span>
          <h2>Live orbital data</h2>
          <p>Positions are calculated from TLE-style orbital records and refreshed inside the tracker.</p>
        </article>
        <article>
          <span>02</span>
          <h2>NORAD identity</h2>
          <p>Tracked objects show NORAD catalog numbers so students can connect the map to real satellite records.</p>
        </article>
        <article>
          <span>03</span>
          <h2>Learning safe</h2>
          <p>The map is designed for classroom exploration: follow, zoom, inspect, and compare without leaving OrbytMax.</p>
        </article>
      </section>
      <div className="mt-8">
        <TrackerView />
      </div>
    </div>
  );
}
