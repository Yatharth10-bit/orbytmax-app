"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

type SatPoint = {
  name: string;
  lat: number;
  lon: number;
  alt: number;
  category: string;
};

type PositionPayload = {
  positions?: SatPoint[];
  source?: string;
  updated?: string;
};

const SESSION_KEY = "orbytmax_tracker_positions_v1";
const SESSION_TTL_MS = 2 * 60 * 1000;

const FILTERS = [
  { id: "all", label: "All" },
  { id: "iss", label: "ISS" },
  { id: "starlink", label: "Starlink" },
  { id: "navigation", label: "Navigation" },
  { id: "weather", label: "Weather" },
  { id: "isro", label: "ISRO" },
  { id: "nasa", label: "NASA" },
];

const CATEGORY_COLORS: Record<string, number> = {
  iss: 0xffffff,
  starlink: 0x7dd3fc,
  navigation: 0xa7f3d0,
  weather: 0xfde68a,
  isro: 0xfb923c,
  nasa: 0xc4b5fd,
  scientific: 0x67e8f9,
};

const EARTH_TEXTURES = {
  map: "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg",
  specular: "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_specular_2048.jpg",
  clouds: "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_clouds_1024.png",
};

function readSessionCache(): SatPoint[] | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const { at, positions } = JSON.parse(raw) as { at: number; positions: SatPoint[] };
    if (Date.now() - at > SESSION_TTL_MS) return null;
    return positions;
  } catch {
    return null;
  }
}

function writeSessionCache(positions: SatPoint[]) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ at: Date.now(), positions }));
  } catch {
    /* Storage can be disabled or full; the tracker still works without it. */
  }
}

function formatUpdated(value?: string) {
  if (!value) return "now";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

async function fetchPositions(limit: number, refresh = false, signal?: AbortSignal) {
  const suffix = refresh ? "&refresh=1" : "";
  const res = await fetch(`/api/tracker/positions?limit=${limit}${suffix}`, { signal });
  const data = (await res.json()) as PositionPayload & { error?: string };
  if (!res.ok) throw new Error(data.error || "Failed to load positions");

  return {
    positions: data.positions || [],
    source: data.source || "orbital data",
    updated: data.updated,
  };
}

function displayRadius(altKm: number) {
  const compressed = Math.log10(Math.max(1, altKm) + 1) / 8;
  return 1.08 + Math.min(0.52, compressed);
}

function toVector(lat: number, lon: number, altKm: number) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const radius = displayRadius(altKm);
  return [
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  ] as const;
}

const SatelliteListItem = memo(function SatelliteListItem({
  sat,
  isSelected,
  isFollowed,
  onSelect,
  onFollowToggle,
}: {
  sat: SatPoint;
  isSelected: boolean;
  isFollowed: boolean;
  onSelect: (sat: SatPoint) => void;
  onFollowToggle: (sat: SatPoint) => void;
}) {
  return (
    <div className={`tracker-list-item ${isSelected ? "is-selected" : ""} ${isFollowed ? "is-followed" : ""}`}>
      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelect(sat)}>
        <span className="block font-bold">{sat.name}</span>
        <small>{sat.category}</small>
      </button>
      <div className="tracker-list-actions">
        <button type="button" className="tracker-follow-btn" onClick={() => onFollowToggle(sat)}>
          {isFollowed ? "Unfollow" : "Follow"}
        </button>
      </div>
    </div>
  );
});

function clearGroup(group: import("three").Group) {
  while (group.children.length) {
    const child = group.children[0] as import("three").Object3D & {
      geometry?: import("three").BufferGeometry;
      material?: import("three").Material | import("three").Material[];
    };
    group.remove(child);
    child.geometry?.dispose();
    if (Array.isArray(child.material)) {
      child.material.forEach((m) => m.dispose());
    } else {
      child.material?.dispose();
    }
  }
}

