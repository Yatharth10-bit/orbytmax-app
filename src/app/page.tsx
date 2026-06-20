import Link from "next/link";
import { FeedSection } from "@/components/feed-section";
import { MissionCard, NeoLinkButton, SectionHeader } from "@/components/neo-ui";

const features = [
  {
    title: "Track satellites in real time",
    desc: "Live positions from orbital data on an interactive globe.",
    href: "/tracker",
  },
  {
    title: "See what is visible tonight",
    desc: "Pass times, direction, and elevation for your location.",
    href: "/sky-tonight",
  },
  {
    title: "Explore ISRO & global missions",
    desc: "Mixed feed of Indian, NASA, ESA, and commercial spacecraft.",
    href: "/satellites",
  },
  {
    title: "Learn with interactive 3D",
    desc: "Inspect satellite parts with simple explanations.",
    href: "/education",
  },
  {
    title: "Visualize a black hole",
    desc: "Explore spacetime, light bending, and a glowing accretion disk.",
    href: "/black-hole-visualizer",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden px-4 pb-16 pt-10 sm:pt-16">
        <div className="mx-auto max-w-6xl">
          <SectionHeader
            eyebrow="OrbytMax"
            title="Earth orbit, playable."
            copy="A fast satellite tracker with live positions, sky passes, mission cards, and small 3D lessons built for phones first."
            action={
              <div className="grid gap-3 sm:flex">
                <NeoLinkButton href="/tracker">Open tracker</NeoLinkButton>
                <NeoLinkButton href="/sky-tonight" variant="secondary">
                  Sky tonight
                </NeoLinkButton>
              </div>
            }
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <div className="card bg-[#e9f7ff]">
              <p className="neo-eyebrow">LIVE</p>
              <h2 className="mt-4 text-2xl font-extrabold uppercase leading-none">Moving map</h2>
              <p className="mt-3 text-sm text-[var(--muted)]">Refresh positions, follow a satellite, and inspect its orbit snapshot.</p>
            </div>
            <div className="card bg-[#fff0f7]">
              <p className="neo-eyebrow">3D</p>
              <h2 className="mt-4 text-2xl font-extrabold uppercase leading-none">Chunky models</h2>
              <p className="mt-3 text-sm text-[var(--muted)]">Satellite parts load on demand with simple controls and fallbacks.</p>
            </div>
            <div className="card bg-[#eaffdf]">
              <p className="neo-eyebrow">QUIZ</p>
              <h2 className="mt-4 text-2xl font-extrabold uppercase leading-none">Orbit basics</h2>
              <p className="mt-3 text-sm text-[var(--muted)]">Learn LEO, GEO, passes, and TLE data without dense mission jargon.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f) => (
          <Link key={f.href} href={f.href} className="block">
            <MissionCard label="Mission" title={f.title} copy={f.desc} />
          </Link>
        ))}
      </section>

      <FeedSection />
    </>
  );
}
