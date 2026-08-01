import Link from "next/link";
import { SectionHeader } from "@/components/neo-ui";

export const metadata = {
  title: "For Teachers and Parents",
  description: "Classroom-safe ways to use OrbytMax for satellite tracking and space science learning.",
};

const classroomFlows = [
  {
    title: "10-minute sky warmup",
    copy: "Search the class city, pick the best visible pass, and ask students why high-elevation passes are easier to see.",
  },
  {
    title: "Orbit comparison lab",
    copy: "Open the tracker, select two satellites, and compare altitude, velocity, and orbit labels.",
  },
  {
    title: "Build-a-satellite discussion",
    copy: "Use Parts of a Satellite to connect solar panels, antennas, payloads, batteries, and thrusters to real mission jobs.",
  },
];

const rolloutSteps = [
  "Pick one city and one visible pass for the whole class.",
  "Have students open the same mission page, then compare orbit facts.",
  "End with the orbit quiz so the teacher can turn curiosity into recall.",
];

export default function TeachersPage() {
  return (
    <div className="teacher-page mx-auto max-w-6xl px-4 py-10 sm:py-12">
      <SectionHeader
        eyebrow="For adults"
        title="Teacher and parent mode"
        copy="Use OrbytMax as a guided space lab for students: observe a real pass, inspect spacecraft parts, compare orbits, then check understanding with a quiz."
      />

      <section className="teacher-mode-grid mt-10" aria-label="Classroom activity ideas">
        {classroomFlows.map((flow, index) => (
          <article key={flow.title}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <h2>{flow.title}</h2>
            <p>{flow.copy}</p>
          </article>
        ))}
      </section>

      <section className="teacher-checklist mt-8" aria-label="Safe learning checklist">
        <div>
          <h2>What makes it classroom friendly</h2>
          <ul>
            <li>Students stay inside OrbytMax for tracking, mission pages, and quizzes.</li>
            <li>Live tracker labels include NORAD IDs, source notes, altitude, and velocity.</li>
            <li>Short missions guide students toward action instead of passive scrolling.</li>
            <li>Calendar reminders help families plan real sky watching.</li>
          </ul>
        </div>
        <div className="teacher-actions">
          <Link href="/explore#education" className="btn-primary">
            Open explore hub
          </Link>
          <Link href="/explore#learn" className="btn-secondary">
            Read student guides
          </Link>
        </div>
      </section>

      <section className="teacher-checklist mt-8" aria-label="Teacher launch plan">
        <div>
          <h2>Use one teacher to reach a whole class</h2>
          <ul>
            {rolloutSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </div>
        <div className="teacher-actions">
          <Link href="/whats-overhead" className="btn-primary">
            Start with a pass
          </Link>
          <Link href="/education/quiz" className="btn-secondary">
            Open quiz
          </Link>
        </div>
      </section>
    </div>
  );
}
