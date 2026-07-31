"use client";

import { useEffect, useState } from "react";

type TrackerPosition = {
  name: string;
};

type PositionPayload = {
  positions?: TrackerPosition[];
  updated?: string;
};

function formatUtc(value?: string) {
  const date = value ? new Date(value) : new Date();
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(date);
}

export function MiniOrbitHero() {
  const [satellite, setSatellite] = useState<TrackerPosition | null>(null);
  const [updated, setUpdated] = useState<string>();
  const [status, setStatus] = useState("Live Earth preview");
  const [clock, setClock] = useState("--:--:-- UTC");

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const res = await fetch("/api/tracker/positions?limit=1", { signal: controller.signal });
        const data = (await res.json()) as PositionPayload & { error?: string };
        if (!res.ok) throw new Error(data.error || "Live data unavailable");
        const first = data.positions?.[0] || null;
        setSatellite(first);
        setUpdated(data.updated);
        setStatus(first ? "Live orbital data" : "Earth rotation preview");
      } catch {
        if (!controller.signal.aborted) setStatus("Earth rotation preview");
      }
    }

    void load();
    const tick = () => setClock(formatUtc(updated));
    const dataTimer = window.setInterval(load, 90000);
    const clockTimer = window.setInterval(tick, 1000);
    tick();
    return () => {
      controller.abort();
      window.clearInterval(dataTimer);
      window.clearInterval(clockTimer);
    };
  }, [updated]);

  return (
    <div className="mini-orbit" role="img" aria-label="High quality rotating Earth preview">
      <div className="mini-orbit-stage">
        <div className="earth-hero-stars" />
        <div className="earth-hero-glow" />
        <div className="earth-hero-sphere">
          <span className="earth-hero-map" />
          <span className="earth-hero-clouds" />
          <span className="earth-hero-shade" />
        </div>
      </div>
      <div className="mini-orbit-caption">
        <span className="live-dot" />
        <span>{status}</span>
        <span className="data-readout">{satellite?.name || "Real Earth texture"}</span>
        <span className="data-readout">{clock}</span>
      </div>
    </div>
  );
}
