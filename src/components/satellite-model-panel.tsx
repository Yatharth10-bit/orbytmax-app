"use client";

import dynamic from "next/dynamic";
import { LoadingSkeleton } from "@/components/neo-ui";

const SatelliteModel3D = dynamic(
  () => import("@/components/satellite-model-3d").then((mod) => mod.SatelliteModel3D),
  {
    ssr: false,
    loading: () => <LoadingSkeleton label="Loading 3D model" />,
  }
);

export function SatelliteModelPanel({
  attribution,
  fallbackType,
  modelUrl,
  name,
}: {
  attribution?: string;
  fallbackType?: string;
  modelUrl?: string | null;
  name?: string;
}) {
  return <SatelliteModel3D attribution={attribution} fallbackType={fallbackType} modelUrl={modelUrl} name={name} />;
}
