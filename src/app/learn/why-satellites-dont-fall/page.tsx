import Link from "next/link";
import { SectionHeader } from "@/components/neo-ui";

export const metadata = {
  title: "Why Satellites Do Not Fall",
  description: "A simple explanation of gravity, speed, and orbit for students.",
};

export default function WhySatellitesDontFallPage() {
  return (
    <article className="learn-article mx-auto max-w-5xl px-4 py-10 sm:py-12">
      <SectionHeader
        eyebrow="Physics guide"
        title="Why satellites do not fall"
        copy="Satellites are falling toward Earth all the time, but they also move sideways so fast that Earth curves away beneath them."
      />

      <div className="learn-article-grid mt-10">
        <section>
          <h2>Gravity pulls inward</h2>
          <p>
            Earth pulls satellites down with gravity. That pull is what bends the satellite path into an orbit instead
            of letting it fly away in a straight line.
          </p>
        </section>
        <section>
          <h2>Speed carries sideways</h2>
          <p>
            A satellite also moves sideways very quickly. In low Earth orbit, that speed is often around several
            kilometers every second.
          </p>
        </section>
        <section>
          <h2>Orbit is a balance</h2>
          <p>
            If the satellite is too slow, it falls back. If it is too fast, it can escape. The right speed keeps it
            falling around Earth.
          </p>
        </section>
      </div>

      <div className="learn-note">
        <h2>Quick classroom test</h2>
        <p>
          Follow one object on the tracker and watch how its latitude, longitude, altitude, and velocity change. Those
          numbers are the real clues that orbit is motion, not floating.
        </p>
      </div>

      <div className="learn-cta">
        <Link href="/tracker" className="btn-primary">
          Watch an orbit
        </Link>
        <Link href="/education/parts" className="btn-secondary">
          Inspect satellite parts
        </Link>
      </div>
    </article>
  );
}
