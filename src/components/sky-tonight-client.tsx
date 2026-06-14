"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EmptyState, ErrorState, LoadingSkeleton, SectionHeader } from "@/components/neo-ui";

type Pass = {
  name: string;
  slug?: string;
  category: string;
  start: string;
  maxTime: string;
  maxElevation: number;
  durationSec?: number;
  brightness?: string;
  direction?: string;
};

type GeocodeResult = {
  label: string;
  lat: number;
  lng: number;
  source: string;
};

type LastRequest =
  | { mode: "city"; city: string }
  | { mode: "coords"; label: string; lat: number; lng: number };

const QUICK_CITIES = ["Bengaluru", "Mumbai", "Delhi", "Hyderabad", "Chennai", "New York", "London", "Tokyo"];

function formatPassTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatCountdown(value: string, now: number) {
  const diffMs = new Date(value).getTime() - now;
  if (diffMs <= 0) return "Now";
  const totalMinutes = Math.ceil(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes} min`;
  return `${hours} hr ${minutes} min`;
}

function formatDuration(seconds?: number) {
  if (!seconds) return "Unknown";
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
}

export function SkyTonightClient() {
  const [city, setCity] = useState("Bengaluru");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [resolved, setResolved] = useState<GeocodeResult | null>(null);
  const [passes, setPasses] = useState<Pass[]>([]);
  const [status, setStatus] = useState("Type a city and launch the search. Coordinates are optional.");
  const [error, setError] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [passesLoading, setPassesLoading] = useState(false);
  const [filter, setFilter] = useState("all");
  const [lastRequest, setLastRequest] = useState<LastRequest | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const cacheRef = useRef<Map<string, GeocodeResult>>(new Map());

  const loading = lookupLoading || passesLoading;

  const resolveCity = useCallback(async (value: string, quiet = false) => {
    const query = value.trim();
    if (query.length < 2) return null;
    const cacheKey = query.toLowerCase();
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setResolved(cached);
      if (!quiet) setStatus(`Using cached city match for ${cached.label}.`);
      return cached;
    }

    setLookupLoading(true);
    if (!quiet) setStatus(`Resolving ${query}...`);
    try {
      const res = await fetch(`/api/geocode?query=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "City lookup failed.");
      const match = data.location as GeocodeResult;
      cacheRef.current.set(cacheKey, match);
      setResolved(match);
      if (!quiet) setStatus(`Resolved ${match.label}.`);
      return match;
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Could not resolve that city. Try a nearby large city or use Advanced location.";
      if (!quiet) {
        setResolved(null);
        setError(message);
        setStatus(message);
      }
      return null;
    } finally {
      setLookupLoading(false);
    }
  }, []);

  const fetchPasses = useCallback(async (location: GeocodeResult, request: LastRequest) => {
    setPassesLoading(true);
    setError("");
    setStatus(`Finding visible passes near ${location.label}...`);
    try {
      const res = await fetch(`/api/passes?lat=${location.lat}&lng=${location.lng}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not fetch satellite passes.");
      const nextPasses = (data.passes || []) as Pass[];
      setPasses(nextPasses);
      setResolved(location);
      setLastRequest(request);
      setStatus(
        nextPasses.length
          ? `Found ${nextPasses.length} visible pass${nextPasses.length === 1 ? "" : "es"} near ${location.label}.`
          : `No visible satellites found near ${location.label} in the next 18 hours.`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not calculate passes for this location.";
      setError(message);
      setPasses([]);
      setStatus(message);
    } finally {
      setPassesLoading(false);
    }
  }, []);

  const searchByCity = useCallback(
    async (value = city) => {
      const match = await resolveCity(value);
      if (!match) return;
      await fetchPasses(match, { mode: "city", city: value.trim() });
    },
    [city, fetchPasses, resolveCity]
  );

  const searchByCoords = useCallback(async () => {
    const lat = Number(manualLat);
    const lng = Number(manualLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setError("Enter valid latitude and longitude, or search by city instead.");
      return;
    }
    const label = city.trim() || "Manual location";
    await fetchPasses({ label, lat, lng, source: "manual" }, { mode: "coords", label, lat, lng });
  }, [city, fetchPasses, manualLat, manualLng]);

  const retry = useCallback(async () => {
    if (!lastRequest) {
      await searchByCity(city);
      return;
    }
    if (lastRequest.mode === "city") {
      await searchByCity(lastRequest.city);
    } else {
      await fetchPasses(
        { label: lastRequest.label, lat: lastRequest.lat, lng: lastRequest.lng, source: "manual" },
        lastRequest
      );
    }
  }, [city, fetchPasses, lastRequest, searchByCity]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    const query = city.trim();
    if (query.length < 2) return;
    const handle = window.setTimeout(() => {
      void resolveCity(query, true);
    }, 450);
    return () => window.clearTimeout(handle);
  }, [city, resolveCity]);

  const filtered = useMemo(
    () =>
      passes.filter((p) => {
        if (filter === "all") return true;
        if (filter === "brightest") return p.maxElevation >= 30;
        return p.category === filter || p.name.toLowerCase().includes(filter);
      }),
    [filter, passes]
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <SectionHeader
        eyebrow="Sky Tonight"
        title="What can I see tonight?"
        copy="Search by city to estimate visible satellite passes. Exact coordinates are still available when you want precision."
      />

      <form
        className="mt-8 grid gap-4 rounded-[18px] border-2 border-[var(--border)] bg-[var(--paper)] p-4 shadow-[var(--shadow)]"
        onSubmit={(event) => {
          event.preventDefault();
          void searchByCity();
        }}
      >
        <label className="grid gap-2 text-sm font-extrabold" htmlFor="city-search">
          City
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input
              id="city-search"
              type="search"
              value={city}
              onChange={(event) => {
                setCity(event.target.value);
                setError("");
              }}
              placeholder="Try Bengaluru, Mumbai, New York..."
              className="neo-input text-sm"
              autoComplete="address-level2"
            />
            <button type="submit" className="btn-primary" disabled={loading || city.trim().length < 2}>
              {loading ? "Searching..." : "Find passes"}
            </button>
          </div>
        </label>

        <div className="flex flex-wrap gap-2" aria-label="Quick city searches">
          {QUICK_CITIES.map((item) => (
            <button
              key={item}
              type="button"
              className="rounded-full border-2 border-[var(--border)] bg-[#e9f7ff] px-3 py-1 font-mono text-xs font-bold"
              onClick={() => {
                setCity(item);
                void searchByCity(item);
              }}
              disabled={loading}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="rounded-[16px] border-2 border-[var(--border)] bg-white p-3">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 text-left font-extrabold"
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen((value) => !value)}
          >
            Advanced location
            <span className="font-mono text-xs">{advancedOpen ? "Hide" : "Show"}</span>
          </button>
          {advancedOpen && (
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <input
                value={manualLat}
                onChange={(event) => setManualLat(event.target.value)}
                type="number"
                step="0.0001"
                placeholder="Latitude"
                className="neo-input text-sm"
              />
              <input
                value={manualLng}
                onChange={(event) => setManualLng(event.target.value)}
                type="number"
                step="0.0001"
                placeholder="Longitude"
                className="neo-input text-sm"
              />
              <button type="button" className="btn-secondary" onClick={searchByCoords} disabled={loading}>
                Use coords
              </button>
            </div>
          )}
        </div>
      </form>

      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <p className="text-sm text-[var(--muted)]" role="status" aria-live="polite">
          {status}
          {resolved ? ` / ${resolved.label} (${resolved.lat.toFixed(2)}, ${resolved.lng.toFixed(2)})` : ""}
        </p>
        <button type="button" className="btn-secondary text-sm" onClick={retry} disabled={loading}>
          Retry
        </button>
      </div>

      {error && (
        <div className="mt-5">
          <ErrorState
            title="City lookup needs a better signal"
            message={error}
            action={
              <button type="button" className="btn-secondary mt-4" onClick={retry} disabled={loading}>
                Try again
              </button>
            }
          />
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Pass filters">
        {["all", "iss", "starlink", "isro", "brightest"].map((item) => (
          <button
            key={item}
            type="button"
            className={`rounded-full border-2 px-3 py-1 text-xs font-bold capitalize ${
              filter === item
                ? "border-[var(--border)] bg-[var(--accent-2)] text-[var(--text)]"
                : "border-[var(--border)] bg-white text-[var(--muted)]"
            }`}
            onClick={() => setFilter(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {passesLoading &&
          [1, 2, 3].map((item) => <LoadingSkeleton key={item} label="Calculating visible pass" />)}

        {!passesLoading && !error && lastRequest && passes.length === 0 && (
          <EmptyState
            title="No visible satellites found"
            message="Try another city, retry in a few minutes, or use precise coordinates from Advanced location."
            action={
              <button type="button" className="btn-secondary mt-4" onClick={retry}>
                Retry search
              </button>
            }
          />
        )}

        {!passesLoading && passes.length > 0 && filtered.length === 0 && (
          <EmptyState title="No matches for this filter" message="Switch back to All or search another city." />
        )}

        {!passesLoading &&
          filtered.map((pass, index) => (
            <article key={`${pass.name}-${pass.maxTime}-${index}`} className="pass-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <span className="sticker-tag">{pass.category}</span>
                <span className="pass-countdown">{formatCountdown(pass.maxTime, now)}</span>
              </div>
              <h2>{pass.name}</h2>
              <dl>
                <div>
                  <dt>Pass time</dt>
                  <dd>{formatPassTime(pass.maxTime)}</dd>
                </div>
                <div>
                  <dt>Direction</dt>
                  <dd>{pass.direction || "Best overhead arc"}</dd>
                </div>
                <div>
                  <dt>Visibility</dt>
                  <dd>{pass.brightness || `${pass.maxElevation} deg peak`}</dd>
                </div>
                <div>
                  <dt>Duration</dt>
                  <dd>{formatDuration(pass.durationSec)}</dd>
                </div>
              </dl>
              <Link href={pass.slug ? `/satellite/${pass.slug}` : "/tracker"} className="btn-primary mt-5 w-full">
                Follow / View
              </Link>
            </article>
          ))}
      </div>
    </div>
  );
}
