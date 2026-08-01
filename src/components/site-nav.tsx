"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const links = [
  { href: "/", label: "Home" },
  { href: "/tracker", label: "Tracker" },
  { href: "/whats-overhead", label: "What's Overhead" },
  { href: "/explore", label: "Explore" },
  { href: "/black-hole-explorer", label: "Black Hole Explorer" },
];

export function SiteNav() {
  const pathname = usePathname();
  const [utc, setUtc] = useState("");

  useEffect(() => {
    const update = () => {
      setUtc(
        new Intl.DateTimeFormat(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "UTC",
          timeZoneName: "short",
        }).format(new Date())
      );
    };
    update();
    const timer = window.setInterval(update, 60000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <header className="site-nav">
      <div className="site-nav-inner">
        <Link href="/" className="brand-wordmark site-brand">
          <span className="site-brand-mark">
            <span />
          </span>
          <span className="site-brand-text">OrbytMax</span>
        </Link>
        <nav className="site-nav-links" aria-label="Main">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              prefetch={link.href === "/tracker" || link.href === "/black-hole-explorer" ? false : undefined}
              className={`site-nav-link ${pathname === link.href || (link.href === "/explore" && ["/satellites", "/education", "/learn"].includes(pathname)) ? "is-active" : ""}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="site-nav-actions">
          <span className="mission-clock" aria-label="Current UTC mission clock">
            {utc || "--:-- UTC"}
          </span>
          <Link href="/newsletter" className="site-newsletter-cta text-sm">
            The Downlink
          </Link>
        </div>
      </div>
      <nav className="site-nav-mobile" aria-label="Mobile">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`site-nav-link ${pathname === link.href || (link.href === "/explore" && ["/satellites", "/education", "/learn"].includes(pathname)) ? "is-active" : ""}`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
