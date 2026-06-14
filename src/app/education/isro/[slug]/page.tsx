import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MissionDetail } from "@/components/mission-detail";
import { ISRO_MISSIONS, getMission } from "@/lib/education-content";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return ISRO_MISSIONS.map((mission) => ({ slug: mission.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const mission = getMission("isro", slug);
  if (!mission) return { title: "Mission not found" };
  return {
    title: mission.name,
    description: mission.purpose,
  };
}

export default async function IsroMissionDetailPage({ params }: Props) {
  const { slug } = await params;
  const mission = getMission("isro", slug);
  if (!mission) notFound();
  return <MissionDetail mission={mission} backHref="/education/isro" backLabel="ISRO Mission Library" />;
}
