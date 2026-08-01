import Link from "next/link";
import { FeedSection } from "@/components/feed-section";
import { MiniOrbitHero } from "@/components/mini-orbit-hero";
import { NewsletterSignup } from "@/components/newsletter-signup";
import { MissionCard, NeoLinkButton, SectionHeader } from "@/components/neo-ui";
import { NEWSLETTER } from "@/lib/newsletter";

const features = [
  {
    title: "Track satellites in real time",
    desc: "Live positions from orbital data on an interactive globe.",
    href: "/tracker",
  },
  {
    title: "See what's overhead tonight",
    desc: "Pass times, direction, and elevation for your location.",
    href: "/whats-overhead",
  },
  {
    title: "Explore ISRO & global missions",
    desc: "Mixed feed of Indian, NASA, ESA, and commercial spacecraft.",
    href: "/explore#satellites",
  },
  {
    title: "Learn with interactive 3D",
    desc: "Inspect satellite parts with simple explanations.",
    href: "/explore#education",
  },
  {
    title: "Read student space guides",
    desc: "ISS spotting, orbit types, and why satellites stay in orbit.",
    href: "/explore#learn",
  },
  {
    title: "Get the space newsletter",
    desc: "Weekly satellite passes, NASA images, rocket notes, and student challenges.",
    href: "/newsletter",
  },
];

const studentHighlights = [
  {
    label: "Observe",
    title: "Find a real satellite pass",
    copy: "Students can search a city and open the matching object directly in the live tracker.",
  },
  {
    label: "Inspect",
    title: "See what satellites are made of",
    copy: "Parts, photos, and mission cards explain spacecraft without dense textbook language.",
  },
  {
    label: "Practice",
    title: "Turn facts into quick wins",
    copy: "Quizzes, sounds, and short missions give students a reason to return and improve.",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden px-4 pb-16 pt-10 sm:pt-16">
        <div className="mx-auto max-w-6xl">
          <div className="hero-console">
            <div>
              <SectionHeader
                eyebrow="OrbytMax"
                title="Explore Earth orbit"
                copy="Track satellites, view sky passes, and learn space science through playful student-friendly tools."
                action={
                  <div className="grid gap-3 sm:flex">
                    <NeoLinkButton href="/tracker">Open tracker</NeoLinkButton>
                    <NeoLinkButton href="/whats-overhead" variant="secondary">
                      What&apos;s overhead
                    </NeoLinkButton>
                    <NeoLinkButton href="/explore#learn" variant="secondary">
                      Student guides
                    </NeoLinkButton>
                    <NeoLinkButton href="/newsletter" variant="secondary">
                      Newsletter
                    </NeoLinkButton>
                  </div>
                }
              />
            </div>
            <MiniOrbitHero />
          </div>
          <div className="feature-card-grid mt-10 grid gap-4 sm:grid-cols-3">
            <Link href="/tracker" prefetch={false} className="card feature-card feature-card-map">
              <p className="neo-eyebrow">Tracker</p>
              <h2 className="mt-4 text-2xl font-medium leading-tight">Moving map</h2>
              <p className="mt-3 text-sm text-[var(--muted)]">Refresh positions, follow a satellite, and inspect its orbit snapshot.</p>
              <span className="feature-doodle feature-doodle-rocket" aria-hidden="true" />
            </Link>
            <Link href="/education/parts" className="card feature-card feature-card-model">
              <p className="neo-eyebrow">Inspect</p>
              <h2 className="mt-4 text-2xl font-medium leading-tight">Spacecraft models</h2>
              <p className="mt-3 text-sm text-[var(--muted)]">Satellite parts load on demand with simple controls and fallbacks.</p>
              <span className="feature-doodle feature-doodle-atom" aria-hidden="true" />
            </Link>
            <Link href="/education/quiz" className="card feature-card feature-card-quiz">
              <p className="neo-eyebrow">Learn</p>
              <h2 className="mt-4 text-2xl font-medium leading-tight">Orbit basics</h2>
              <p className="mt-3 text-sm text-[var(--muted)]">Learn LEO, GEO, passes, and TLE data without dense mission jargon.</p>
              <span className="feature-doodle feature-doodle-spark" aria-hidden="true" />
            </Link>
          </div>

          <section className="home-newsletter-strip" aria-label="The Downlink newsletter">
            <div>
              <span className="sticker-tag">Weekly dispatch</span>
              <h2>{NEWSLETTER.name}</h2>
              <p>{NEWSLETTER.valueProp}</p>
            </div>
            <NewsletterSignup compact source="homepage" />
          </section>

          <section className="cosmos-lab-strip" aria-label="NASA image study cards">
            <article className="cosmos-lab-card cosmos-lab-card-cliffs">
              <div>
                <p className="neo-eyebrow">Webb classroom</p>
                <h2>Star nurseries, not flat backgrounds</h2>
              </div>
              <p>Cosmic Cliffs imagery gives students a real astronomy anchor while the UI stays light and readable.</p>
            </article>
            <article className="cosmos-lab-card cosmos-lab-card-earth">
              <div>
                <p className="neo-eyebrow">Earth lab</p>
                <h2>Orbit data around a living planet</h2>
              </div>
              <p>Blue Marble imagery keeps the satellite tracker connected to the real Earth below every orbit.</p>
            </article>
          </section>

          <section className="student-proof-strip" aria-label="Student learning highlights">
            <div className="student-proof-copy">
              <span className="sticker-tag">Built for students</span>
              <h2>A tracker that turns space into a hands-on lab</h2>
              <p>
                OrbytMax works best when students do something: spot a pass, follow the object, inspect the mission,
                then test what they learned.
              </p>
            </div>
            <div className="student-proof-cards">
              {studentHighlights.map((item) => (
                <article key={item.label}>
                  <span>{item.label}</span>
                  <h3>{item.title}</h3>
                  <p>{item.copy}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="teacher-home-strip" aria-label="Teacher and parent tools">
            <div>
              <span className="sticker-tag">For teachers</span>
              <h2>Turn OrbytMax into a classroom activity</h2>
              <p>
                Use ready-made flows for sky watching, orbit comparison, satellite parts, and quick quizzes without
                sending students across random websites.
              </p>
            </div>
            <Link href="/teachers" className="btn-primary">
              Open teacher mode
            </Link>
          </section>

        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 sm:grid-cols-2 lg:grid-cols-3">
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
