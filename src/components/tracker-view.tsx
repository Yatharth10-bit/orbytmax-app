"use client";

import dynamic from "next/dynamic";
import { TrackerSkeleton } from "@/components/tracker-skeleton";

const GlobeTracker = dynamic(
  () => import("@/components/globe-tracker").then((m) => m.GlobeTracker),
  { loading: () => <TrackerSkeleton />, ssr: false }
);

export function TrackerView() {
  return <GlobeTracker />;
}
