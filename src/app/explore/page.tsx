import { ExploreCatalog } from "@/components/explore-catalog";
import { getSatellitesList } from "@/lib/satellite-service";
export const metadata = {
  title: "Explore",
  description:
    "Browse OrbytMax satellites, education activities, and student space guides from one playful learning hub.",
};

export const dynamic = "force-dynamic";

export default async function ExplorePage() { return <ExploreCatalog satellites={await getSatellitesList(undefined, { preferEmbedded: true })} />; }
