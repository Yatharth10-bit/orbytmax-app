import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import {build} from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import React from "react";
import {renderToString} from "react-dom/server";

const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
const out = path.resolve("pages-dist");
const base = process.env.PAGES_BASE_PATH ?? "/orbytmax-app";
if (!/^([/][\w-]+)*$/.test(base)) throw Error("Invalid Pages base path");
await fs.mkdir(path.join(out,"assets"),{recursive:true});
const adapters = {
  "next/link":"link.jsx","next/image":"image.jsx","next/dynamic":"dynamic.jsx",
  "@/lib/app-fetch":"api.js","@/lib/api":"json.js","@/components/newsletter-signup":"subscribe.jsx"
};
const alias = Object.fromEntries(Object.entries(adapters).map(([name,file])=>[name,path.resolve("pages-site",file)]));
const options = {entryPoints:["pages-site/site.jsx"],bundle:true,alias,tsconfig:"tsconfig.json",jsx:"automatic",
  define:{__SITE_BASE__:JSON.stringify(base),"process.env.NODE_ENV":'"production"',"process.env.NEXT_PUBLIC_BASE_PATH":JSON.stringify(base)}};
await build({...options,platform:"browser",format:"esm",splitting:true,minify:true,
  entryNames:"site",chunkNames:"chunks/[name]-[hash]",outdir:path.join(out,"assets")});
const serverFile = path.resolve("node_modules/.cache/orbytmax-pages/render.cjs");
await build({...options,platform:"node",packages:"external",format:"cjs",outfile:serverFile});
const {Site,pageTitles}=(await import(pathToFileURL(serverFile))).default;

const cssPath=path.resolve("src/app/globals.css");
const {css}=await postcss([tailwind({base:root})]).process(await fs.readFile(cssPath,"utf8"),{from:cssPath});
const extra=await Promise.all(["learning","missions"].map(name=>fs.readFile("src/app/"+name+".css","utf8")));
const fonts=`@font-face{font-family:Syne;src:url('./fonts/Syne.ttf');font-weight:400 800;font-display:swap}
@font-face{font-family:SpaceMono;src:url('./fonts/SpaceMono-Regular.ttf');font-weight:400;font-display:swap}
@font-face{font-family:SpaceMono;src:url('./fonts/SpaceMono-Bold.ttf');font-weight:700;font-display:swap}
:root{--font-display:Syne;--font-terminal:SpaceMono}body{font-family:Syne,system-ui,sans-serif}`;
await fs.writeFile(path.join(out,"assets/site.css"),[fonts,css,...extra].join("\n"));
await fs.cp("src/app/fonts",path.join(out,"assets/fonts"),{recursive:true});
await fs.cp("public",out,{recursive:true});
await fs.copyFile("src/app/favicon.ico",path.join(out,"favicon.ico"));
const blackHole=path.join(out,"black-hole-explorer/index.html");
await fs.writeFile(blackHole,(await fs.readFile(blackHole,"utf8")).replaceAll('href="/black-hole-explorer/','href="'+base+'/black-hole-explorer/').replace('href="/"','href="'+base+'/"'));
function escape(s){return s.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll('"',"&quot;");}
for (const [route,title] of Object.entries({...pageTitles,"/404":"Page not found"})) {
  const markup=renderToString(React.createElement(Site,{path:route}));
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#ffcf24"><title>${escape(title)} � OrbytMax</title><link rel="icon" href="${base}/favicon.ico"><link rel="stylesheet" href="${base}/assets/site.css"></head><body class="starfield"><div id="app">${markup}</div><script type="module" src="${base}/assets/site.js"></script></body></html>`;
  const file=route==="/404"?path.join(out,"404.html"):path.join(out,route,"index.html");
  await fs.mkdir(path.dirname(file),{recursive:true});
  await fs.writeFile(file,html);
}
await fs.writeFile(path.join(out,".nojekyll"),"");
console.log(`Built ${Object.keys(pageTitles).length} OrbytMax pages at ${base || "/"}`);
