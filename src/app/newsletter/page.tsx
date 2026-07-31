import Image from "next/image";
import Link from "next/link";
import { NewsletterSignup } from "@/components/newsletter-signup";
import { NEWSLETTER } from "@/lib/newsletter";

export const metadata = {
  title: "The Downlink",
  description: "Join The Downlink by OrbytMax for weekly satellite stories, NASA images, rocket notes, and student space activities.",
};

const issues = [
  {
    tag: "This week",
    title: "ISS spotting nights",
    copy: "How to plan a visible pass, read elevation, and use the tracker without getting lost in technical terms.",
    image: "/nasa/blue-marble.jpeg",
  },
  {
    tag: "Deep sky",
    title: "What Webb images teach us",
    copy: "A classroom-friendly look at star nurseries, infrared light, and why space photos are more than pretty wallpaper.",
    image: "/nasa/cosmic-cliffs.png",
  },
  {
    tag: "Rocket lab",
    title: "Launch windows made simple",
    copy: "Why rockets do not launch whenever they want, and how timing connects to orbit, weather, and mission goals.",
    image: "/images/parts-real/propulsion.jpg",
  },
];

const articleCards = [
  {
    title: "How satellites talk to Earth",
    category: "Satellites",
    copy: "Antennas, ground stations, and radio signals explained with examples students can inspect.",
    href: "/education/parts",
  },
  {
    title: "LEO vs GEO in one minute",
    category: "Orbit guide",
    copy: "A quick way to understand why some satellites zip overhead and others appear fixed.",
    href: "/learn/leo-vs-geo",
  },
  {
    title: "Why the ISS looks like a star",
    category: "Sky watching",
    copy: "It shines by reflecting sunlight, and the best passes happen when your sky is dark but the station is sunlit.",
    href: "/learn/how-to-see-iss-tonight",
  },
  {
    title: "Build a satellite checklist",
    category: "Student activity",
    copy: "Power, communication, payload, and attitude control: the four ideas every student should remember.",
    href: "/education/parts",
  },
];

export default function NewsletterPage() {
  return (
    <div className="newsletter-page">
      <section className="newsletter-hero">
        <div className="newsletter-hero-copy">
          <span className="sticker-tag">OrbytMax dispatch</span>
          <h1>{NEWSLETTER.name}</h1>
          <p>{NEWSLETTER.valueProp}</p>
          <div className="newsletter-hero-badges" aria-label="Newsletter topics">
            <span>Sky passes</span>
            <span>NASA images</span>
            <span>Rocket notes</span>
          </div>
          <NewsletterSignup source="newsletter-page-hero" />
        </div>
        <div className="newsletter-hero-visual" aria-label="NASA Earth and space newsletter collage">
          <div className="newsletter-image-card is-main">
            <Image
              src="/nasa/pia25163.jpg"
              alt="NASA image PIA25163 showing Earth from space"
              width={900}
              height={620}
              priority
            />
            <span>Universe</span>
          </div>
          <div className="newsletter-image-row">
            <div className="newsletter-image-card">
              <Image src="/nasa/cosmic-cliffs.png" alt="Cosmic Cliffs from the James Webb Space Telescope" width={420} height={300} />
              <span>Deep sky</span>
            </div>
            <div className="newsletter-image-card">
              <Image src="/images/parts-real/propulsion.jpg" alt="Rocket and spacecraft propulsion hardware" width={420} height={300} />
              <span>Rocket lab</span>
            </div>
          </div>
          <div className="newsletter-signal-card">
            <strong>Weekly launch window</strong>
            <small>1 sky event / 1 image / 1 challenge</small>
          </div>
        </div>
      </section>

      <section className="newsletter-orbit-strip" aria-label="Newsletter promise">
        <article>
          <span>Observe</span>
          <h2>Know what to see tonight</h2>
          <p>Visible passes and simple sky-watching notes built around student curiosity.</p>
        </article>
        <article>
          <span>Understand</span>
          <h2>Decode real NASA images</h2>
          <p>Short explanations make space photos feel like science, not just decoration.</p>
        </article>
        <article>
          <span>Build</span>
          <h2>Try a quick space challenge</h2>
          <p>Each issue ends with a small task students can do inside OrbytMax.</p>
        </article>
      </section>

      <section className="newsletter-issue-strip" aria-label="Newsletter issue previews">
        {issues.map((issue) => (
          <article key={issue.title} className="newsletter-issue-card">
            <Image src={issue.image} alt="" width={640} height={400} />
            <div>
              <span>{issue.tag}</span>
              <h2>{issue.title}</h2>
              <p>{issue.copy}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="newsletter-article-wall" aria-label="Space article topics">
        <div className="newsletter-section-head">
          <span className="sticker-tag">Articles</span>
          <h2>Keep reading after the signup</h2>
          <p>These are the kinds of stories the newsletter will send: practical, visual, and built for students.</p>
        </div>
        <div className="newsletter-article-grid">
          {articleCards.map((article) => (
            <Link key={article.title} href={article.href} className="newsletter-article-card">
              <span>{article.category}</span>
              <h3>{article.title}</h3>
              <p>{article.copy}</p>
              <small>Read now</small>
            </Link>
          ))}
        </div>
      </section>

      <section className="newsletter-lab-band" aria-label="Newsletter learning promise">
        <div>
          <span className="sticker-tag">Every issue</span>
          <h2>One useful space email, no account needed</h2>
          <p>{NEWSLETTER.microcopy}</p>
        </div>
        <NewsletterSignup compact source="newsletter-page-bottom" />
      </section>
    </div>
  );
}
