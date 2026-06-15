"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildSatelliteRuntime,
  categoryColorInt,
  categoryEmoji,
  drawMiniMap,
  EARTH_RADIUS_3D,
  geoTo3D,
  orbitTypeLabel,
  propagateToGeodetic,
  spriteCategory,
  type SatelliteRuntime,
  type TrackerSatellite,
} from "@/lib/tracker-globe";

type VisibleSatellite = SatelliteRuntime & { index: number };

type PositionPayload = {
  positions?: TrackerSatellite[];
  source?: string;
  updated?: string;
};

const SESSION_KEY = "orbytmax_tracker_positions_v2";
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

const EARTH_TEXTURES = {
  map: "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg",
  specular: "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_specular_2048.jpg",
  clouds: "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_clouds_1024.png",
};

type OrbitControls = {
  target: import("three").Vector3;
  spherical: import("three").Spherical;
  isDragging: boolean;
  lastMouse: { x: number; y: number };
  zoomSpeed: number;
  rotateSpeed: number;
  dampingFactor: number;
  velocity: { theta: number; phi: number };
  autoRotate: boolean;
  autoRotateSpeed: number;
  targetRadius: number;
};

function readSessionCache(): TrackerSatellite[] | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const { at, positions } = JSON.parse(raw) as { at: number; positions: TrackerSatellite[] };
    if (Date.now() - at > SESSION_TTL_MS) return null;
    return positions;
  } catch {
    return null;
  }
}

function writeSessionCache(positions: TrackerSatellite[]) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ at: Date.now(), positions }));
  } catch {
    /* Storage can be disabled or full. */
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

function toRuntimeList(entries: TrackerSatellite[]) {
  return entries.map(buildSatelliteRuntime).filter((entry): entry is SatelliteRuntime => Boolean(entry));
}

const SatelliteListItem = memo(function SatelliteListItem({
  sat,
  isSelected,
  isFollowed,
  onSelect,
  onFollowToggle,
}: {
  sat: VisibleSatellite;
  isSelected: boolean;
  isFollowed: boolean;
  onSelect: (index: number) => void;
  onFollowToggle: (index: number) => void;
}) {
  return (
    <div className={`tracker-list-item ${isSelected ? "is-selected" : ""} ${isFollowed ? "is-followed" : ""}`}>
      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelect(sat.index)}>
        <span className="tracker-list-emoji">{categoryEmoji(sat.category)}</span>
        <span className="block font-bold">{sat.name}</span>
        <small>
          {sat.category} · #{sat.norad}
        </small>
      </button>
      <div className="tracker-list-actions">
        <button type="button" className="tracker-follow-btn" onClick={() => onFollowToggle(sat.index)}>
          {isFollowed ? "Unfollow" : "Follow"}
        </button>
      </div>
    </div>
  );
});

