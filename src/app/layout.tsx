import type { Metadata } from "next";
import localFont from "next/font/local";
import { SiteNav } from "@/components/site-nav";
import { Providers } from "@/components/providers";
import "./globals.css";
import "./learning.css";
import "./missions.css";

const display = localFont({ src: "./fonts/Syne.ttf", variable: "--font-display", weight: "400 800" });
const mono = localFont({
  src: [
    { path: "./fonts/SpaceMono-Regular.ttf", weight: "400" },
    { path: "./fonts/SpaceMono-Bold.ttf", weight: "700" },
  ],
  variable: "--font-terminal",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://orbytmax.com"),
  title: {
    default: "OrbytMax - Satellite Tracker for Students",
    template: "%s - OrbytMax",
  },
  description:
    "A playful satellite tracker for students. Track live satellites, see visible passes tonight, explore ISRO and NASA missions, and learn space science with interactive tools.",
  keywords: [
    "satellite tracker",
    "live satellite map",
    "visible satellite passes",
    "space education",
    "ISRO missions",
    "NASA missions",
    "students space science",
  ],
  applicationName: "OrbytMax",
  authors: [{ name: "OrbytMax" }],
  creator: "OrbytMax",
  publisher: "OrbytMax",
  category: "education",
  openGraph: {
    title: "OrbytMax - Satellite Tracker for Students",
    description: "Track satellites, find tonight's visible passes, and learn orbit science through playful student tools.",
    siteName: "OrbytMax",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "OrbytMax satellite tracker for students with Earth and orbiting satellites",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "OrbytMax - Satellite Tracker for Students",
    description: "Live satellite tracking, visible passes, and space learning tools for students.",
    images: ["/og.png"],
  },
  alternates: {
    canonical: "/",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "OrbytMax",
    url: process.env.NEXT_PUBLIC_SITE_URL || "https://orbytmax.com",
    description:
      "A playful satellite tracker for students with live satellite maps, visible pass predictions, mission libraries, and space education tools.",
    audience: {
      "@type": "EducationalAudience",
      educationalRole: "student",
    },
    publisher: {
      "@type": "Organization",
      name: "OrbytMax",
    },
    potentialAction: {
      "@type": "SearchAction",
      target: `${process.env.NEXT_PUBLIC_SITE_URL || "https://orbytmax.com"}/explore?query={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${display.variable} ${mono.variable}`}>
      <body className="starfield font-sans antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <Providers>
          <SiteNav />
          <main className="min-h-[calc(100vh-4rem)]">{children}</main>
          <footer className="site-footer">
            <div className="site-footer-inner">
              <div>
                <strong>OrbytMax</strong>
                <span>Space, made easier to explore.</span>
              </div>
              <nav aria-label="Footer">
                <a href="/teachers">Teachers</a>
                <a href="/newsletter">The Downlink</a>
                <a href="/privacy">Privacy</a>
              </nav>
              <small>Built by Yatharth</small>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
