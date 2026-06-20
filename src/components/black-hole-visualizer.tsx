"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Group } from "three";

type Simulation = {
  mass: number;
  spin: number;
  brightness: number;
  orbitSpeed: number;
  horizon: boolean;
  photonRing: boolean;
  spacetime: boolean;
  jets: boolean;
  labels: boolean;
};

const initialSimulation: Simulation = {
  mass: 55,
  spin: 62,
  brightness: 72,
  orbitSpeed: 56,
  horizon: true,
  photonRing: true,
  spacetime: false,
  jets: false,
  labels: true,
};

const sections = [
  ["What is a black hole?", "A black hole is a region of spacetime where gravity is so strong that crossing its boundary means there is no route back out."],
  ["How black holes form", "Many begin when a very massive star collapses after a supernova. Others grow over cosmic time into the giant black holes found in galaxy centres."],
  ["Event horizon", "This is the point of no return. The needed escape speed would be greater than the speed of light."],
  ["Singularity", "It is where our current equations stop giving a complete answer. Future quantum-gravity theories may change this picture."],
  ["Accretion disk", "Gas spirals inward, collides, and heats to extraordinary temperatures. That hot material is what makes a feeding black hole visible."],
  ["Gravitational lensing", "Gravity bends light paths. Near a black hole, background light can be stretched, doubled, and wrapped into a bright ring."],
  ["Hawking radiation", "A theoretical quantum effect predicts that black holes slowly lose energy over immense timescales. It has not yet been directly observed."],
];

const types = [
  ["Stellar", "Born from the collapse of a large star."],
  ["Intermediate", "A still-mysterious bridge between stellar and supermassive scales."],
  ["Supermassive", "Millions to billions of Suns; usually found in galaxy centres."],
  ["Primordial", "Hypothetical early-universe objects, not yet confirmed."],
];

