import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OrbytMax",
    short_name: "OrbytMax",
    description: "Real-time satellite tracking, visible passes, mission libraries, and space education.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f0dc",
    theme_color: "#ffcf24",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
