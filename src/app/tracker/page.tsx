import { TrackerView } from "@/components/tracker-view";
import { SectionHeader } from "@/components/neo-ui";

export const metadata = {
  title: "Satellite Tracker",
  description: "Real-time satellite positions on an interactive globe.",
};

export default function TrackerPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <SectionHeader
        eyebrow="Tracker"
        title="Live satellite map"
        copy="Refresh live orbital data, follow one object, and keep the 3D globe usable on small screens."
      />
      <div className="mt-8">
        <TrackerView />
      </div>
    </div>
  );
}
