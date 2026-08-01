import Link from "next/link";
import { SectionHeader } from "@/components/neo-ui";
import { NEWSLETTER } from "@/lib/newsletter";

export const metadata = {
  title: "Privacy",
  description: "How OrbytMax handles newsletter email addresses and student-friendly site data.",
};

export default function PrivacyPage() {
  return (
    <div className="privacy-page mx-auto max-w-4xl px-4 py-10 sm:py-12">
      <SectionHeader
        eyebrow="Privacy"
        title="Simple privacy note"
        copy="OrbytMax is built for students, so the newsletter asks for as little information as possible."
      />

      <section className="privacy-card mt-10">
        <h2>{NEWSLETTER.name}</h2>
        <p>
          The newsletter form collects an email address so OrbytMax can send space articles, satellite notes,
          sky-watching ideas, and student activities. It does not require an account.
        </p>
        <p>
          We use the email only for OrbytMax updates. Newsletter provider keys stay on the server, and signup forms
          include basic spam protection.
        </p>
        <p>
          If a student is under 18, they should join only with a parent, guardian, or teacher&apos;s permission. OrbytMax
          does not ask students to create accounts for the learning tools.
        </p>
        <p>
          Every production newsletter should include an unsubscribe link from the email provider. You can leave the
          list anytime.
        </p>
        <Link href="/newsletter" className="btn-secondary">
          Back to The Downlink
        </Link>
      </section>
    </div>
  );
}
