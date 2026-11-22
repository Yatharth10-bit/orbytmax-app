"use client";
import { appFetch } from "@/lib/app-fetch";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/neo-ui";

type FeedItem = {
  id: string;
  title: string;
  summary: string;
  agency: string;
  missionType: string | null;
  orbitType: string | null;
  category: string;
  satellite: { slug: string } | null;
};

async function requestFeed(refresh = false) {
  const res = await appFetch(refresh ? "/api/feed/refresh" : "/api/feed", {
    method: refresh ? "POST" : "GET",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load feed");
  return data.items as FeedItem[];
}

export function FeedSection() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialFeed() {
      try {
        const nextItems = await requestFeed();
        if (!cancelled) {
          setItems(nextItems);
          setError("");
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Feed unavailable");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadInitialFeed();
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshFeed() {
    setError("");
    setRefreshing(true);
    try {
      setItems(await requestFeed(true));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Feed unavailable");
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }

  async function retryFeed() {
    setError("");
    setLoading(true);
    try {
      setItems(await requestFeed());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Feed unavailable");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-16" aria-labelledby="feed-title">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="neo-eyebrow">Discovery</p>
          <h2 id="feed-title" className="mt-4 text-3xl font-extrabold uppercase leading-none">
            Satellite feed
          </h2>
          <p className="mt-2 max-w-xl text-sm text-[var(--muted)]">
            Mixed missions from ISRO, NASA, ESA, and more. Refreshed from the backend.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={refreshFeed}
          disabled={refreshing}
          aria-busy={refreshing}
        >
          {refreshing ? "Refreshing..." : "Refresh feed"}
        </button>
      </div>

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <LoadingSkeleton key={i} label="Loading mission card" />
          ))}
        </div>
      )}

      {error && !loading && (
        <ErrorState
          message={error}
          action={
            <button type="button" className="btn-primary mt-4" onClick={retryFeed}>
              Retry
            </button>
          }
        />
      )}

      {!loading && !error && !items.length && (
        <EmptyState title="No feed items" message="Seed the database to show mission updates." />
      )}

      {!loading && !error && items.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <article key={item.id} className="card feed-card">
              <span className="sticker-tag">{item.agency || item.category}</span>
              <h3>{item.title}</h3>
              <p>{item.summary}</p>
              <div className="card-chip-row">
                {[item.missionType || item.category, item.orbitType || "Orbit"].slice(0, 2).map((chip) => (
                  <span key={chip} className="card-chip">
                    {chip}
                  </span>
                ))}
              </div>
              {item.satellite ? (
                <Link
                  href={`/satellite/${item.satellite.slug}`}
                  className="card-text-link mt-4"
                >
                  View details →
                </Link>
              ) : (
                <span className="card-text-link mt-4" aria-hidden="true">
                  Read update →
                </span>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
