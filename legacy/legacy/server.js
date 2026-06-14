'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.join(ROOT, 'data');
const NEWS_FILE = path.join(DATA_DIR, 'isro-news.json');
const GLOBAL_TLE_FILE = path.join(DATA_DIR, 'global-tles.txt');
const SEEDED_TLE_FILE = path.join(DATA_DIR, 'isro-tles.txt');
const LATEST_TLE_FILE = path.join(DATA_DIR, 'latest-satellites.tle');
const SATELLITE_REGISTRY_FILE = path.join(DATA_DIR, 'satellite-registry.json');
const MODEL_REGISTRY_FILE = path.join(DATA_DIR, 'model-registry.json');
const NEWS_TTL_MS = 15 * 60 * 1000;
const SATELLITE_TTL_MS = 30 * 60 * 1000;
const NEWS_QUERY = 'ISRO satellite launch space mission';
const NEWS_FEED_URL = `https://www.bing.com/news/search?q=${encodeURIComponent(NEWS_QUERY)}&format=rss`;
const SATELLITE_FEED_URLS = [
  'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle',
  'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle'
];
const SATELLITE_FEED_SIZE = 96;

let newsCache = null;
let newsCacheAt = 0;
let satelliteCache = null;
let satelliteCacheAt = 0;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.tle': 'text/plain; charset=utf-8',
  '.gltf': 'model/gltf+json',
  '.glb': 'model/gltf-binary',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function securityHeaders(extra = {}) {
  return {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(self), camera=(), microphone=()',
    ...extra
  };
}

function sendJson(res, status, body) {
  const text = JSON.stringify(body, null, 2);
  res.writeHead(status, securityHeaders({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  }));
  res.end(text);
}

function sendText(res, status, text, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, securityHeaders({ 'Content-Type': contentType }));
  res.end(text);
}

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function writeFileAtomic(filePath, text) {
  ensureDataDir();
  const tmp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text, 'utf8');
  fs.renameSync(tmp, filePath);
}

function readTextFile(filePath, fallback = '') {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (_) {
    return fallback;
  }
}

function readJsonFile(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

function writeJsonFile(filePath, data) {
  writeFileAtomic(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function siteOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] || 'http';
  return `${proto}://${req.headers.host || `localhost:${PORT}`}`;
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function stripTags(value) {
  return decodeEntities(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function tag(item, name) {
  const match = item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return match ? decodeEntities(match[1]).trim() : '';
}

function parseRss(xml) {
  const items = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  return items.map(item => {
    const title = stripTags(tag(item, 'title'));
    const summary = stripTags(tag(item, 'description')).replace(/\s*Read full article.*$/i, '');
    const url = stripTags(tag(item, 'link'));
    const dateRaw = stripTags(tag(item, 'pubDate'));
    const source = stripTags(tag(item, 'source')) || 'News';
    const date = dateRaw ? new Date(dateRaw) : null;
    return {
      title,
      source,
      date: date && !Number.isNaN(date.valueOf()) ? date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }) : '',
      url,
      summary
    };
  }).filter(article => article.title && article.url);
}

function fallbackNews() {
  try {
    const file = fs.readFileSync(NEWS_FILE, 'utf8');
    return JSON.parse(file);
  } catch (_) {
    return {
      updated: new Date().toISOString(),
      source: 'server fallback',
      articles: [{
        title: 'ISRO news feed temporarily unavailable',
        source: 'ORBITAL',
        date: 'Backend fallback',
        url: 'https://www.isro.gov.in/',
        summary: 'The local backend is running, but the external news feed could not be reached. The tracker and copilot continue to work.'
      }]
    };
  }
}

async function loadNews() {
  if (newsCache && Date.now() - newsCacheAt < NEWS_TTL_MS) return newsCache;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(NEWS_FEED_URL, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'ORBITAL-Satellite-Tracker/1.0' }
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`feed status ${res.status}`);
    const xml = await res.text();
    const articles = parseRss(xml)
      .filter(a => /isro|gaganyaan|chandrayaan|aditya|pslv|gslv|satellite|space/i.test(`${a.title} ${a.summary}`))
      .slice(0, 8);

    if (!articles.length) throw new Error('feed returned no matching articles');

    newsCache = {
      updated: new Date().toISOString(),
      source: 'live backend feed',
      articles
    };
    writeJsonFile(NEWS_FILE, newsCache);
    newsCacheAt = Date.now();
    return newsCache;
  } catch (err) {
    const fallback = fallbackNews();
    newsCache = {
      updated: new Date().toISOString(),
      source: `fallback (${err.message})`,
      articles: fallback.articles || []
    };
    newsCacheAt = Date.now();
    try { writeJsonFile(NEWS_FILE, newsCache); } catch (_) {}
    return newsCache;
  }
}

