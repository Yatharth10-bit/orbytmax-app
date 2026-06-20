import type { Metadata } from "next";
import { BlackHoleVisualizer } from "@/components/black-hole-visualizer";

export const metadata: Metadata = {
  title: "Black Hole Visualizer",
  description: "An interactive guide to black holes, event horizons, accretion disks, and spacetime.",
};

export default function BlackHoleVisualizerPage() {
  return <BlackHoleVisualizer />;
}
