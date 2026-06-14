import { SkyTonightClient } from "@/components/sky-tonight-client";

export const metadata = {
  title: "Sky Tonight",
  description: "Visible satellite passes for your location tonight.",
};

export default function SkyTonightPage() {
  return <SkyTonightClient />;
}
