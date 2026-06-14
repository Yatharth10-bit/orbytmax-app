"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const links = [
  { href: "/", label: "Home" },
  { href: "/tracker", label: "Tracker" },
  { href: "/sky-tonight", label: "Sky Tonight" },
  { href: "/satellites", label: "Satellites" },
  { href: "/education", label: "Education" },
];

export function SiteNav() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-50 border-b-2 border-[var(--border)] bg-[var(--paper)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="brand-wordmark flex items-center gap-2 font-extrabold text-[var(--text)]">
          <span className="inline-block h-4 w-4 rounded-full border-2 border-[var(--border)] bg-[var(--accent-2)]" />
          OrbytMax
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              prefetch={link.href === "/tracker" ? true : undefined}
              className={`rounded-full border-2 px-3 py-1.5 text-sm font-bold transition-colors ${
                pathname === link.href
                  ? "border-[var(--border)] bg-[var(--accent-2)] text-[var(--text)]"
                  : "border-transparent text-[var(--muted)] hover:text-[var(--text)]"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {session?.user ? (
            <>
              <Link href="/dashboard" className="btn-secondary hidden text-sm sm:inline-flex">
                Dashboard
              </Link>
              <button type="button" onClick={() => signOut()} className="btn-secondary text-sm">
                Sign out
              </button>
            </>
          ) : (
            <Link href="/auth/login" className="btn-primary text-sm">
              Sign in
            </Link>
          )}
        </div>
      </div>
      <nav className="flex gap-2 overflow-x-auto border-t-2 border-[var(--border)] px-4 py-2 md:hidden" aria-label="Mobile">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`shrink-0 rounded-full border-2 px-3 py-1 text-xs font-bold ${
              pathname === link.href
                ? "border-[var(--border)] bg-[var(--accent-2)] text-[var(--text)]"
                : "border-transparent text-[var(--muted)]"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
