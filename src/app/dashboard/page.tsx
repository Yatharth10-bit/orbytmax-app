"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { EmptyState, LoadingSkeleton, SectionHeader } from "@/components/neo-ui";

type DashboardData = {
  followed: { name: string; slug: string }[];
  favorites: { name: string; slug: string }[];
  recommended: { name: string; slug: string }[];
  recentlyViewed: { name: string; slug: string }[];
  nextPasses: { name: string; maxTime: string }[];
  location: { label: string | null; lat: number; lng: number } | null;
};

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/user/dashboard")
      .then((response) => response.json())
      .then((payload) => {
        if (payload.error) setError(payload.error);
        else setData(payload);
      })
      .catch(() => setError("Failed to load dashboard"));
  }, [status]);

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <LoadingSkeleton label="Loading dashboard" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <EmptyState
          title="Sign in required"
          message="Sign in to view followed satellites, favorites, and pass alerts."
          action={
            <Link href="/auth/login" className="btn-primary mt-6 inline-flex">
              Sign in
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <SectionHeader
        eyebrow="Dashboard"
        title={`Welcome ${session.user?.name || "Explorer"}`}
        copy="Followed satellites, passes, favorites, and mission suggestions."
      />
      {error && <p className="mt-6 rounded-[14px] border-2 border-[var(--border)] bg-[#fff0f0] p-3 font-bold text-[var(--danger)]">{error}</p>}
      {!data && !error && (
        <div className="mt-8">
          <LoadingSkeleton label="Loading your space" />
        </div>
      )}
      {data && (
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <section className="card bg-[#e9f7ff]">
            <span className="sticker-tag">Following</span>
            <h2 className="mt-4 text-xl font-extrabold uppercase leading-none">Followed satellites</h2>
            <ul className="mt-4 space-y-2 text-sm font-bold">
              {data.followed.length ? (
                data.followed.map((satellite) => (
                  <li key={satellite.slug}>
                    <Link href={`/satellite/${satellite.slug}`} className="underline">
                      {satellite.name}
                    </Link>
                  </li>
                ))
              ) : (
                <li className="text-[var(--muted)]">Follow satellites from the live map or mission pages.</li>
              )}
            </ul>
          </section>

          <section className="card bg-[#fff9e8]">
            <span className="sticker-tag">Passes</span>
            <h2 className="mt-4 text-xl font-extrabold uppercase leading-none">Next passes</h2>
            <ul className="mt-4 space-y-2 text-sm text-[var(--muted)]">
              {data.nextPasses?.length ? (
                data.nextPasses.map((pass, index) => (
                  <li key={`${pass.name}-${index}`}>
                    {pass.name} / {new Date(pass.maxTime).toLocaleString()}
                  </li>
                ))
              ) : (
                <li>
                  <Link href="/sky-tonight" className="font-bold underline">
                    Set location in Sky Tonight
                  </Link>
                </li>
              )}
            </ul>
          </section>

          <section className="card bg-[#eaffdf]">
            <span className="sticker-tag">Missions</span>
            <h2 className="mt-4 text-xl font-extrabold uppercase leading-none">Recommended</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {data.recommended.map((satellite) => (
                <Link key={satellite.slug} href={`/satellite/${satellite.slug}`} className="btn-secondary text-xs">
                  {satellite.name}
                </Link>
              ))}
            </ul>
          </section>

          <section className="card bg-[#fff0f7]">
            <span className="sticker-tag">Saved</span>
            <h2 className="mt-4 text-xl font-extrabold uppercase leading-none">Favorites</h2>
            <ul className="mt-4 space-y-2 text-sm font-bold">
              {data.favorites.length ? (
                data.favorites.map((satellite) => (
                  <li key={satellite.slug}>
                    <Link href={`/satellite/${satellite.slug}`} className="underline">
                      {satellite.name}
                    </Link>
                  </li>
                ))
              ) : (
                <li className="text-[var(--muted)]">Saved satellites will appear here.</li>
              )}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
