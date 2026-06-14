import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MissionDetail } from "@/components/mission-detail";
import { GLOBAL_MISSIONS, getMission } from "@/lib/education-content";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return GLOBAL_MISSIONS.map((mission) => ({ slug: mission.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const mission = getMission("global", slug);
  if (!mission) return { title: "Mission not found" };
  return {
    title: mission.name,
    description: mission.purpose,
  };
}

export default async function GlobalMissionDetailPage({ params }: Props) {
  const { slug } = await params;
  const mission = getMission("global", slug);
  if (!mission) notFound();
  return <MissionDetail mission={mission} backHref="/education/global" backLabel="NASA & Global Missions" />;
}
