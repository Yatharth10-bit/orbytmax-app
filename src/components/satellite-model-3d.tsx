"use client";

import { Bounds, Center, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Component, Suspense, useMemo, useRef, useState } from "react";
import type React from "react";
import type { Material, Mesh, Object3D } from "three";
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

const MODEL_PART_NODE_MAP: Record<string, Record<string, string[]>> = {
  iss: {
    panels: ["bendedtru", "polySurfa"],
    antenna: ["pCylinder"],
    payload: ["polySurfa"],
    bus: ["isscombine", "bendedtrus"],
    thruster: ["pCylinder8"],
  },
  goes: {
    panels: ["arrayPanels", "arrayHinges", "arraySensors", "arrayBrace", "arrayGimble"],
    antenna: ["Boom", "boomEquip", "boomWires", "boomHousing", "glmCoax"],
    payload: ["ABI", "GLM", "SUVI_EXIS", "SEIS", "Ins1", "Inst3"],
    bus: ["BUS", "Bench", "BusBenchTrans"],
    thruster: ["Thruster", "ThrustRim"],
  },
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

function modelKeyFromUrl(modelUrl: string) {
  const value = modelUrl.toLowerCase();
  if (value.includes("goes")) return "goes";
  if (value.includes("iss")) return "iss";
  return "generic";
}

function objectMatchesPart(object: Object3D, modelUrl: string, selected: string | null) {
  if (!selected) return false;
  const modelKey = modelKeyFromUrl(modelUrl);
  const names = MODEL_PART_NODE_MAP[modelKey]?.[selected] || [selected];
  const objectName = object.name.toLowerCase();
  return names.some((name) => objectName.includes(name.toLowerCase()));
}

function cloneMaterial(material: Material | Material[]) {
  return Array.isArray(material) ? material.map((item) => item.clone()) : material.clone();
}

function paintModel(scene: Object3D, modelUrl: string, selected: string | null) {
  scene.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    mesh.material = cloneMaterial(mesh.material);
    if (objectMatchesPart(mesh, modelUrl, selected)) {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material) => {
        const editable = material as Material & {
          color?: { set: (value: string) => void };
          emissive?: { set: (value: string) => void };
          emissiveIntensity?: number;
        };
        editable.color?.set("#ffb454");
        editable.emissive?.set("#8a5a20");
        editable.emissiveIntensity = 0.45;
      });
    }
  });
  return scene;
}

function RealModel({ modelUrl, selected }: { modelUrl: string; selected: string | null }) {
  const { scene } = useGLTF(modelUrl);
  const paintedScene = useMemo(() => paintModel(scene.clone(true), modelUrl, selected), [modelUrl, scene, selected]);

  return (
    <Bounds fit clip observe margin={1.15}>
      <Center>
        <primitive object={paintedScene} />
      </Center>
    </Bounds>
  );
}

function ModelScene({
  modelUrl,
  selected,
  onModelError,
  controlsRef,
}: {
  modelUrl: string;
  selected: string | null;
  onModelError: () => void;
  controlsRef: React.RefObject<OrbitControlImpl | null>;
}) {
  return (
    <Canvas camera={{ position: [2.7, 1.7, 2.7], fov: 45 }} dpr={[1, 1.6]}>
      <ambientLight intensity={0.85} />
      <directionalLight position={[4, 4, 5]} intensity={1.9} />
      <directionalLight position={[-3, -1, -2]} color="#5b7a94" intensity={0.8} />
      <Suspense fallback={null}>
        <ModelErrorBoundary onError={onModelError}>
          <RealModel modelUrl={modelUrl} selected={selected} />
        </ModelErrorBoundary>
      </Suspense>
      <OrbitControls ref={controlsRef} enablePan={false} enableZoom minDistance={1.5} maxDistance={8} makeDefault />
    </Canvas>
  );
}

function ModelInProgress({ name, reason }: { name: string; reason?: string }) {
  return (
    <div className="model-in-progress" role="status">
      <div className="model-in-progress-orbit" aria-hidden="true">
        <span />
      </div>
      <h3>3D model in progress</h3>
      <p>
        A real inspection model for {name} is being prepared. This space stays empty until there is a sourced
        model ready for students to explore.
      </p>
      {reason && <small>{reason}</small>}
    </div>
  );
}

export function SatelliteModel3D({
  attribution,
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
  const hasModel = Boolean(activeModelUrl);

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
        {activeModelUrl ? (
          <ModelScene
            key={zoomKey}
            modelUrl={activeModelUrl}
            selected={selected}
            onModelError={() => setModelError(true)}
            controlsRef={controlsRef}
          />
        ) : (
          <ModelInProgress name={name} reason={modelError ? "The model file did not load." : undefined} />
        )}
      </div>
      <aside className="model-sidebar">
        <span className="sticker-tag">{hasModel ? "Inspect" : "Model status"}</span>
        <h3>{hasModel ? selected || "Select a part" : "Real model not ready yet"}</h3>
        <p>
          {hasModel
            ? info
            : "This mission is waiting for a verified model asset, so the part controls stay locked for now."}
        </p>
        <div className="model-controls" aria-label="3D model controls">
          <button type="button" onClick={rotateView} disabled={!hasModel}>
            Rotate
          </button>
          <button type="button" onClick={zoomView} disabled={!hasModel}>
            Zoom
          </button>
          <button type="button" onClick={resetView} disabled={!hasModel}>
            Reset
          </button>
        </div>
        {hasModel ? (
          <div className="model-parts">
            {PARTS.map((part) => (
              <button
                key={part.id}
                type="button"
                className={selected === part.id ? "is-selected" : ""}
                onClick={() => setSelected(part.id)}
              >
                {part.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="model-awaiting-list">
            <span>Part labels unlock after the verified model is added.</span>
          </div>
        )}
        {attribution && <p className="font-mono text-xs">{attribution}</p>}
      </aside>
    </div>
  );
}