export function GlobeTracker() {
  const mountRef = useRef<HTMLDivElement>(null);
  const miniMapRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("Starting globe...");
  const [earthStatus, setEarthStatus] = useState("Loading Earth...");
  const [source, setSource] = useState("embedded fallback");
  const [updated, setUpdated] = useState<string>();
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [followMode, setFollowMode] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [liveGeo, setLiveGeo] = useState<{ lat: number; lon: number; alt: number; vel: number } | null>(null);
  const [satellites, setSatellites] = useState<SatelliteRuntime[]>(() => toRuntimeList(readSessionCache() || []));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");

  const satellitesRef = useRef(satellites);
  const selectedIndexRef = useRef(selectedIndex);
  const followModeRef = useRef(followMode);
  const filterRef = useRef(filter);
  const queryRef = useRef(query);
  const cameraRef = useRef<import("three").PerspectiveCamera | null>(null);
  const orbitControlsRef = useRef<OrbitControls | null>(null);
  const spritesRef = useRef<import("three").Sprite[]>([]);
  const rebuildSpritesRef = useRef<(() => void) | null>(null);
  const selectSatelliteRef = useRef<(index: number) => void>(() => {});
  const liveGeoRef = useRef(liveGeo);
  const frameCounterRef = useRef(0);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return satellites
      .map((sat, index) => ({ ...sat, index }))
      .filter((sat) => filter === "all" || sat.category === filter)
      .filter((sat) => !needle || sat.name.toLowerCase().includes(needle))
      .slice(0, 400);
  }, [filter, query, satellites]);

  const categoryCounts = useMemo(() => {
    return satellites.reduce<Record<string, number>>((acc, sat) => {
      acc[sat.category] = (acc[sat.category] || 0) + 1;
      return acc;
    }, {});
  }, [satellites]);

  const selectedSatellite = selectedIndex >= 0 ? visible.find((sat) => sat.index === selectedIndex) || satellites[selectedIndex] : null;

  useEffect(() => {
    satellitesRef.current = satellites;
    selectedIndexRef.current = selectedIndex;
    followModeRef.current = followMode;
    filterRef.current = filter;
    queryRef.current = query;
    rebuildSpritesRef.current?.();
  }, [filter, followMode, query, satellites, selectedIndex]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let animId = 0;
    let renderer: import("three").WebGLRenderer | null = null;
    let earth: import("three").Mesh | null = null;
    let clouds: import("three").Mesh | null = null;
    const ctrl = new AbortController();

    const boot = async () => {
      const THREE = await import("three");
      const { makeSatelliteCanvas } = await import("@/lib/tracker-globe");
      if (disposed) return;

      const isMobile = window.matchMedia("(max-width: 768px)").matches;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.001, 200);
      camera.position.set(0, 0, isMobile ? 4.25 : 3.2);
      cameraRef.current = camera;

      renderer = new THREE.WebGLRenderer({ antialias: !isMobile, alpha: true, powerPreference: "high-performance" });
      renderer.setClearColor(0x000000, 0);
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.4 : 1.8));
      mount.appendChild(renderer.domElement);

      const textureLoader = new THREE.TextureLoader();
      textureLoader.setCrossOrigin("anonymous");

      const earthMaterial = new THREE.MeshStandardMaterial({
        color: 0x102235,
        emissive: 0x04111c,
        roughness: 0.72,
        metalness: 0.08,
      });
      earth = new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS_3D, isMobile ? 48 : 96, isMobile ? 48 : 96), earthMaterial);
      scene.add(earth);

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

      const cloudMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.22, depthWrite: false });
      clouds = new THREE.Mesh(new THREE.SphereGeometry(1.012, isMobile ? 36 : 64, isMobile ? 36 : 64), cloudMaterial);
      textureLoader.load(EARTH_TEXTURES.clouds, (texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        cloudMaterial.map = texture;
        cloudMaterial.needsUpdate = true;
        scene.add(clouds!);
      });

      const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(1.045, 48, 48),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.08 })
      );
      scene.add(atmosphere);

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

      const spriteTextureCache: Record<string, import("three").CanvasTexture> = {};
      const spriteMaterialCache: Record<string, import("three").SpriteMaterial> = {};

      const getSpriteMaterial = (category: string) => {
        const cat = spriteCategory(category);
        if (!spriteMaterialCache[cat]) {
          if (!spriteTextureCache[cat]) {
            const canvas = makeSatelliteCanvas(category);
            const texture = new THREE.CanvasTexture(canvas);
            texture.anisotropy = renderer?.capabilities.getMaxAnisotropy() || 1;
            spriteTextureCache[cat] = texture;
          }
          spriteMaterialCache[cat] = new THREE.SpriteMaterial({
            map: spriteTextureCache[cat],
            depthTest: false,
            transparent: true,
            blending: THREE.AdditiveBlending,
          });
        }
        return spriteMaterialCache[cat];
      };

      const getFiltered = () => {
        const needle = queryRef.current.trim().toLowerCase();
        return satellitesRef.current
          .map((sat, index) => ({ ...sat, index }))
          .filter((sat) => filterRef.current === "all" || sat.category === filterRef.current)
          .filter((sat) => !needle || sat.name.toLowerCase().includes(needle))
          .slice(0, 400);
      };

      const clearSprites = () => {
        spritesRef.current.forEach((sprite) => {
          scene.remove(sprite);
          sprite.material.dispose();
        });
        spritesRef.current = [];
      };

      rebuildSpritesRef.current = () => {
        clearSprites();
        const filtered = getFiltered();
        filtered.forEach((sat, listIdx) => {
          const material = getSpriteMaterial(sat.category).clone();
          const sprite = new THREE.Sprite(material);
          sprite.scale.set(0.042, 0.042, 1);
          sprite.userData = { satIdx: sat.index, listIdx };
          scene.add(sprite);
          spritesRef.current.push(sprite);
        });
      };
      rebuildSpritesRef.current();

      const orbitControls: OrbitControls = {
        target: new THREE.Vector3(0, 0, 0),
        spherical: new THREE.Spherical(),
        isDragging: false,
        lastMouse: { x: 0, y: 0 },
        zoomSpeed: 0.06,
        rotateSpeed: 0.0022,
        dampingFactor: 0.035,
        velocity: { theta: 0, phi: 0 },
        autoRotate: true,
        autoRotateSpeed: 0.00005,
        targetRadius: isMobile ? 4.25 : 3.2,
      };
      orbitControls.spherical.setFromVector3(camera.position.clone().sub(orbitControls.target));
      orbitControlsRef.current = orbitControls;

      const updateOrbitControls = () => {
        const controls = orbitControlsRef.current;
        if (!controls || followModeRef.current) return;
        if (controls.autoRotate) controls.velocity.theta += controls.autoRotateSpeed;
        controls.spherical.theta += controls.velocity.theta;
        controls.spherical.phi += controls.velocity.phi;
        controls.spherical.phi = Math.max(0.05, Math.min(Math.PI - 0.05, controls.spherical.phi));
        controls.spherical.radius += (controls.targetRadius - controls.spherical.radius) * 0.08;
        controls.velocity.theta *= 1 - controls.dampingFactor;
        controls.velocity.phi *= 1 - controls.dampingFactor;
        const pos = new THREE.Vector3().setFromSpherical(controls.spherical).add(controls.target);
        camera.position.copy(pos);
        camera.lookAt(controls.target);
      };

      const updateFollowMode = () => {
        if (!followModeRef.current || selectedIndexRef.current < 0) return;
        const sat = satellitesRef.current[selectedIndexRef.current];
        if (!sat?.lastGeo) return;
        const coords = geoTo3D(sat.lastGeo.lat, sat.lastGeo.lon, sat.lastGeo.alt);
        const targetPos = new THREE.Vector3(coords.x, coords.y, coords.z);
        const offset = targetPos.clone().normalize().multiplyScalar(0.4);
        const camTarget = targetPos.clone().add(offset);
        camera.position.lerp(camTarget, 0.03);
        camera.lookAt(targetPos);
      };

      const updateSatellitePositions = (now: Date) => {
        const filtered = getFiltered();
        spritesRef.current.forEach((sprite, listIdx) => {
          const sat = filtered[listIdx];
          if (!sat) {
            sprite.visible = false;
            return;
          }
          const geo = propagateToGeodetic(sat.satrec, now);
          if (!geo) {
            sprite.visible = false;
            return;
          }
          const runtime = satellitesRef.current[sat.index];
          if (runtime) runtime.lastGeo = geo;
          const pos = geoTo3D(geo.lat, geo.lon, geo.alt);
          sprite.position.set(pos.x, pos.y, pos.z);
          sprite.visible = true;
          const selected = selectedIndexRef.current === sat.index;
          sprite.material.opacity = selected ? 1 : 0.55;
          sprite.material.color.set(selected ? 0xffffff : categoryColorInt(sat.category));
          const dist = camera.position.distanceTo(sprite.position);
          const baseScale = selected ? 0.062 : 0.032;
          const scale = baseScale * Math.max(0.5, dist * 0.35);
          sprite.scale.set(scale, scale, 1);
        });
      };

      const onPointerDown = (event: PointerEvent) => {
        orbitControls.isDragging = true;
        orbitControls.autoRotate = false;
        orbitControls.lastMouse = { x: event.clientX, y: event.clientY };
        mount.setPointerCapture(event.pointerId);
      };

      const onPointerMove = (event: PointerEvent) => {
        if (!orbitControls.isDragging) return;
        const dx = event.clientX - orbitControls.lastMouse.x;
        const dy = event.clientY - orbitControls.lastMouse.y;
        orbitControls.velocity.theta -= dx * orbitControls.rotateSpeed;
        orbitControls.velocity.phi -= dy * orbitControls.rotateSpeed;
        orbitControls.lastMouse = { x: event.clientX, y: event.clientY };
      };

      const onPointerUp = (event: PointerEvent) => {
        orbitControls.isDragging = false;
        if (mount.hasPointerCapture(event.pointerId)) mount.releasePointerCapture(event.pointerId);
      };

      const onWheel = (event: WheelEvent) => {
        event.preventDefault();
        orbitControls.autoRotate = false;
        const factor = event.deltaY > 0 ? 1 + orbitControls.zoomSpeed : 1 - orbitControls.zoomSpeed;
        orbitControls.targetRadius = Math.max(1.15, Math.min(20, orbitControls.targetRadius * factor));
      };

      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();
      const onClick = (event: MouseEvent) => {
        const rect = renderer!.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(spritesRef.current);
        if (hits.length > 0) {
          const idx = hits[0].object.userData.satIdx as number;
          if (idx !== undefined) selectSatelliteRef.current(idx);
        } else {
          setSelectedIndex(-1);
          setFollowMode(false);
        }
      };

      mount.addEventListener("pointerdown", onPointerDown);
      mount.addEventListener("pointermove", onPointerMove);
      mount.addEventListener("pointerup", onPointerUp);
      mount.addEventListener("pointercancel", onPointerUp);
      mount.addEventListener("wheel", onWheel, { passive: false });
      mount.addEventListener("click", onClick);

      const onResize = () => {
        camera.aspect = mount.clientWidth / mount.clientHeight;
        camera.updateProjectionMatrix();
        renderer?.setSize(mount.clientWidth, mount.clientHeight);
      };
      window.addEventListener("resize", onResize);

      const animate = () => {
        if (disposed) return;
        const now = new Date();
        if (earth) earth.rotation.y += 0.0005;
        if (clouds) clouds.rotation.y += 0.0007;
        updateSatellitePositions(now);
        if (followModeRef.current) updateFollowMode();
        else updateOrbitControls();
        if (selectedIndexRef.current >= 0) {
          const sat = satellitesRef.current[selectedIndexRef.current];
          if (sat?.lastGeo) {
            frameCounterRef.current += 1;
            if (frameCounterRef.current % 20 === 0) {
              const nextGeo = sat.lastGeo;
              if (
                !liveGeoRef.current ||
                Math.abs(liveGeoRef.current.lat - nextGeo.lat) > 0.0001 ||
                Math.abs(liveGeoRef.current.lon - nextGeo.lon) > 0.0001
              ) {
                liveGeoRef.current = nextGeo;
                setLiveGeo(nextGeo);
              }
            }
            if (frameCounterRef.current % 60 === 0) {
              const canvas = miniMapRef.current;
              if (canvas) drawMiniMap(canvas, sat.satrec, sat.lastGeo);
            }
          }
        }
        renderer?.render(scene, camera);
        animId = requestAnimationFrame(animate);
      };
      animate();

      fetchPositions(160, false, ctrl.signal)
        .then((payload) => applyPayload(payload))
        .catch(() => setStatus("Using cached orbital data"));

      fetchPositions(350, false, ctrl.signal)
        .then((payload) => {
          if (payload.positions.length >= satellitesRef.current.length) applyPayload(payload);
        })
        .catch(() => {});

      function applyPayload(payload: { positions: TrackerSatellite[]; source: string; updated?: string }) {
        if (disposed) return;
        const runtime = toRuntimeList(payload.positions);
        if (!runtime.length) return;
        setSatellites(runtime);
        writeSessionCache(payload.positions);
        setSource(payload.source);
        setUpdated(payload.updated);
        setStatus(`Tracking ${runtime.length} objects`);
      }

      return () => {
        ctrl.abort();
        cancelAnimationFrame(animId);
        window.removeEventListener("resize", onResize);
        mount.removeEventListener("pointerdown", onPointerDown);
        mount.removeEventListener("pointermove", onPointerMove);
        mount.removeEventListener("pointerup", onPointerUp);
        mount.removeEventListener("pointercancel", onPointerUp);
        mount.removeEventListener("wheel", onWheel);
        mount.removeEventListener("click", onClick);
        clearSprites();
        Object.values(spriteMaterialCache).forEach((material) => material.dispose());
        Object.values(spriteTextureCache).forEach((texture) => texture.dispose());
        earth?.geometry.dispose();
        earthMaterial.map?.dispose();
        earthMaterial.roughnessMap?.dispose();
        earthMaterial.dispose();
        clouds?.geometry.dispose();
        cloudMaterial.map?.dispose();
        cloudMaterial.dispose();
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

  const selectSatellite = useCallback((index: number) => {
    setSelectedIndex(index);
    const sat = satellitesRef.current[index];
    if (sat) {
      const geo = propagateToGeodetic(sat.satrec) || {
        lat: sat.lat,
        lon: sat.lon,
        alt: sat.alt,
        vel: sat.velocity || 7.8,
      };
      sat.lastGeo = geo;
      setLiveGeo(geo);
      const canvas = miniMapRef.current;
      if (canvas) drawMiniMap(canvas, sat.satrec, geo);
    }
    rebuildSpritesRef.current?.();
  }, []);

  useEffect(() => {
    selectSatelliteRef.current = selectSatellite;
  }, [selectSatellite]);

  const toggleFollowMode = useCallback(() => {
    if (selectedIndex < 0) {
      setRefreshError("Select a satellite first");
      return;
    }
    setFollowMode((value) => {
      const next = !value;
      if (!next && orbitControlsRef.current && cameraRef.current) {
        orbitControlsRef.current.spherical.setFromVector3(
          cameraRef.current.position.clone().sub(orbitControlsRef.current.target)
        );
        orbitControlsRef.current.autoRotate = true;
      }
      if (next && orbitControlsRef.current) orbitControlsRef.current.autoRotate = false;
      return next;
    });
    setRefreshError("");
  }, [selectedIndex]);

  const toggleListFollow = useCallback(
    (index: number) => {
      if (selectedIndex === index && followMode) {
        setFollowMode(false);
        setSelectedIndex(-1);
        setLiveGeo(null);
        if (orbitControlsRef.current) orbitControlsRef.current.autoRotate = true;
        return;
      }
      selectSatellite(index);
      setFollowMode(true);
      if (orbitControlsRef.current) orbitControlsRef.current.autoRotate = false;
    },
    [followMode, selectSatellite, selectedIndex]
  );

  const deselectSatellite = useCallback(() => {
    setSelectedIndex(-1);
    setFollowMode(false);
    setLiveGeo(null);
    if (orbitControlsRef.current) orbitControlsRef.current.autoRotate = true;
    rebuildSpritesRef.current?.();
  }, []);

  async function refresh() {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setRefreshError("");
    setStatus("Refreshing orbital data...");
    try {
      const payload = await fetchPositions(350, true);
      const runtime = toRuntimeList(payload.positions);
      if (!runtime.length) throw new Error("No satellites returned");
      setSatellites(runtime);
      writeSessionCache(payload.positions);
      setSource(payload.source);
      setUpdated(payload.updated);
      setStatus(`Refreshed ${runtime.length} objects`);
      if (selectedIndex >= 0) {
        const next = runtime.find((sat) => sat.name === satellitesRef.current[selectedIndex]?.name);
        if (next) {
          const idx = runtime.indexOf(next);
          selectSatellite(idx);
        }
      }
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : "Refresh failed");
      setStatus("Refresh failed; showing cached data");
    } finally {
      setIsRefreshing(false);
    }
  }

  const activeGeo = liveGeo || (selectedSatellite ? propagateToGeodetic(selectedSatellite.satrec) : null);

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
          <button
            type="button"
            className={`tracker-icon-btn ${followMode ? "is-active" : ""}`}
            onClick={toggleFollowMode}
            aria-pressed={followMode}
          >
            {followMode ? "Following" : "Follow"}
          </button>
          <button
            type="button"
            className="tracker-icon-btn"
            onClick={() => {
              if (!orbitControlsRef.current) return;
              orbitControlsRef.current.targetRadius = Math.max(
                1.15,
                orbitControlsRef.current.targetRadius * 0.88
              );
              orbitControlsRef.current.autoRotate = false;
            }}
          >
            Zoom in
          </button>
          <button
            type="button"
            className="tracker-icon-btn"
            onClick={() => {
              if (!orbitControlsRef.current) return;
              orbitControlsRef.current.targetRadius = Math.min(
                20,
                orbitControlsRef.current.targetRadius * 1.12
              );
              orbitControlsRef.current.autoRotate = false;
            }}
          >
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
                <small>{item.id === "all" ? satellites.length : categoryCounts[item.id] || 0}</small>
              </button>
            ))}
          </div>

          {selectedSatellite && activeGeo && (
            <div className="tracker-selected">
              <div className="tracker-selected-head">
                <p className="font-mono text-[0.68rem] uppercase text-[var(--accent)]">Selected</p>
                <button type="button" className="tracker-follow-btn" onClick={deselectSatellite}>
                  Close
                </button>
              </div>
              <div className="tracker-selected-title">
                <span className="tracker-list-emoji">{categoryEmoji(selectedSatellite.category)}</span>
                <div>
                  <h2>{selectedSatellite.name}</h2>
                  <p className="tracker-source">NORAD {selectedSatellite.norad}</p>
                </div>
              </div>
              <dl>
                <div>
                  <dt>Latitude</dt>
                  <dd>{activeGeo.lat.toFixed(4)}°</dd>
                </div>
                <div>
                  <dt>Longitude</dt>
                  <dd>{activeGeo.lon.toFixed(4)}°</dd>
                </div>
                <div>
                  <dt>Altitude</dt>
                  <dd>{Math.round(activeGeo.alt).toLocaleString()} km</dd>
                </div>
                <div>
                  <dt>Velocity</dt>
                  <dd>{activeGeo.vel.toFixed(2)} km/s</dd>
                </div>
                <div>
                  <dt>Orbit</dt>
                  <dd>{orbitTypeLabel(activeGeo.alt)}</dd>
                </div>
                <div>
                  <dt>Category</dt>
                  <dd>{selectedSatellite.category.toUpperCase()}</dd>
                </div>
              </dl>
              <canvas ref={miniMapRef} className="tracker-mini-map" width={280} height={128} aria-label="Ground track mini map" />
              <p className="tracker-source">Source: {source}</p>
              <div className="model-controls">
                <button type="button" className={followMode ? "is-active" : ""} onClick={toggleFollowMode}>
                  {followMode ? "Stop following" : "Follow satellite"}
                </button>
              </div>
            </div>
          )}

          <div className="tracker-list" aria-label="Visible satellites">
            {visible.slice(0, 12).map((sat) => (
              <SatelliteListItem
                key={`${sat.name}-${sat.norad}`}
                sat={sat}
                isSelected={selectedIndex === sat.index}
                isFollowed={followMode && selectedIndex === sat.index}
                onSelect={selectSatellite}
                onFollowToggle={toggleListFollow}
              />
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}