function validTleRaw(text) {
  return typeof text === 'string' && text.includes('\n1 ') && text.includes('\n2 ');
}

function parseTleRecords(raw) {
  const records = [];
  const seen = new Set();
  const lines = String(raw || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  for (let i = 0; i < lines.length - 2; i++) {
    const name = lines[i].replace(/^0 /, '').trim();
    const tle1 = lines[i + 1];
    const tle2 = lines[i + 2];
    if (!tle1.startsWith('1 ') || !tle2.startsWith('2 ')) continue;
    const norad = tle2.substring(2, 7).trim() || tle1.substring(2, 7).trim();
    const key = norad || name.toUpperCase();
    if (!seen.has(key)) {
      seen.add(key);
      records.push({ name, tle1, tle2, norad, key });
    }
    i += 2;
  }
  return records;
}

function recordsToTle(records) {
  return `${records.flatMap(record => [record.name, record.tle1, record.tle2]).join('\n')}\n`;
}

function mergeTleFeeds(...feeds) {
  return recordsToTle(parseTleRecords(feeds.join('\n')));
}

function shuffledRecords(records, seed) {
  const out = records.slice();
  let x = Math.max(1, Math.floor(seed) % 2147483647);
  const next = () => {
    x = (x * 48271) % 2147483647;
    return x / 2147483647;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function selectMixedTle(raw, force = false) {
  const records = parseTleRecords(raw);
  const seed = force ? Date.now() : Math.floor(Date.now() / SATELLITE_TTL_MS);
  return recordsToTle(shuffledRecords(records, seed).slice(0, Math.min(records.length, SATELLITE_FEED_SIZE)));
}

function loadSeededSatelliteCatalog() {
  return mergeTleFeeds(
    readTextFile(GLOBAL_TLE_FILE, ''),
    readTextFile(SEEDED_TLE_FILE, '')
  );
}

async function fetchText(url, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'ORBITAL-Satellite-Tracker/1.0' }
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchSatelliteLive(timeoutMs) {
  const errors = [];
  for (const url of SATELLITE_FEED_URLS) {
    try {
      const text = await fetchText(url, timeoutMs);
      if (validTleRaw(text)) return { text, url };
      errors.push(`${url}: invalid TLE`);
    } catch (err) {
      errors.push(`${url}: ${err.message}`);
    }
  }
  throw new Error(errors.join('; '));
}

async function loadSatelliteFeed(force = false) {
  if (!force && satelliteCache && Date.now() - satelliteCacheAt < SATELLITE_TTL_MS) {
    return satelliteCache;
  }

  const seeded = loadSeededSatelliteCatalog();
  try {
    const live = await fetchSatelliteLive(force ? 4500 : 9000);
    const merged = mergeTleFeeds(live.text, seeded);
    writeFileAtomic(LATEST_TLE_FILE, merged);
    satelliteCache = {
      source: `mixed live global feed (${live.url.includes('stations') ? 'stations fallback' : 'active'}) + curated ISRO catalog`,
      updated: new Date().toISOString(),
      tle: selectMixedTle(merged, force)
    };
  } catch (err) {
    const latest = readTextFile(LATEST_TLE_FILE, '');
    const fallback = validTleRaw(latest) ? mergeTleFeeds(latest, seeded) : seeded;
    satelliteCache = {
      source: validTleRaw(latest) ? `cached mixed global feed (${err.message})` : `curated mixed global catalog (${err.message})`,
      updated: new Date().toISOString(),
      tle: selectMixedTle(fallback, force)
    };
  }
  satelliteCacheAt = Date.now();
  return satelliteCache;
}

function localCopilotAnswer(question, context) {
  const q = String(question || '').toLowerCase();
  const ctx = String(context || '');
  const selected = (ctx.match(/Selected:\s*([^|]+)/i) || [])[1]?.trim();
  const orbit = (ctx.match(/Orbit:\s*([^|]+)/i) || [])[1]?.trim();
  const alt = (ctx.match(/Alt:\s*([^|]+)/i) || [])[1]?.trim();
  const speed = (ctx.match(/Speed:\s*([^|]+)/i) || [])[1]?.trim();
  const count = (ctx.match(/Tracking\s+([\d,]+)\s+satellites/i) || [])[1];

  if (selected && /(selected|current|altitude|where|position|speed|orbit|this)/.test(q)) {
    return `Based on currently loaded data, **${selected}** is in a **${orbit || 'tracked'}** orbit at about **${alt || 'unknown altitude'}**, moving near **${speed || 'unknown speed'}**. These values are propagated from the loaded TLE data and change with time.`;
  }
  if (q.includes('iss')) return 'The **ISS** is a crewed station in low Earth orbit. It usually flies near 400 km altitude and completes an orbit roughly every 90 minutes. Select ISS in ORBITAL for live propagated position details.';
  if (q.includes('leo') || q.includes('geo') || q.includes('meo')) return '**LEO** is close and fast, **MEO** is common for navigation satellites, and **GEO** is high enough that a satellite appears fixed over one longitude.';
  if (q.includes('tle')) return 'A **TLE** is a compact two-line orbital dataset. ORBITAL uses TLEs with satellite.js to estimate satellite positions, speeds, and orbit paths.';
  if (q.includes('starlink')) return '**Starlink** is a large LEO broadband constellation. User terminals switch between satellites overhead while traffic routes through gateways or laser links.';
  if (q.includes('count') || q.includes('how many')) return count ? `ORBITAL currently has **${count} satellites** loaded from the active catalog.` : 'The loaded object count is shown in the top tracking counter and changes when live data refreshes.';
  return 'I can answer questions about satellites, TLEs, LEO/MEO/GEO orbits, ISS, Starlink, ISRO missions, and the selected satellite in ORBITAL.';
}

async function handleCopilot(req, res) {
  let raw = '';
  req.on('data', chunk => {
    raw += chunk;
    if (raw.length > 64_000) req.destroy();
  });
  req.on('end', () => {
    try {
      const body = raw ? JSON.parse(raw) : {};
      const answer = localCopilotAnswer(body.question, body.context);
      sendJson(res, 200, { answer, source: 'local backend' });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
  });
}

function getSatelliteRegistry() {
  const satellites = readJsonFile(SATELLITE_REGISTRY_FILE, []);
  return Array.isArray(satellites) ? satellites : [];
}

function getModelRegistry() {
  const models = readJsonFile(MODEL_REGISTRY_FILE, []);
  return Array.isArray(models) ? models : [];
}

function renderSatelliteDetail(req, res, slug) {
  const satellites = getSatelliteRegistry();
  const models = getModelRegistry();
  const sat = satellites.find(item => item.slug === slug || item.id === slug);
  if (!sat) {
    const origin = siteOrigin(req);
    sendText(res, 404, `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Satellite not found - ORBITAL</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body class="detail-page">
  <main class="sat-detail-shell">
    <a class="detail-back" href="/">Back to tracker</a>
    <section class="sat-detail-hero">
      <p class="detail-kicker">Missing satellite</p>
      <h1>Satellite not found</h1>
      <p>The requested satellite page is not in the ORBITAL registry yet.</p>
      <a class="detail-primary" href="${origin}/#satellites">Browse satellites</a>
    </section>
  </main>
</body>
</html>`, 'text/html; charset=utf-8');
    return;
  }

  const origin = siteOrigin(req);
  const canonical = `${origin}/satellite/${encodeURIComponent(sat.slug)}`;
  const model = models.find(item => item.id === sat.modelId || item.satelliteId === sat.id);
  const related = (sat.relatedSatellites || [])
    .map(id => satellites.find(item => item.id === id || item.slug === id))
    .filter(Boolean);
  const title = sat.seoTitle || `${sat.name} - ORBITAL`;
  const description = sat.seoDescription || sat.shortDescription || sat.description || `Track and learn about ${sat.name}.`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    mainEntity: {
      '@type': 'Thing',
      name: sat.name,
      identifier: sat.noradId ? `NORAD ${sat.noradId}` : sat.id,
      description: sat.description
    }
  };
  const timelineHtml = (sat.timeline || []).map(event => `
        <li>
          <span>${escapeHtml(event.date)}</span>
          <strong>${escapeHtml(event.title)}</strong>
        </li>`).join('');
  const factsHtml = (sat.facts || []).map(fact => `<li>${escapeHtml(fact)}</li>`).join('');
  const relatedHtml = related.map(item => `<a href="/satellite/${escapeHtml(item.slug)}">${escapeHtml(item.name)}</a>`).join('');
  const modelHtml = model?.embedUid ? `
        <iframe
          title="${escapeHtml(model.attribution)}"
          src="https://sketchfab.com/models/${escapeHtml(model.embedUid)}/embed?autostart=0&preload=1&ui_infos=0&transparent=1"
          allow="autoplay; fullscreen; xr-spatial-tracking"
          allowfullscreen></iframe>` : `
        <div class="detail-model-fallback">
          <span>3D fallback</span>
          <strong>${escapeHtml(model?.fallbackType || 'procedural model')}</strong>
        </div>`;

  const jsonLdText = JSON.stringify(jsonLd).replace(/<\//g, '<\\/');

  sendText(res, 200, `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <link rel="stylesheet" href="/styles.css">
  <script type="application/ld+json">${jsonLdText}</script>
</head>
<body class="detail-page">
  <main class="sat-detail-shell">
    <nav class="detail-breadcrumb" aria-label="Breadcrumb">
      <a href="/">Tracker</a>
      <span>/</span>
      <a href="/#satellites">Satellites</a>
      <span>/</span>
      <span>${escapeHtml(sat.name)}</span>
    </nav>
    <section class="sat-detail-hero">
      <div>
        <p class="detail-kicker">${escapeHtml(sat.missionType)}</p>
        <h1>${escapeHtml(sat.name)}</h1>
        <p>${escapeHtml(sat.shortDescription)}</p>
        <div class="detail-actions">
          <a class="detail-primary" href="/#sky-tonight">Find visible passes</a>
          <a class="detail-secondary" href="/#alerts" data-follow-satellite="${escapeHtml(sat.id)}">Follow satellite</a>
        </div>
      </div>
      <div class="detail-model" aria-label="${escapeHtml(sat.name)} 3D model">
        ${modelHtml}
      </div>
    </section>
    <section class="detail-grid" aria-label="Satellite details">
      <article>
        <h2>Mission Summary</h2>
        <p>${escapeHtml(sat.description)}</p>
        <dl class="detail-facts">
          <div><dt>NORAD</dt><dd>${escapeHtml(sat.noradId || 'Not available')}</dd></div>
          <div><dt>Agency</dt><dd>${escapeHtml(sat.agency)}</dd></div>
          <div><dt>Country</dt><dd>${escapeHtml(sat.country)}</dd></div>
          <div><dt>Launch</dt><dd>${escapeHtml(sat.launchDate)}</dd></div>
          <div><dt>Orbit</dt><dd>${escapeHtml(sat.orbitType)}</dd></div>
          <div><dt>Altitude</dt><dd>${escapeHtml(sat.altitude)}</dd></div>
          <div><dt>Inclination</dt><dd>${escapeHtml(sat.inclination)}</dd></div>
        </dl>
      </article>
      <aside>
        <h2>Interesting Facts</h2>
        <ul class="detail-list">${factsHtml}</ul>
      </aside>
    </section>
    <section class="detail-grid">
      <article>
        <h2>Mission Timeline</h2>
        <ol class="detail-timeline">${timelineHtml}</ol>
      </article>
      <aside>
        <h2>Model Attribution</h2>
        <p>${escapeHtml(model?.attribution || 'Procedural model generated by ORBITAL.')}</p>
        ${model?.sourceUrl ? `<a href="${escapeHtml(model.sourceUrl)}" target="_blank" rel="noopener">View model source</a>` : ''}
        <p class="detail-note">Commercial use: ${model?.commercialUseAllowed ? 'allowed by registry' : 'not verified or not allowed'}. Modification: ${model?.modificationAllowed ? 'allowed by registry' : 'not verified or not allowed'}.</p>
      </aside>
    </section>
    <section class="detail-related">
      <h2>Related Satellites</h2>
      <div>${relatedHtml || '<span>No related satellites yet.</span>'}</div>
    </section>
  </main>
</body>
</html>`, 'text/html; charset=utf-8');
}

function renderSitemap(req, res) {
  const origin = siteOrigin(req);
  const urls = [
    `${origin}/`,
    `${origin}/#sky-tonight`,
    `${origin}/#satellites`,
    `${origin}/#education`,
    `${origin}/#alerts`,
    ...getSatelliteRegistry().map(sat => `${origin}/satellite/${encodeURIComponent(sat.slug)}`)
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url><loc>${escapeHtml(url)}</loc></url>`).join('\n')}
</urlset>`;
  sendText(res, 200, xml, 'application/xml; charset=utf-8');
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const requested = decodeURIComponent(url.pathname);
  const rel = requested === '/' ? 'index.html' : requested.replace(/^\/+/, '');
  const abs = path.resolve(ROOT, rel);

  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) {
    sendText(res, 403, 'Forbidden');
    return;
  }

  fs.readFile(abs, (err, data) => {
    if (err) {
      sendText(res, 404, 'Not found');
      return;
    }
    const ext = path.extname(abs).toLowerCase();
    res.writeHead(200, securityHeaders({
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=60'
    }));
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && url.pathname === '/api/health') {
    sendJson(res, 200, { ok: true, time: new Date().toISOString() });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/isro-news') {
    sendJson(res, 200, await loadNews());
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/satellites') {
    const feed = await loadSatelliteFeed(url.searchParams.get('refresh') === '1');
    res.writeHead(200, {
      ...securityHeaders(),
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-ORBITAL-Source': feed.source,
      'X-ORBITAL-Updated': feed.updated
    });
    res.end(feed.tle);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/sitemap.xml') {
    renderSitemap(req, res);
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/satellite/')) {
    renderSatelliteDetail(req, res, decodeURIComponent(url.pathname.split('/').filter(Boolean)[1] || ''));
    return;
  }

  if (req.method === 'GET' && ['/sky-tonight', '/satellites', '/education', '/alerts'].includes(url.pathname)) {
    const hash = url.pathname.slice(1);
    res.writeHead(302, { Location: `/#${hash}` });
    res.end();
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/copilot') {
    handleCopilot(req, res);
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendText(res, 405, 'Method not allowed');
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`ORBITAL server running at http://localhost:${PORT}`);
});
