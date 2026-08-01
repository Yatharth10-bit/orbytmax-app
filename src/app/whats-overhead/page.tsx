import { SkyTonightClient } from "@/components/sky-tonight-client";

export const metadata = {
  title: "What's Overhead",
  description: "Find visible satellite passes over your city tonight and through the week.",
};

export default function WhatsOverheadPage() {
  return <SkyTonightClient />;
}

