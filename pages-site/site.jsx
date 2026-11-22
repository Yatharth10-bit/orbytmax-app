import React, {useEffect} from "react";
import {createRoot} from "react-dom/client";
import Link, {publicPath} from "./link";
import Home from "@/app/page";
import Tracker from "@/app/tracker/page";
import Sky from "@/app/whats-overhead/page";
import Parts from "@/app/education/parts/page";
import Quiz from "@/app/education/quiz/page";
import Isro from "@/app/education/isro/page";
import Global from "@/app/education/global/page";
import IssGuide from "@/app/learn/how-to-see-iss-tonight/page";
import OrbitGuide from "@/app/learn/leo-vs-geo/page";
import FallGuide from "@/app/learn/why-satellites-dont-fall/page";
import Missions from "@/app/missions/page";
import Teachers from "@/app/teachers/page";
import Newsletter from "@/app/newsletter/page";
import {ExploreCatalog} from "@/components/explore-catalog";
import {MissionDetail} from "@/components/mission-detail";
import {SatelliteModelPanel} from "@/components/satellite-model-panel";
import {SectionHeader} from "@/components/neo-ui";
import {SEED_SATELLITES} from "@/lib/seed-catalog";
import {ISRO_MISSIONS, GLOBAL_MISSIONS} from "@/lib/education-content";

const catalog = () => <ExploreCatalog satellites={SEED_SATELLITES}/>;
const routes = {
  "/": ["OrbytMax", Home], "/tracker": ["Satellite tracker", Tracker],
  "/sky-tonight": ["Sky tonight", Sky], "/whats-overhead": ["Sky tonight", Sky],
  "/satellites": ["Satellites", catalog], "/explore": ["Explore", catalog],
  "/education": ["Education",catalog], "/learn": ["Learning guides",catalog],
  "/education/isro": ["ISRO mission library",Isro], "/education/global": ["Global mission library",Global],
  "/education/parts": ["Parts of a satellite",Parts], "/education/quiz": ["Orbit basics quiz",Quiz],
  "/learn/how-to-see-iss-tonight":["See the ISS",IssGuide], "/learn/leo-vs-geo":["LEO vs GEO",OrbitGuide],
  "/learn/why-satellites-dont-fall":["Why satellites stay in orbit",FallGuide],
  "/missions":["Guided missions",Missions], "/teachers":["Teacher desk",Teachers],
  "/newsletter":["The Downlink",Newsletter]
};
const nav = [["/","Home"],["/tracker","Tracker"],["/whats-overhead","Sky Tonight"],["/explore","Explore"],["/missions","Missions"],["/black-hole-explorer/","Black Hole Explorer"]];
function Satellite({sat}) {
  return <article className="mx-auto max-w-6xl px-4 py-10"><SectionHeader eyebrow={sat.agency} title={sat.name} copy={sat.description}/>
    <div className="mt-8 grid gap-4 sm:grid-cols-2"><section className="card"><h2>Mission facts</h2><ul>{sat.facts.map(f=><li key={f}>{f}</li>)}</ul></section>
    <section className="card"><h2>Orbit</h2><p>{sat.orbitType} � {sat.altitude || sat.missionType}</p><p>Launch: {sat.launchDate}</p>
    <Link className="neo-button mt-4" href={"/tracker?follow=1&norad="+encodeURIComponent(sat.noradId || "")+"&satellite="+sat.slug}>Open tracker</Link></section></div>
    {sat.model && <div className="mt-8"><SatelliteModelPanel {...sat.model} name={sat.name} modelUrl={publicPath(sat.model.modelUrl)} /></div>}
  </article>;
}
for (const sat of SEED_SATELLITES) routes["/satellite/"+sat.slug]=[sat.name,()=> <Satellite sat={sat}/>];
for (const [folder,items] of [["isro",ISRO_MISSIONS],["global",GLOBAL_MISSIONS]]) {
  for (const item of items) {
    const mission={...item,model:item.model && {...item.model,modelUrl:publicPath(item.model.modelUrl)}};
    routes["/education/"+folder+"/"+item.slug]=[item.name,()=> <MissionDetail mission={mission} backHref={"/education/"+folder} backLabel="Mission library"/>];
  }
}
export const pageTitles = Object.fromEntries(Object.entries(routes).map(([path,[title]])=>[path,title]));
export function Site({path}) {
  const Page=routes[path]?.[1];
  useEffect(()=>{
    if (location.hash) requestAnimationFrame(()=>document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView());
  },[path]);
  return <><header className="border-b-2 border-[var(--border)] bg-[var(--paper)]"><div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
    <Link href="/" className="brand-wordmark flex items-center gap-2 font-extrabold"><span className="h-4 w-4 rounded-full border-2 bg-[var(--accent-2)]"/>OrbytMax</Link>
    <nav className="flex flex-wrap gap-1" aria-label="Main">{nav.map(([href,label])=><Link key={href} href={href} aria-current={path===href?"page":undefined} className={"rounded-full border-2 px-3 py-1 text-sm font-bold "+(path===href?"border-[var(--border)] bg-[var(--accent-2)]":"border-transparent")}>{label}</Link>)}</nav>
    </div></header><main>{Page ? <Page/> : <section className="mx-auto max-w-6xl p-8"><h1>Page not found</h1><Link href="/">Return to OrbytMax</Link></section>}</main>
    <footer className="site-footer"><nav aria-label="Footer"><Link href="/teachers">Teachers</Link><Link href="/newsletter">The Downlink</Link><Link href="/education/quiz">Orbit quiz</Link></nav></footer></>;
}
if (typeof document!=="undefined") {
  const path=location.pathname.slice(__SITE_BASE__.length).replace(/\/(index\.html)?$/,"") || "/";
  createRoot(document.getElementById("app")).render(<Site path={path}/>);
}
