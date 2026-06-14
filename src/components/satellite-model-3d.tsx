"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { Component, Suspense, useMemo, useRef, useState } from "react";
import type React from "react";
import type { Group } from "three";
import type { OrbitControls as OrbitControlImpl } from "three-stdlib";

const PARTS = [
  { id: "panels", label: "Solar panels" },
  { id: "antenna", label: "Antenna" },
  { id: "payload", label: "Payload" },
  { id: "bus", label: "Satellite bus" },
  { id: "thruster", label: "Thrusters" },
];

const partCopy: Record<string, string> = {
  panels: "Solar panels turn sunlight into electricity so the satellite can run for years.",
  antenna: "Antennas send and receive radio signals to talk with ground stations or users.",
  payload: "The payload holds the mission instruments, cameras, radars, or science sensors.",
  bus: "The bus is the main body that holds computers, wiring, and support systems together.",
  thruster: "Thrusters make small pushes to adjust orbit and keep the satellite on track.",
};

class ModelErrorBoundary extends Component<{ children: React.ReactNode; onError: () => void }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

function RealModel({ modelUrl }: { modelUrl: string }) {
  const { scene } = useGLTF(modelUrl);
  return <primitive object={scene} scale={1.2} />;
}

function Body({ selected, id, children }: { selected: string | null; id: string; children: React.ReactNode }) {
  return (
    <group>
      {children}
      {selected === id && (
        <mesh scale={1.08}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshBasicMaterial color="#ffcf24" />
        </mesh>
      )}
    </group>
  );
}

function ProceduralSatellite({
  fallbackType,
  selected,
  onSelect,
}: {
  fallbackType?: string;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const groupRef = useRef<Group>(null);
  const type = fallbackType || "earth-observer";
  const isStation = type.includes("station");
  const isFlat = type.includes("flat") || type.includes("starlink");
  const isGeo = type.includes("geo") || type.includes("navigation");
  const isRadar = type.includes("radar");
  const isObservatory = type.includes("observatory") || type.includes("hubble");

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.18;
  });

  return (
    <group ref={groupRef} rotation={[0.18, -0.45, 0]} scale={isStation ? 0.82 : 1}>
      <Body selected={selected} id="bus">
        <mesh onClick={() => onSelect("bus")}>
          <boxGeometry args={isFlat ? [0.9, 0.28, 0.55] : [0.65, 0.62, 0.72]} />
          <meshStandardMaterial color={selected === "bus" ? "#ffcf24" : "#d9d7ff"} metalness={0.35} roughness={0.42} />
        </mesh>
      </Body>

      <Body selected={selected} id="panels">
        <mesh position={[isStation ? 1.35 : 1.1, 0, 0]} onClick={() => onSelect("panels")}>
          <boxGeometry args={[isStation ? 1.65 : 1.25, 0.06, isFlat ? 0.5 : 0.78]} />
          <meshStandardMaterial color={selected === "panels" ? "#ffcf24" : "#00c2ff"} metalness={0.2} roughness={0.35} />
        </mesh>
        <mesh position={[isStation ? -1.35 : -1.1, 0, 0]} onClick={() => onSelect("panels")}>
          <boxGeometry args={[isStation ? 1.65 : 1.25, 0.06, isFlat ? 0.5 : 0.78]} />
          <meshStandardMaterial color={selected === "panels" ? "#ffcf24" : "#00c2ff"} metalness={0.2} roughness={0.35} />
        </mesh>
      </Body>

      <Body selected={selected} id="antenna">
        <mesh position={[0, 0.72, 0]} onClick={() => onSelect("antenna")}>
          <cylinderGeometry args={[0.025, 0.025, isGeo ? 0.95 : 0.65, 16]} />
          <meshStandardMaterial color={selected === "antenna" ? "#ffcf24" : "#fffdf4"} />
        </mesh>
        <mesh position={[0, isGeo ? 1.25 : 1.02, 0]} rotation={[Math.PI / 2, 0, 0]} onClick={() => onSelect("antenna")}>
          <coneGeometry args={[isGeo ? 0.28 : 0.18, 0.18, 24]} />
          <meshStandardMaterial color={selected === "antenna" ? "#ffcf24" : "#fffdf4"} />
        </mesh>
      </Body>

      <Body selected={selected} id="payload">
        <mesh position={[0, 0, 0.55]} onClick={() => onSelect("payload")}>
          {isObservatory ? <cylinderGeometry args={[0.22, 0.22, 0.75, 24]} /> : <boxGeometry args={[0.38, 0.38, 0.38]} />}
          <meshStandardMaterial color={selected === "payload" ? "#ffcf24" : isRadar ? "#ff5fa2" : "#7cff6b"} metalness={0.3} />
        </mesh>
        {isRadar && (
          <mesh position={[0, -0.15, 0.95]} rotation={[0.25, 0, 0]} onClick={() => onSelect("payload")}>
            <boxGeometry args={[1.05, 0.08, 0.5]} />
            <meshStandardMaterial color={selected === "payload" ? "#ffcf24" : "#ff5fa2"} />
          </mesh>
        )}
      </Body>

      <Body selected={selected} id="thruster">
        <mesh position={[0, -0.08, -0.58]} rotation={[Math.PI / 2, 0, 0]} onClick={() => onSelect("thruster")}>
          <coneGeometry args={[0.16, 0.35, 18]} />
          <meshStandardMaterial color={selected === "thruster" ? "#ffcf24" : "#ff7a2f"} metalness={0.25} />
        </mesh>
      </Body>
    </group>
  );
}

