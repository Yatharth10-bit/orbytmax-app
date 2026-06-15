'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const NEWS_TTL_MS = 15 * 60 * 1000;
const NEWS_QUERY = 'ISRO satellite launch space mission';
const NEWS_FEED_URL = `https://www.bing.com/news/search?q=${encodeURIComponent(NEWS_QUERY)}&format=rss`;

let newsCache = null;
let newsCacheAt = 0;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sendJson(res, status, body) {
  const text = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(text);
}

function sendText(res, status, text, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(text);
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
    const file = fs.readFileSync(path.join(ROOT, 'data', 'isro-news.json'), 'utf8');
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
    return newsCache;
  }
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
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=60'
    });
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
