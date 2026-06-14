import { OrbitQuizClient } from "@/components/orbit-quiz-client";
import { SectionHeader } from "@/components/neo-ui";

export const metadata = {
  title: "Orbit Basics Quiz",
  description: "Play a five-question orbit basics MCQ quiz.",
};

export default function OrbitBasicsQuizPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-12">
      <SectionHeader
        eyebrow="Quiz"
        title="Orbit basics quiz"
        copy="Five randomized questions per round. Pick an answer, get instant feedback, then try for Orbital Genius."
      />

      <div className="mt-10">
        <OrbitQuizClient />
      </div>
    </div>
  );
}
