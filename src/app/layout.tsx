import type { Metadata } from "next";
import { Space_Mono, Syne } from "next/font/google";
import { SiteNav } from "@/components/site-nav";
import { Providers } from "@/components/providers";
import "./globals.css";

const spaceMono = Space_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const syne = Syne({
  variable: "--font-space",
  subsets: ["latin"],
  weight: ["400", "600", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "OrbytMax - Real-Time Satellite Tracker",
    template: "%s - OrbytMax",
  },
  description:
    "Track satellites in real time, see what is visible tonight, explore ISRO and global missions, and learn with interactive 3D models.",
  openGraph: {
    title: "OrbytMax - Satellite Tracker",
    description: "Explore satellites, passes, and space education.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${syne.variable} ${spaceMono.variable}`}>
      <body className="starfield font-sans antialiased">
        <Providers>
          <SiteNav />
          <main className="min-h-[calc(100vh-4rem)]">{children}</main>
          <footer className="border-t-2 border-[var(--border)] bg-[var(--paper)] py-8 text-center font-mono text-xs font-bold text-[var(--muted)]">
            OrbytMax / Space tracker and education / by Yatharth
          </footer>
        </Providers>
      </body>
    </html>
  );
}