function makeStarPositions() {
  const points = new Float32Array(540);
  for (let i = 0; i < points.length; i += 3) {
    const seed = i / 3 + 1;
    const radius = 7 + ((Math.sin(seed * 12.9898) + 1) / 2) * 8;
    const theta = ((Math.sin(seed * 78.233) + 1) / 2) * Math.PI * 2;
    const phi = Math.acos(Math.sin(seed * 37.719));
    points[i] = radius * Math.sin(phi) * Math.cos(theta);
    points[i + 1] = radius * Math.cos(phi);
    points[i + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }
  return points;
}

const STAR_POSITIONS = makeStarPositions();

function StarField() {
  return <points><bufferGeometry><bufferAttribute attach="attributes-position" args={[STAR_POSITIONS, 3]} /></bufferGeometry><pointsMaterial size={0.022} color="#f6d8a7" sizeAttenuation /></points>;
}

export function AccretionDisk({ brightness, spin, active }: Pick<Simulation, "brightness" | "spin"> & { active: boolean }) {
  const ref = useRef<Group>(null);
  useFrame((_, delta) => {
    if (ref.current && active) ref.current.rotation.z += delta * (0.12 + spin / 240);
  });
  const intensity = 0.45 + brightness / 70;
  return (
    <group ref={ref} rotation={[0.96, -0.12, 0.04]}>
      {[0, 0.17, 0.34, 0.51].map((offset, index) => (
        <mesh key={offset} rotation={[0, 0, index * 0.32]}>
          <torusGeometry args={[1.18 + offset, 0.16 - index * 0.018, 16, 72]} />
          <meshStandardMaterial color={index < 2 ? "#fff0c7" : "#e7532f"} emissive={index < 2 ? "#ff9c35" : "#8d1e1a"} emissiveIntensity={intensity * (1 - index * 0.12)} transparent opacity={0.88 - index * 0.08} />
        </mesh>
      ))}
      <pointLight color="#ff8c31" intensity={brightness / 16} distance={5} />
    </group>
  );
}

export function SpacetimeGrid({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return <mesh position={[0, -0.78, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[3.9, 0.9, 44, 18, true]} /><meshBasicMaterial color="#557bff" transparent opacity={0.16} wireframe /></mesh>;
}

export function OrbitingParticles({ speed, active }: { speed: number; active: boolean }) {
  const ref = useRef<Group>(null);
  useFrame((_, delta) => { if (ref.current && active) ref.current.rotation.y += delta * (0.1 + speed / 250); });
  return <group ref={ref}>{Array.from({ length: 14 }, (_, i) => {
    const angle = (i / 14) * Math.PI * 2;
    const radius = 2.15 + (i % 3) * 0.23;
    return <mesh key={i} position={[Math.cos(angle) * radius, ((i % 4) - 1.5) * 0.1, Math.sin(angle) * radius]}><sphereGeometry args={[0.025 + (i % 3) * 0.006, 8, 8]} /><meshBasicMaterial color={i % 2 ? "#fff3bd" : "#ffb24c"} /></mesh>;
  })}</group>;
}

export function BlackHoleScene({ simulation, active, reducedMotion }: { simulation: Simulation; active: boolean; reducedMotion: boolean }) {
  const group = useRef<Group>(null);
  const radius = 0.68 + simulation.mass / 185;
  useFrame((state, delta) => {
    if (!group.current || reducedMotion || !active) return;
    group.current.rotation.y += delta * 0.035;
    group.current.rotation.x += (state.pointer.y * 0.12 - group.current.rotation.x) * delta * 0.6;
    group.current.rotation.y += state.pointer.x * delta * 0.035;
  });
  return <>
    <color attach="background" args={["#02030a"]} />
    <ambientLight intensity={0.2} />
    <pointLight position={[2.5, 1.5, 3]} color="#ffc06a" intensity={2.2} />
    <pointLight position={[-2, -1, -2]} color="#4d71ff" intensity={1.1} />
    <StarField />
    <group ref={group}>
      <SpacetimeGrid visible={simulation.spacetime} />
      <AccretionDisk brightness={simulation.brightness} spin={simulation.spin} active={active && !reducedMotion} />
      {simulation.horizon && <mesh><torusGeometry args={[radius, 0.032, 16, 80]} /><meshBasicMaterial color="#ffb95d" transparent opacity={0.9} /></mesh>}
      {simulation.photonRing && <mesh rotation={[0.22, 0.45, 0]}><torusGeometry args={[radius + 0.13, 0.018, 12, 80]} /><meshBasicMaterial color="#fff1c1" transparent opacity={0.9} /></mesh>}
      <mesh><sphereGeometry args={[radius, 64, 64]} /><meshBasicMaterial color="#000005" /></mesh>
      {simulation.jets && <group><mesh position={[0, 2.15, 0]}><coneGeometry args={[0.15 + simulation.spin / 500, 2.4, 24]} /><meshBasicMaterial color="#83ddff" transparent opacity={0.5} /></mesh><mesh position={[0, -2.15, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.15 + simulation.spin / 500, 2.4, 24]} /><meshBasicMaterial color="#83ddff" transparent opacity={0.5} /></mesh></group>}
      <OrbitingParticles speed={simulation.orbitSpeed} active={active && !reducedMotion} />
    </group>
  </>;
}

export function BlackHoleInfoCard({ title, copy, index }: { title: string; copy: string; index: number }) {
  return <article className="bh-info-card" style={{ "--delay": `${index * 45}ms` } as CSSProperties}><span>{String(index + 1).padStart(2, "0")}</span><h2>{title}</h2><p>{copy}</p></article>;
}

export function BlackHoleTooltip({ label, copy }: { label: string; copy: string }) {
  return <button type="button" className="bh-label" title={copy} aria-label={`${label}. ${copy}`}>{label}</button>;
}

export function BlackHoleControls({ simulation, onChange, onReset }: { simulation: Simulation; onChange: (next: Simulation) => void; onReset: () => void }) {
  const sliders: Array<[keyof Simulation, string, string]> = [["mass", "Mass", "solar masses"], ["spin", "Spin", "%"], ["brightness", "Disk brightness", "%"], ["orbitSpeed", "Orbit speed", "%"]];
  const toggles: Array<[keyof Simulation, string]> = [["horizon", "Event horizon"], ["photonRing", "Photon ring"], ["spacetime", "Spacetime curvature"], ["jets", "Relativistic jets"], ["labels", "Show labels"]];
  return <aside className="bh-controls" aria-label="Black hole simulation controls"><div className="bh-controls-head"><p>Simulation controls</p><button type="button" onClick={onReset}>Reset</button></div>{sliders.map(([key, label, unit]) => <label key={key} className="bh-slider"><span>{label}<b>{simulation[key]}{unit === "solar masses" ? " M☉" : unit}</b></span><input type="range" min="0" max="100" value={simulation[key] as number} onChange={(event) => onChange({ ...simulation, [key]: Number(event.target.value) })} /></label>)}<div className="bh-toggles">{toggles.map(([key, label]) => <label key={key}><input type="checkbox" checked={simulation[key] as boolean} onChange={(event) => onChange({ ...simulation, [key]: event.target.checked })} /><span>{label}</span></label>)}</div></aside>;
}

export function BlackHoleQuiz() {
  const questions: Array<[string, string, string[]]> = [
    ["What boundary marks the point of no return?", "Event horizon", ["Accretion disk", "Event horizon", "Photon ring"]],
    ["What warps background starlight?", "Gravitational lensing", ["Solar wind", "Gravitational lensing", "Magnetism"]],
    ["What glows around a feeding black hole?", "Accretion disk", ["Accretion disk", "Singularity", "Event horizon"]],
    ["Which black hole is at our galaxy's centre?", "Sagittarius A*", ["Cygnus X-1", "M87*", "Sagittarius A*"]],
  ];
  const [answers, setAnswers] = useState<string[]>([]);
  const complete = answers.length === questions.length;
  const score = answers.filter((answer, index) => answer === questions[index][1]).length;
  return <section className="bh-quiz" aria-labelledby="black-hole-quiz"><div><p className="bh-kicker">Knowledge check</p><h2 id="black-hole-quiz">Test your black hole knowledge</h2><p>Four quick questions. No gravity well required.</p></div><div className="bh-quiz-grid">{questions.map(([question, correct, options], index) => <fieldset key={question}><legend>{question}</legend>{(options as string[]).map((option) => <label key={option} className={answers[index] ? (option === correct ? "is-correct" : answers[index] === option ? "is-wrong" : "") : ""}><input type="radio" name={`question-${index}`} checked={answers[index] === option} onChange={() => setAnswers((current) => { const next = [...current]; next[index] = option; return next; })} />{option}</label>)}</fieldset>)}</div>{complete && <div className="bh-quiz-result"><strong>{score === 4 ? "Nice — you understand the basics of black holes." : `${score} of 4 correct. A little more orbit time and you have it.`}</strong><button type="button" onClick={() => setAnswers([])}>Try again</button></div>}</section>;
}

export function BlackHoleVisualizer() {
  const [simulation, setSimulation] = useState(initialSimulation);
  const [active, setActive] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update(); media.addEventListener("change", update);
    const observer = new IntersectionObserver(([entry]) => setActive(entry.isIntersecting), { threshold: 0.08 });
    if (heroRef.current) observer.observe(heroRef.current);
    return () => { media.removeEventListener("change", update); observer.disconnect(); };
  }, []);
  const nearTime = Math.max(8, Math.round(100 - simulation.mass * 0.72));
  return <div className="bh-page">
    <section className="bh-hero" ref={heroRef} aria-labelledby="black-hole-title"><div className="bh-canvas"><Canvas camera={{ position: [0, 0.2, 6], fov: 42 }} dpr={[1, 1.5]} frameloop={active && !reducedMotion ? "always" : "demand"} gl={{ antialias: true }}><BlackHoleScene simulation={simulation} active={active} reducedMotion={reducedMotion} /></Canvas></div><div className="bh-noise" aria-hidden="true" />
      <div className="bh-hero-copy"><p className="bh-kicker">Interactive field guide</p><h1 id="black-hole-title">Black Hole<br />Visualizer</h1><p>Explore gravity, spacetime, accretion disks, event horizons, and Hawking radiation through an interactive real-time simulation.</p><a href="#learn" className="bh-begin">Begin exploration <span aria-hidden="true">↓</span></a></div>
      {simulation.labels && <div className="bh-labels"><BlackHoleTooltip label="Photon ring" copy="Light can briefly orbit near this unstable region." /><BlackHoleTooltip label="Event horizon" copy="The boundary beyond which nothing can escape." /><BlackHoleTooltip label="Accretion disk" copy="Hot matter spiralling inward and glowing brightly." />{simulation.jets && <BlackHoleTooltip label="Relativistic jets" copy="Fast outflows launched from some spinning black holes." />}</div>}
      <p className="bh-scroll">Scroll to learn <span /></p><BlackHoleControls simulation={simulation} onChange={setSimulation} onReset={() => setSimulation(initialSimulation)} />
    </section>
    <section id="learn" className="bh-learning"><div className="bh-section-heading"><p className="bh-kicker">Field notes</p><h2>Follow the gravity.</h2><p>One idea at a time, from the bright material we can see to the physics we are still trying to understand.</p></div><div className="bh-info-grid">{sections.map(([title, copy], index) => <BlackHoleInfoCard key={title} title={title} copy={copy} index={index} />)}</div></section>
    <section className="bh-time"><div><p className="bh-kicker">Time dilation</p><h2>Closer is slower.</h2><p>For a distant observer, clocks near a black hole appear to run more slowly. This simplified slider shows the direction of the effect—not a full relativistic calculation.</p></div><div className="bh-time-panel"><label>Distance from event horizon <input type="range" min="0" max="100" value={simulation.mass} onChange={(event) => setSimulation({ ...simulation, mass: Number(event.target.value) })} /></label><div><span>Far observer</span><strong>100 seconds</strong></div><div><span>Near black hole</span><strong>{nearTime} seconds</strong></div></div></section>
    <section className="bh-types"><div className="bh-section-heading"><p className="bh-kicker">Scale matters</p><h2>Types of black holes</h2></div><div>{types.map(([title, copy]) => <article key={title}><h3>{title}</h3><p>{copy}</p></article>)}</div></section>
    <section className="bh-famous"><p className="bh-kicker">Famous targets</p><div><article><span>Sagittarius A*</span><p>The supermassive black hole at the Milky Way’s centre, imaged by the Event Horizon Telescope.</p></article><article><span>M87*</span><p>The first black hole ever imaged by the Event Horizon Telescope, in the Messier 87 galaxy.</p></article><article><span>Cygnus X-1</span><p>A famous stellar-mass black hole in a binary system, discovered through its powerful X-rays.</p></article></div></section>
    <BlackHoleQuiz />
  </div>;
}