function ModelScene({
  modelUrl,
  fallbackType,
  selected,
  onSelect,
  onModelError,
  controlsRef,
}: {
  modelUrl?: string | null;
  fallbackType?: string;
  selected: string | null;
  onSelect: (id: string) => void;
  onModelError: () => void;
  controlsRef: React.RefObject<OrbitControlImpl | null>;
}) {
  return (
    <Canvas frameloop="demand" camera={{ position: [2.7, 1.7, 2.7], fov: 45 }} dpr={[1, 1.6]}>
      <ambientLight intensity={0.78} />
      <directionalLight position={[4, 4, 5]} intensity={1.8} />
      <directionalLight position={[-3, -1, -2]} color="#00c2ff" intensity={0.9} />
      <Suspense fallback={null}>
        {modelUrl ? <ModelErrorBoundary onError={onModelError}><RealModel modelUrl={modelUrl} /></ModelErrorBoundary> : <ProceduralSatellite fallbackType={fallbackType} selected={selected} onSelect={onSelect} />}
      </Suspense>
      <OrbitControls ref={controlsRef} enablePan={false} enableZoom minDistance={1.8} maxDistance={5} makeDefault />
    </Canvas>
  );
}

export function SatelliteModel3D({
  attribution,
  fallbackType,
  modelUrl,
  name = "Satellite",
}: {
  attribution?: string;
  fallbackType?: string;
  modelUrl?: string | null;
  name?: string;
}) {
  const [selected, setSelected] = useState<string | null>("bus");
  const [zoomKey, setZoomKey] = useState(0);
  const [modelError, setModelError] = useState(false);
  const controlsRef = useRef<OrbitControlImpl | null>(null);
  const info = useMemo(() => (selected ? partCopy[selected] : "Rotate or zoom the model to inspect it."), [selected]);
  const activeModelUrl = modelError ? null : modelUrl;

  function resetView() {
    controlsRef.current?.reset();
    setZoomKey((value) => value + 1);
  }

  function rotateView() {
    const controls = controlsRef.current;
    if (!controls) return;
    const nextAngle = (controls.getAzimuthalAngle?.() || 0) + 0.55;
    controls.setAzimuthalAngle(nextAngle);
    controls.update();
  }

  function zoomView() {
    const controls = controlsRef.current;
    controls?.dollyIn(1.2);
    controls?.update?.();
  }

  return (
    <div className="model-shell">
      <div className="model-stage" aria-label={`${name} 3D model`}>
        <ModelScene
          key={zoomKey}
          modelUrl={activeModelUrl}
          fallbackType={fallbackType}
          selected={selected}
          onSelect={setSelected}
          onModelError={() => setModelError(true)}
          controlsRef={controlsRef}
        />
      </div>
      <aside className="model-sidebar">
        <span className="sticker-tag">Inspect</span>
        <h3>{selected || "Select a part"}</h3>
        <p>{info}</p>
        {modelError && <p className="text-sm text-[var(--danger)]">Model file failed to load, showing fallback preview.</p>}
        <div className="model-controls" aria-label="3D model controls">
          <button type="button" onClick={rotateView}>
            Rotate
          </button>
          <button type="button" onClick={zoomView}>
            Zoom
          </button>
          <button type="button" onClick={resetView}>
            Reset
          </button>
        </div>
        <div className="model-parts">
          {PARTS.map((part) => (
            <button key={part.id} type="button" className={selected === part.id ? "is-selected" : ""} onClick={() => setSelected(part.id)}>
              {part.label}
            </button>
          ))}
        </div>
        {attribution && <p className="font-mono text-xs">{attribution}</p>}
      </aside>
    </div>
  );
}
