"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { classroomMissions, circularOrbit } from "@/lib/classroom-missions";

type Entry = { note: string; choice: number; complete: boolean };
const storageKey = "orbytmax-missions-v1";
export function MissionLab() {
  const [selected, setSelected] = useState(0);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [altitude, setAltitude] = useState(400);
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  const [hindi, setHindi] = useState(false);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("mission");
    const index = classroomMissions.findIndex(m => m.id === id);
    if (index >= 0) setSelected(index);
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(storageKey) || "{}");
      if (saved && typeof saved === "object" && !Array.isArray(saved)) {
        const validated: Record<string, Entry> = {};
        for (const m of classroomMissions) {
          const e = (saved as Record<string, Entry>)[m.id];
          if (e && typeof e.note === "string" && Number.isInteger(e.choice) && e.choice >= -1 && e.choice <= 2 && typeof e.complete === "boolean") validated[m.id] = e;
        }
        setEntries(validated);
      }
    } catch { setMessage("Saved progress is unavailable. You can still complete and download your work."); }
    setReady(true);
  }, []);
  const mission = classroomMissions[selected];
  const entry = entries[mission.id] || { note: "", choice: -1, complete: false };
  const orbit = circularOrbit(altitude);
  function update(change: Partial<Entry>) {
    const next = { ...entries, [mission.id]: { ...entry, ...change } };
    setEntries(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setMessage("Saved on this browser only."); }
    catch { setMessage("Browser storage is unavailable. Download your work before leaving."); }
  }
  function download() {
    const report = classroomMissions.map(m => { const e = entries[m.id]; return `${m.title}\nStatus: ${e?.complete ? "Completed" : "In progress"}\nResponse: ${e?.note || "No response yet"}\nKnowledge check: ${e && e.choice >= 0 ? m.options[e.choice] : "Not answered"}\n`; }).join("\n");
    const url = URL.createObjectURL(new Blob([report], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "orbytmax-mission-journal.txt"; a.click(); URL.revokeObjectURL(url);
  }
  return <div className="mission-workspace">
    <header className="mission-heading"><p className="orbital-kicker">Observe / experiment / discover</p><h1>Small missions.<br /><em>Big discoveries.</em></h1><p>Turn space science into something you can do. Three guided activities, no account required.</p><Link href="/teachers">Teaching a class? Open the lesson desk ↗</Link></header>
    <div className="mission-toolbar"><span>{classroomMissions.filter(m => entries[m.id]?.complete).length} / 3 completed on this browser</span><button onClick={() => setHindi(!hindi)} aria-pressed={hindi}>हिन्दी title hints {hindi ? "on" : "off"}</button><button onClick={download}>Download journal</button></div>
    <p className="mission-note">Progress stays on this device and is not shared with a teacher. Avoid entering names or personal details. Hindi title hints are an early preview; full bilingual lessons are not yet available.</p>
    <div className="mission-layout"><nav aria-label="Choose a mission" className="mission-list">{classroomMissions.map((m, i) => <button key={m.id} aria-current={selected === i ? "step" : undefined} onClick={() => { setSelected(i); setMessage(""); window.history.replaceState(null, "", `?mission=${m.id}`); }}><small>0{i + 1} / {m.tag}</small><strong>{m.title}</strong>{hindi ? <span lang="hi">{m.hindi}</span> : null}<span>{entries[m.id]?.complete ? "Completed ✓" : "Open mission →"}</span></button>)}</nav>
    <article className="mission-panel" key={mission.id}><p className="orbital-kicker">{mission.tag}</p><h2>{mission.title}</h2><p><strong>Your goal:</strong> {mission.objective}</p><p>{mission.intro}</p><ol>{mission.steps.map(step => <li key={step}>{step}</li>)}</ol><Link className="btn-secondary" href={mission.href} target="_blank" rel="noopener noreferrer">{mission.tool} ↗</Link>
    {mission.id === "orbit-lab" ? <section className="orbit-experiment"><h3>Circular-orbit laboratory</h3><label htmlFor="altitude">Altitude above Earth: {altitude.toLocaleString()} km</label><input id="altitude" type="range" min="200" max="36000" step="100" value={altitude} onChange={e => setAltitude(Number(e.target.value))} /><div className="orbit-results" aria-live="polite"><span><strong>{orbit.speed.toFixed(2)}</strong> km/s</span><span><strong>{orbit.minutes.toFixed(1)}</strong> minutes / orbit</span></div><p>Idealised circular Earth orbit. Not mission-planning software; excludes drag, thrust and orbital perturbations.</p></section> : null}
    <details><summary>Indoor / low-bandwidth alternative</summary><p>{mission.alternative}</p></details>
    <fieldset disabled={!ready}><legend>{mission.question}</legend>{mission.options.map((option, i) => <label className="mission-option" key={option}><input type="radio" name={mission.id} checked={entry.choice === i} onChange={() => update({ choice: i, complete: false })} />{option}</label>)}</fieldset>
    {entry.choice >= 0 ? <p role="status">{entry.choice === mission.answer ? "Correct. " : "Try again. "}{mission.explanation}</p> : null}
    <label htmlFor="mission-note">{mission.prompt}</label><textarea id="mission-note" maxLength={3000} rows={5} value={entry.note} disabled={!ready} onChange={e => update({ note: e.target.value, complete: false })} />
    <div className="mission-toolbar"><button className="btn-primary" disabled={!ready || entry.choice !== mission.answer || entry.note.trim().length < 20} onClick={() => update({ complete: true })}>{entry.complete ? "Mission completed ✓" : "Complete mission"}</button><span>Answer correctly and write at least 20 characters.</span></div><p role="status">{message}</p>
    <button onClick={() => { if (window.confirm("Clear all mission progress saved on this browser?")) { try { localStorage.removeItem(storageKey); setEntries({}); setMessage("Local progress cleared."); } catch { setMessage("Could not clear browser storage."); } } }}>Clear local progress</button>
    </article></div></div>;
}
