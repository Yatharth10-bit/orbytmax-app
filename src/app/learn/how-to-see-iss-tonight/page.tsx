import Link from "next/link";
import { SectionHeader } from "@/components/neo-ui";

export const metadata = {
  title: "How to See the ISS Tonight",
  description: "A student-friendly guide to finding the International Space Station in the night sky.",
};

export default function IssTonightGuidePage() {
  return (
    <article className="learn-article mx-auto max-w-5xl px-4 py-10 sm:py-12">
      <SectionHeader
        eyebrow="Sky guide"
        title="How to see the ISS tonight"
        copy="The International Space Station looks like a bright moving star. It does not blink like an airplane, and it usually crosses the sky in a few minutes."
      />

      <div className="learn-article-grid mt-10">
        <section>
          <h2>1. Search your city</h2>
          <p>
            Open Sky Tonight, enter your city, and choose Tonight, 3 days, or 7 days. A high elevation pass is usually
            easier to see than one near the horizon.
          </p>
        </section>
        <section>
          <h2>2. Be outside early</h2>
          <p>
            Go outside about five minutes before the max time. Give your eyes a moment to adjust and avoid bright
            streetlights or phone brightness.
          </p>
        </section>
        <section>
          <h2>3. Follow the same satellite</h2>
          <p>
            Use Follow / View on the pass card. OrbytMax opens the live tracker on the same object, using its satellite
            identity instead of sending you to the wrong page.
          </p>
        </section>
      </div>

      <div className="learn-cta">
        <Link href="/sky-tonight" className="btn-primary">
          Find visible passes
        </Link>
        <Link href="/satellite/iss" className="btn-secondary">
          Learn about ISS
        </Link>
      </div>
    </article>
  );
}