export function GlobeTracker() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("Starting globe...");
  const [earthStatus, setEarthStatus] = useState("Loading Earth...");
  const [source, setSource] = useState("embedded fallback");
  const [updated, setUpdated] = useState<string>();
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [isPaused, setIsPaused] = useState(false);
  const [selected, setSelected] = useState<SatPoint | null>(null);
  const [followed, setFollowed] = useState<SatPoint | null>(null);
  const [positions, setPositions] = useState<SatPoint[]>(() => readSessionCache() || []);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const rotationRef = useRef({ x: 0.22, y: -0.42, zoom: 3.15 });
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const rebuildRef = useRef<(() => void) | null>(null);
  const visibleRef = useRef<SatPoint[]>([]);
  const selectedRef = useRef<SatPoint | null>(null);
  const followedRef = useRef<SatPoint | null>(null);
  const pausedRef = useRef(false);
  const positionsRef = useRef<SatPoint[]>(positions);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return positions
      .filter((sat) => filter === "all" || sat.category === filter)
      .filter((sat) => !needle || sat.name.toLowerCase().includes(needle))
      .slice(0, 400);
  }, [filter, positions, query]);

  const categoryCounts = useMemo(() => {
    return positions.reduce<Record<string, number>>((acc, sat) => {
      acc[sat.category] = (acc[sat.category] || 0) + 1;
      return acc;
    }, {});
  }, [positions]);

  useEffect(() => {
    visibleRef.current = visible;
    selectedRef.current = selected;
    followedRef.current = followed;
    pausedRef.current = isPaused;
    positionsRef.current = positions;
    rebuildRef.current?.();
  }, [followed, isPaused, positions, selected, visible]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let animId = 0;
    let renderer: import("three").WebGLRenderer | null = null;
    const ctrl = new AbortController();

    const boot = async () => {
      const THREE = await import("three");
      if (disposed) return;

      const isMobile = window.matchMedia("(max-width: 768px)").matches;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(43, mount.clientWidth / mount.clientHeight, 0.1, 100);
      camera.position.z = rotationRef.current.zoom;

      renderer = new THREE.WebGLRenderer({ antialias: !isMobile, alpha: true, powerPreference: "high-performance" });
      renderer.setClearColor(0x000000, 0);
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.4 : 1.8));
      mount.appendChild(renderer.domElement);

      const globe = new THREE.Group();
      globe.rotation.x = rotationRef.current.x;
      globe.rotation.y = rotationRef.current.y;
      scene.add(globe);

      const earthMaterial = new THREE.MeshStandardMaterial({
        color: 0x102235,
        emissive: 0x04111c,
        roughness: 0.72,
        metalness: 0.08,
      });
      const earth = new THREE.Mesh(new THREE.SphereGeometry(1, isMobile ? 48 : 96, isMobile ? 48 : 96), earthMaterial);
      globe.add(earth);

      const textureLoader = new THREE.TextureLoader();
      textureLoader.setCrossOrigin("anonymous");
      textureLoader.load(
        EARTH_TEXTURES.map,
        (texture) => {
          if (disposed) {
            texture.dispose();
            return;
          }
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = renderer?.capabilities.getMaxAnisotropy() || 1;
          earthMaterial.map = texture;
          earthMaterial.color.set(0xffffff);
          earthMaterial.needsUpdate = true;
          setEarthStatus("Real Earth texture loaded");
        },
        undefined,
        () => setEarthStatus("Earth texture unavailable; using fallback globe")
      );

      textureLoader.load(EARTH_TEXTURES.specular, (texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }
        earthMaterial.roughnessMap = texture;
        earthMaterial.needsUpdate = true;
      });

      const clouds = new THREE.Mesh(
        new THREE.SphereGeometry(1.012, isMobile ? 36 : 64, isMobile ? 36 : 64),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.22, depthWrite: false })
      );
      textureLoader.load(EARTH_TEXTURES.clouds, (texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        clouds.material.map = texture;
        clouds.material.needsUpdate = true;
        globe.add(clouds);
      });

      const grid = new THREE.Mesh(
        new THREE.SphereGeometry(1.004, 32, 16),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true, transparent: true, opacity: 0.12 })
      );
      globe.add(grid);

      const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(1.045, 48, 48),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.08 })
      );
      globe.add(atmosphere);

      const orbitMaterial = new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.22 });
      [1.16, 1.36, 1.58].forEach((radius) => {
        const curve = new THREE.EllipseCurve(0, 0, radius, radius);
        const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(160));
        const ring = new THREE.LineLoop(geometry, orbitMaterial.clone());
        ring.rotation.x = Math.PI / 2;
        globe.add(ring);
      });

      const pointsGroup = new THREE.Group();
      const selectedGroup = new THREE.Group();
      globe.add(pointsGroup, selectedGroup);

      const starPositions: number[] = [];
      for (let i = 0; i < 420; i++) {
        const radius = 4 + Math.random() * 5;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        starPositions.push(
          radius * Math.sin(phi) * Math.cos(theta),
          radius * Math.sin(phi) * Math.sin(theta),
          radius * Math.cos(phi)
        );
      }
      const starGeometry = new THREE.BufferGeometry();
      starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
      scene.add(
        new THREE.Points(
          starGeometry,
          new THREE.PointsMaterial({ color: 0xb6d7ff, size: 0.008, transparent: true, opacity: 0.75 })
        )
      );

      scene.add(new THREE.AmbientLight(0x7dd3fc, 0.5));
      const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
      keyLight.position.set(4, 2, 5);
      scene.add(keyLight);
      const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.1);
      rimLight.position.set(-3, -1, -3);
      scene.add(rimLight);

      rebuildRef.current = () => {
        clearGroup(pointsGroup);
        clearGroup(selectedGroup);

        const currentVisible = visibleRef.current;
        if (!currentVisible.length) return;

        const pointPositions: number[] = [];
        const pointColors: number[] = [];
        currentVisible.forEach((sat) => {
          pointPositions.push(...toVector(sat.lat, sat.lon, sat.alt));
          const color = new THREE.Color(CATEGORY_COLORS[sat.category] || CATEGORY_COLORS.scientific);
          pointColors.push(color.r, color.g, color.b);
        });

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(pointPositions, 3));
        geometry.setAttribute("color", new THREE.Float32BufferAttribute(pointColors, 3));
        pointsGroup.add(
          new THREE.Points(
            geometry,
            new THREE.PointsMaterial({ size: isMobile ? 0.028 : 0.022, vertexColors: true, transparent: true, opacity: 0.95 })
          )
        );

        const selectedSat = followedRef.current || selectedRef.current;
        const focused = selectedSat && currentVisible.find((sat) => sat.name === selectedSat.name);
        if (focused) {
          const [x, y, z] = toVector(focused.lat, focused.lon, focused.alt);
          const marker = new THREE.Mesh(
            new THREE.SphereGeometry(followedRef.current ? 0.05 : 0.035, 18, 18),
            new THREE.MeshBasicMaterial({ color: followedRef.current ? 0xff5fa2 : 0xffffff })
          );
          marker.position.set(x, y, z);
          selectedGroup.add(marker);
        }
      };
      rebuildRef.current();

      const onResize = () => {
        camera.aspect = mount.clientWidth / mount.clientHeight;
        camera.updateProjectionMatrix();
        renderer?.setSize(mount.clientWidth, mount.clientHeight);
      };
      window.addEventListener("resize", onResize);

      const animate = () => {
        if (!pausedRef.current) {
          rotationRef.current.y += 0.0012;
          clouds.rotation.y += 0.0005;
        }
        globe.rotation.x = rotationRef.current.x;
        globe.rotation.y = rotationRef.current.y;
        camera.position.z = rotationRef.current.zoom;
        renderer?.render(scene, camera);
        animId = requestAnimationFrame(animate);
      };
      animate();

      fetchPositions(160, false, ctrl.signal)
        .then((payload) => {
          if (disposed) return;
          setPositions(payload.positions);
          writeSessionCache(payload.positions);
          setSource(payload.source);
          setUpdated(payload.updated);
          setStatus(`Tracking ${payload.positions.length} objects`);
        })
        .catch(() => {
          if (!disposed) setStatus("Using cached orbital data");
        });

      fetchPositions(350, false, ctrl.signal)
        .then((payload) => {
          if (disposed || payload.positions.length < positionsRef.current.length) return;
          setPositions(payload.positions);
          writeSessionCache(payload.positions);
          setSource(payload.source);
          setUpdated(payload.updated);
          setStatus(`Tracking ${payload.positions.length} objects`);
        })
        .catch(() => {
          /* The initial paint already has cached or fallback data. */
        });

      return () => {
        ctrl.abort();
        window.removeEventListener("resize", onResize);
        cancelAnimationFrame(animId);
        clearGroup(pointsGroup);
        clearGroup(selectedGroup);
        earth.geometry.dispose();
        earthMaterial.map?.dispose();
        earthMaterial.roughnessMap?.dispose();
        earthMaterial.dispose();
        clouds.geometry.dispose();
        clouds.material.map?.dispose();
        clouds.material.dispose();
        renderer?.dispose();
        if (renderer?.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
      };
    };

    let sceneCleanup: (() => void) | undefined;
    boot().then((cleanup) => {
      sceneCleanup = cleanup;
    });

    return () => {
      disposed = true;
      sceneCleanup?.();
    };
  }, []);

  const focusSatellite = useCallback((sat: SatPoint) => {
    const latRad = sat.lat * (Math.PI / 180);
    const lonRad = sat.lon * (Math.PI / 180);
    rotationRef.current.x = Math.max(-0.85, Math.min(0.85, -latRad * 0.75));
    rotationRef.current.y = -lonRad - Math.PI / 2;
    rotationRef.current.zoom = 2.55;
    setSelected(sat);
  }, []);

  const followSatellite = useCallback((sat: SatPoint) => {
    setFollowed(sat);
    setIsPaused(true);
    focusSatellite(sat);
  }, [focusSatellite]);

  const resetFollow = useCallback(() => {
    setFollowed(null);
    setSelected(null);
    setIsPaused(false);
    rotationRef.current = { x: 0.22, y: -0.42, zoom: 3.15 };
  }, []);

  const toggleFollow = useCallback((sat: SatPoint) => {
    if (followed?.name === sat.name) resetFollow();
    else followSatellite(sat);
  }, [followSatellite, followed?.name, resetFollow]);

  async function refresh() {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setRefreshError("");
    setStatus("Refreshing orbital data...");
    try {
      const payload = await fetchPositions(350, true);
      const offset = payload.positions.length > 1 ? Math.floor(Math.random() * Math.min(24, payload.positions.length)) : 0;
      const rotated = [...payload.positions.slice(offset), ...payload.positions.slice(0, offset)];
      setPositions(rotated);
      writeSessionCache(rotated);
      setSource(payload.source);
      setUpdated(payload.updated);
      setStatus(`Refreshed ${rotated.length} objects`);
      if (followed) {
        const nextFollowed = rotated.find((sat) => sat.name === followed.name);
        if (nextFollowed) focusSatellite(nextFollowed);
      }
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : "Refresh failed");
      setStatus("Refresh failed; showing cached data");
    } finally {
      setIsRefreshing(false);
    }
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    dragRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const dx = event.clientX - dragRef.current.x;
    const dy = event.clientY - dragRef.current.y;
    rotationRef.current.y += dx * 0.006;
    rotationRef.current.x = Math.max(-0.85, Math.min(0.85, rotationRef.current.x + dy * 0.004));
    dragRef.current = { x: event.clientX, y: event.clientY };
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  const activeSatellite = followed || selected || visible[0] || null;

  return (
    <section className="tracker-shell">
      <div className="tracker-toolbar">
        <div>
          <p className="font-mono text-[0.68rem] uppercase text-[var(--accent)]">Live map</p>
          <p className="mt-1 text-sm text-[var(--muted)]" role="status">
            {status} / showing {visible.length} / updated {formatUpdated(updated)}
          </p>
        </div>
        <div className="tracker-actions">
          <button type="button" className="tracker-icon-btn" onClick={() => setIsPaused((value) => !value)}>
            {isPaused ? "Resume" : "Pause"}
          </button>
          <button type="button" className="tracker-icon-btn" onClick={() => (rotationRef.current.zoom = Math.max(2.35, rotationRef.current.zoom - 0.22))}>
            Zoom in
          </button>
          <button type="button" className="tracker-icon-btn" onClick={() => (rotationRef.current.zoom = Math.min(4.2, rotationRef.current.zoom + 0.22))}>
            Zoom out
          </button>
          <button type="button" className="tracker-refresh" onClick={refresh} disabled={isRefreshing}>
            {isRefreshing ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </div>

      <div className="tracker-layout">
        <div
          ref={mountRef}
          className="tracker-canvas"
          role="img"
          aria-label="Interactive 3D globe with live satellite positions"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="tracker-canvas-status">{earthStatus}</div>
        </div>

        <aside className="tracker-panel" aria-label="Satellite controls">
          {refreshError && (
            <div className="tracker-error" role="alert">
              <p>{refreshError}</p>
              <button type="button" className="tracker-follow-btn mt-2" onClick={refresh} disabled={isRefreshing}>
                Retry
              </button>
            </div>
          )}

          <label className="tracker-search">
            <span>Search</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ISS, NOAA, Cartosat..." />
          </label>

          <div className="tracker-filters" role="group" aria-label="Satellite filters">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={filter === item.id ? "is-active" : ""}
                onClick={() => setFilter(item.id)}
              >
                <span>{item.label}</span>
                <small>{item.id === "all" ? positions.length : categoryCounts[item.id] || 0}</small>
              </button>
            ))}
          </div>

          {activeSatellite && (
            <div className="tracker-selected">
              <p className="font-mono text-[0.68rem] uppercase text-[var(--accent)]">Selected</p>
              <h2>{activeSatellite.name}</h2>
              <dl>
                <div>
                  <dt>Latitude</dt>
                  <dd>{activeSatellite.lat.toFixed(2)}</dd>
                </div>
                <div>
                  <dt>Longitude</dt>
                  <dd>{activeSatellite.lon.toFixed(2)}</dd>
                </div>
                <div>
                  <dt>Altitude</dt>
                  <dd>{Math.round(activeSatellite.alt).toLocaleString()} km</dd>
                </div>
              </dl>
              <p className="tracker-source">Source: {source}</p>
              <div className="model-controls">
                {followed?.name === activeSatellite.name ? (
                  <button type="button" onClick={resetFollow}>
                    Reset view
                  </button>
                ) : (
                  <button type="button" onClick={() => followSatellite(activeSatellite)}>
                    Follow
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="tracker-list" aria-label="Visible satellites">
            {visible.slice(0, 9).map((sat) => (
              <SatelliteListItem
                key={`${sat.name}-${sat.lat}-${sat.lon}`}
                sat={sat}
                isSelected={selected?.name === sat.name}
                isFollowed={followed?.name === sat.name}
                onSelect={setSelected}
                onFollowToggle={toggleFollow}
              />
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
