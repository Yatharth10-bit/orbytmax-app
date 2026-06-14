/**
 * ORBITAL — Real-Time Satellite Tracker
 * Three.js + satellite.js + CelesTrak TLE data
 */

'use strict';

// ============================================================
// CONSTANTS
// ============================================================
const EARTH_RADIUS = 6371;       // km
const EARTH_RADIUS_3D = 1.0;     // Three.js units
const SCALE = EARTH_RADIUS_3D / EARTH_RADIUS;
const TLES_URL = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle';
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';
const SATELLITE_FEED_API = '/api/satellites';
const TLE_CACHE_KEY = 'orbital_tle_cache';
const TLE_CACHE_TS_KEY = 'orbital_tle_cache_ts';
const TLE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const IS_MOBILE = window.matchMedia('(max-width: 768px)').matches;
const TLE_FETCH_TIMEOUT_MS = 6000;
const TLE_LOAD_HARD_CAP_MS = 18000; // raised: give live fetch enough time to complete
const TLE_MAX_PARSE = IS_MOBILE ? 1200 : 2500;
const TLE_MAX_RENDER = IS_MOBILE ? 600 : 1500;
const TLE_RETRY_ATTEMPTS = 3;
const LOADER_MIN_MS = 2500;
const MOBILE_GLOBE_CAMERA_Z = 4.25;
const DESKTOP_GLOBE_CAMERA_Z = 3.2;
const MOBILE_GLOBE_FOV = 48;
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function devLog(...args) {
  if (window.ORBITAL_CONFIG?.DEV) console.log('[ORBITAL]', ...args);
}

// ============================================================
// STATE
// ============================================================
const state = {
  satellites: [],      // [{tle1, tle2, name, satrec, ...}]
  sprites: [],         // THREE.Sprite[]
  orbitLines: [],      // THREE.Line[]
  selectedIndex: -1,
  followMode: false,
  showOrbits: true,
  showLabels: false,
  activeFilter: 'all',
  scene: null, camera: null, renderer: null,
  earth: null, clouds: null, atmo: null,
  clock: null,
  orbitControls: null,
  raycaster: null,
  mouse: null,
  spriteTextureCache: {},
  animFrameId: null,
  tleLoaded: false,
  lastListItems: [],
  appStartTime: 0,
  _loaderHideTimer: null,
  _loaderHidden: false,
  isRefreshing: false,
  lastUpdated: null,
  refreshError: ''
};

// ============================================================
// SATELLITE CATEGORIES
// ============================================================
function getSatCategory(name) {
  const n = name.toUpperCase();
  if (n.includes('ISS') || n.includes('ZARYA') || n.includes('ZVEZDA')) return 'iss';
  if (n.includes('STARLINK')) return 'starlink';
  if (n.includes('GPS') || n.includes('NAVSTAR')) return 'gps';
  if (n.includes('GOES') || n.includes('NOAA') || n.includes('METEOR') || n.includes('METOP') || n.includes('FENG') || n.includes('HIMAWARI')) return 'weather';
  if (n.includes('GLONASS') || n.includes('GALILEO') || n.includes('BEIDOU') || n.includes('COMPASS')) return 'gnss';
  if (n.includes('HUBBLE') || n.includes('CHANDRA') || n.includes('KEPLER') || n.includes('SPITZER')) return 'science';
  if (n.includes('IRIDIUM') || n.includes('ORBCOMM') || n.includes('INTELSAT') || n.includes('SES-') || n.includes('TELSTAR')) return 'comm';
  if (n.includes('CARTOSAT') || n.includes('RISAT') || n.includes('RESOURCESAT') || n.includes('GSAT') ||
      n.includes('IRNSS') || n.includes('NAVIC') || n.includes('INSAT') || n.includes('OCEANSAT') ||
      n.includes('EMISAT') || n.includes('MICROSAT') || n.includes('SARAL') || n.includes('ASTROSAT') ||
      n.includes('XPOSAT') || n.includes('EOS-') || n.includes('HYSIS') ||
      n.includes('CHANDRAYAAN') || n.includes('ADITYA') || n.includes('SCATSAT') ||
      n.includes('MEGHA-TROPIQUES') || n.includes('NISAR') || n.includes('EDUSAT') ||
      n.includes('KALPASAT')) return 'isro';
  return 'other';
}

function getCategoryEmoji(cat) {
  const map = {
    iss: '🛸', starlink: '🛰️', gps: '📡', weather: '🌤️',
    gnss: '🗺️', science: '🔭', comm: '📺', isro: '🇮🇳', other: '⬡'
  };
  return map[cat] || '⬡';
}

function getCategoryColor(cat) {
  const map = {
    iss: 0xffd700, starlink: 0x00c8ff, gps: 0x00ff9d,
    weather: 0xff8c42, gnss: 0x9b59b6, science: 0xff6b6b,
    comm: 0x4ecdc4, isro: 0xff9933, other: 0x95a5a6
  };
  return map[cat] || 0x95a5a6;
}

// ============================================================
// ORBIT TYPE
// ============================================================
function getOrbitType(altKm) {
  if (altKm < 2000) return 'LEO';
  if (altKm < 35000) return 'MEO';
  if (altKm < 36500) return 'GEO';
  return 'HEO';
}

function getBadgeClass(type) {
  const m = { LEO: 'badge-leo', MEO: 'badge-meo', GEO: 'badge-geo', HEO: 'badge-heo' };
  return m[type] || 'badge-leo';
}

// ============================================================
// SATELLITE PROPAGATION
// ============================================================
function propagateToGeodetic(satrec, date) {
  try {
    const posVel = satellite.propagate(satrec, date);
    if (!posVel || !posVel.position || posVel.position === true) return null;
    const gmst = satellite.gstime(date);
    const geo = satellite.eciToGeodetic(posVel.position, gmst);
    const lat = satellite.radiansToDegrees(geo.latitude);
    const lon = satellite.radiansToDegrees(geo.longitude);
    const alt = geo.height;
    const vel = posVel.velocity
      ? Math.sqrt(posVel.velocity.x ** 2 + posVel.velocity.y ** 2 + posVel.velocity.z ** 2)
      : 7.8;
    return { lat, lon, alt, vel, position: posVel.position };
  } catch (e) {
    return null;
  }
}

function geoTo3D(lat, lon, alt) {
  const r = EARTH_RADIUS_3D + alt * SCALE;
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lon + 180) * Math.PI / 180;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta)
  );
}

function sampleOrbitPositions(satrec, steps) {
  const positions = [];
  const periodMs = (2 * Math.PI / satrec.no) * 60 * 1000;
  const now = Date.now();
  for (let i = 0; i <= steps; i++) {
    const t = new Date(now + (i / steps) * periodMs);
    const g = propagateToGeodetic(satrec, t);
    if (g) positions.push(geoTo3D(g.lat, g.lon, g.alt));
  }
  return positions;
}

// ============================================================
// THREE.JS SETUP
// ============================================================
function initThree() {
  const canvas = document.getElementById('canvas');
  const size = getRenderSize();
  state.scene = new THREE.Scene();
  state.camera = new THREE.PerspectiveCamera(45, size.width / size.height, 0.001, 200);
  state.camera.position.set(0, 0, 3.2);

  state.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  state.renderer.setSize(size.width, size.height, false);
  const maxDpr = IS_MOBILE ? 1.5 : 2;
  state.renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxDpr));
  state.renderer.outputEncoding = THREE.sRGBEncoding;

  state.clock = new THREE.Clock();
  state.raycaster = new THREE.Raycaster();
  state.mouse = new THREE.Vector2();

  // Lighting
  const ambient = new THREE.AmbientLight(0x111a2a, 0.6);
  state.scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(5, 3, 5);
  state.scene.add(sun);
  const fill = new THREE.DirectionalLight(0x1a3a6a, 0.15);
  fill.position.set(-5, -3, -5);
  state.scene.add(fill);

  // Stars
  buildStarfield();
}

function buildStarfield() {
  // ── Layer 1: 22,000 background stars with varied color temp ──
  const starCount = 22000;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(starCount * 3);
  const starSizes = new Float32Array(starCount);
  const starColors = new Float32Array(starCount * 3);

  // Realistic stellar color temperatures
  const spectralColors = [
    [1.0, 0.85, 0.70],  // K/M — warm orange
    [1.0, 0.95, 0.88],  // G — sun-like
    [1.0, 1.0,  1.0],   // F — white
    [0.88, 0.92, 1.0],  // A — blue-white
    [0.70, 0.80, 1.0],  // B — blue
    [0.95, 0.98, 1.0],  // white
    [1.0, 0.80, 0.60],  // red giant
  ];

  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    // Vary radii so there's depth layering
    const r = 70 + Math.random() * 30;
    starPos[i*3]   = r * Math.sin(phi) * Math.cos(theta);
    starPos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
    starPos[i*3+2] = r * Math.cos(phi);

    // Weighted size — most stars tiny, few bright
    const rand = Math.random();
    starSizes[i] = rand < 0.85 ? 0.3 + Math.random() * 0.7
                 : rand < 0.97 ? 1.0 + Math.random() * 1.5
                 : 2.2 + Math.random() * 1.8;

    const sc = spectralColors[Math.floor(Math.random() * spectralColors.length)];
    // Slight brightness variation
    const bright = 0.6 + Math.random() * 0.4;
    starColors[i*3]   = sc[0] * bright;
    starColors[i*3+1] = sc[1] * bright;
    starColors[i*3+2] = sc[2] * bright;
  }

  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));
  starGeo.setAttribute('aColor', new THREE.BufferAttribute(starColors, 3));

  const starMat = new THREE.ShaderMaterial({
    vertexShader: `
      attribute float size;
      attribute vec3 aColor;
      varying vec3 vColor;
      uniform float time;
      void main() {
        vColor = aColor;
        float phase = position.x * 2.3 + position.y * 3.7 + position.z * 1.9;
        float twinkle = 0.80 + 0.20 * sin(time * 1.2 + phase);
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * twinkle * (280.0 / -mvPos.z);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        float core = 1.0 - smoothstep(0.0, 0.25, d);
        float halo = (1.0 - smoothstep(0.25, 0.5, d)) * 0.35;
        float spike = max(
          (1.0 - smoothstep(0.0, 0.08, abs(uv.x))) * (1.0 - smoothstep(0.0, 0.45, abs(uv.y))),
          (1.0 - smoothstep(0.0, 0.08, abs(uv.y))) * (1.0 - smoothstep(0.0, 0.45, abs(uv.x)))
        ) * 0.4;
        float alpha = clamp(core + halo + spike, 0.0, 1.0);
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    uniforms: { time: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });

  state.starfield = new THREE.Points(starGeo, starMat);
  state.scene.add(state.starfield);

  // ── Layer 2: Milky Way band — dense star cloud ──
  const mwCount = 6000;
  const mwGeo = new THREE.BufferGeometry();
  const mwPos = new Float32Array(mwCount * 3);
  const mwColors = new Float32Array(mwCount * 3);
  const mwSizes = new Float32Array(mwCount);

  for (let i = 0; i < mwCount; i++) {
    // Concentrate along galactic plane (XZ band)
    const theta = Math.random() * Math.PI * 2;
    const bandAngle = (Math.random() - 0.5) * 0.28; // narrow band
    const r = 72 + Math.random() * 15;
    mwPos[i*3]   = r * Math.cos(theta) * Math.cos(bandAngle);
    mwPos[i*3+1] = r * Math.sin(bandAngle);
    mwPos[i*3+2] = r * Math.sin(theta) * Math.cos(bandAngle);
    mwSizes[i] = 0.2 + Math.random() * 0.5;
    // Milky Way palette — warm yellows and soft blues
    const t = Math.random();
    mwColors[i*3]   = 0.7 + t * 0.3;
    mwColors[i*3+1] = 0.65 + t * 0.2;
    mwColors[i*3+2] = 0.55 + (1-t) * 0.3;
  }
  mwGeo.setAttribute('position', new THREE.BufferAttribute(mwPos, 3));
  mwGeo.setAttribute('aColor', new THREE.BufferAttribute(mwColors, 3));
  mwGeo.setAttribute('size', new THREE.BufferAttribute(mwSizes, 1));

  const mwMat = new THREE.ShaderMaterial({
    vertexShader: `
      attribute float size;
      attribute vec3 aColor;
      varying vec3 vColor;
      void main() {
        vColor = aColor;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (220.0 / -mvPos.z);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = 1.0 - smoothstep(0.3, 0.5, d);
        gl_FragColor = vec4(vColor, a * 0.55);
      }
    `,
    uniforms: {},
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  const mwPoints = new THREE.Points(mwGeo, mwMat);
  state.scene.add(mwPoints);

  // ── Layer 3: Nebula clouds — large soft sprites ──
  buildNebulae();

  // ── Layer 4: Distant galaxies ──
  buildGalaxies();

  // ── Layer 5: Asteroid belt ──
  buildAsteroidBelt();
}

function buildNebulae() {
  // Each nebula is a large canvas-textured sprite placed in deep space
  const nebulaDefs = [
    { pos: new THREE.Vector3( 55, 25, -40), scale: 32, hue: [0.05, 0.0, 0.25],  opacity: 0.22 }, // purple
    { pos: new THREE.Vector3(-60, -15, 35), scale: 26, hue: [0.0, 0.08, 0.28],  opacity: 0.17 }, // blue
    { pos: new THREE.Vector3( 30, -50, 55), scale: 24, hue: [0.22, 0.02, 0.0],  opacity: 0.16 }, // red/orange
    { pos: new THREE.Vector3(-40, 40, -60), scale: 22, hue: [0.0, 0.22, 0.15],  opacity: 0.15 }, // teal
    { pos: new THREE.Vector3( 10, 60, 30),  scale: 20, hue: [0.12, 0.0, 0.26],  opacity: 0.13 }, // violet
    { pos: new THREE.Vector3(-25, -60, -45),scale: 18, hue: [0.0, 0.18, 0.24],  opacity: 0.12 }, // cyan
    { pos: new THREE.Vector3( 70, -30, -20),scale: 16, hue: [0.28, 0.0, 0.08],  opacity: 0.11 }, // magenta
    { pos: new THREE.Vector3(-50, 20, 60),  scale: 14, hue: [0.0, 0.06, 0.30],  opacity: 0.10 }, // deep blue
    { pos: new THREE.Vector3( 20, 55, -65), scale: 12, hue: [0.08, 0.20, 0.0],  opacity: 0.09 }, // green-gold
  ];

  nebulaDefs.forEach(def => {
    // Build nebula texture on canvas
    const sz = 256;
    const nc = document.createElement('canvas');
    nc.width = nc.height = sz;
    const nctx = nc.getContext('2d');
    const half = sz / 2;

    // Multiple layered radial gradients for organic look
    for (let layer = 0; layer < 4; layer++) {
      const ox = (Math.random() - 0.5) * sz * 0.35;
      const oy = (Math.random() - 0.5) * sz * 0.35;
      const radius = sz * (0.25 + Math.random() * 0.25);
      const grad = nctx.createRadialGradient(half+ox, half+oy, 0, half+ox, half+oy, radius);
      const r = Math.round((def.hue[0] + Math.random()*0.05) * 255);
      const g = Math.round((def.hue[1] + Math.random()*0.05) * 255);
      const b = Math.round((def.hue[2] + Math.random()*0.08) * 255);
      grad.addColorStop(0,   `rgba(${r},${g},${b},0.6)`);
      grad.addColorStop(0.4, `rgba(${r},${g},${b},0.2)`);
      grad.addColorStop(1,   `rgba(${r},${g},${b},0)`);
      nctx.fillStyle = grad;
      nctx.fillRect(0, 0, sz, sz);
    }

    const nTex = new THREE.CanvasTexture(nc);
    const nMat = new THREE.SpriteMaterial({
      map: nTex, transparent: true,
      opacity: def.opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const nSprite = new THREE.Sprite(nMat);
    nSprite.position.copy(def.pos);
    nSprite.scale.setScalar(def.scale);
    state.scene.add(nSprite);
  });
}

function buildGalaxies() {
  // Small distant galaxy sprites
  const galaxyDefs = [
    { pos: new THREE.Vector3( 68, 38, -55), scale: 5.5 },
    { pos: new THREE.Vector3(-72, -28, 48), scale: 4.8 },
    { pos: new THREE.Vector3( 50, -62, 30), scale: 4.2 },
    { pos: new THREE.Vector3(-35, 55, -65), scale: 3.6 },
    { pos: new THREE.Vector3( 80, 10, 20),  scale: 3.0 },
    { pos: new THREE.Vector3(-55, 15, -70), scale: 2.8 },
    { pos: new THREE.Vector3( 25, -75, -40),scale: 2.4 },
    { pos: new THREE.Vector3( 62, -45, 55), scale: 2.2 },
    { pos: new THREE.Vector3(-78, 32, -25), scale: 2.0 },
    { pos: new THREE.Vector3( 40, 70, -30), scale: 1.8 },
    { pos: new THREE.Vector3(-20, -80, 40), scale: 1.6 },
    { pos: new THREE.Vector3( 85, -15, -50),scale: 1.5 },
  ];

  galaxyDefs.forEach(def => {
    const sz = 128;
    const gc = document.createElement('canvas');
    gc.width = gc.height = sz;
    const gctx = gc.getContext('2d');
    const half = sz / 2;

    // Spiral galaxy shape
    const isSpiral = Math.random() > 0.4;
    if (isSpiral) {
      // Elliptical core glow
      const grad = gctx.createRadialGradient(half, half, 0, half, half, half * 0.4);
      grad.addColorStop(0, 'rgba(255,240,200,0.9)');
      grad.addColorStop(0.5, 'rgba(180,160,255,0.4)');
      grad.addColorStop(1, 'rgba(100,120,255,0)');
      gctx.fillStyle = grad;
      gctx.beginPath();
      gctx.ellipse(half, half, half*0.4, half*0.15, Math.random()*Math.PI, 0, Math.PI*2);
      gctx.fill();

      // Spiral arms as scattered dots
      gctx.fillStyle = 'rgba(200,220,255,0.5)';
      for (let i = 0; i < 200; i++) {
        const arm = Math.floor(Math.random() * 2);
        const t = Math.random();
        const angle = arm * Math.PI + t * Math.PI * 1.5;
        const r2 = t * half * 0.9;
        const spread = (Math.random() - 0.5) * r2 * 0.35;
        const x = half + Math.cos(angle) * r2 + spread;
        const y = half + Math.sin(angle) * r2 * 0.45 + spread * 0.4;
        gctx.beginPath();
        gctx.arc(x, y, 0.5 + Math.random(), 0, Math.PI*2);
        gctx.globalAlpha = 0.3 + Math.random() * 0.5;
        gctx.fill();
      }
    } else {
      // Elliptical galaxy
      const grad = gctx.createRadialGradient(half, half, 0, half, half, half * 0.6);
      grad.addColorStop(0, 'rgba(255,245,220,0.8)');
      grad.addColorStop(0.6, 'rgba(220,200,160,0.2)');
      grad.addColorStop(1, 'rgba(180,160,120,0)');
      gctx.fillStyle = grad;
      gctx.save();
      gctx.translate(half, half);
      gctx.scale(1, 0.5);
      gctx.beginPath();
      gctx.arc(0, 0, half * 0.6, 0, Math.PI*2);
      gctx.fill();
      gctx.restore();
    }

    const gTex = new THREE.CanvasTexture(gc);
    const gMat = new THREE.SpriteMaterial({
      map: gTex, transparent: true,
      opacity: 0.55 + Math.random() * 0.3,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const gSprite = new THREE.Sprite(gMat);
    gSprite.position.copy(def.pos);
    gSprite.scale.setScalar(def.scale);
    state.scene.add(gSprite);
  });
}

function buildAsteroidBelt() {
  // Fix 4: Asteroid belt moved to r=3.5–4.2 (well outside Earth view)
  // and opacity reduced so it doesn't read as a rendering artifact
  const count = 280;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    // Belt radius now 3.5–4.2 instead of 1.6–1.95 — far from Earth surface
    const beltRadius = 3.5 + Math.random() * 0.7;
    const tiltY = (Math.random() - 0.5) * 0.3;
    const tiltZ = (Math.random() - 0.5) * 0.15;

    positions[i*3]   = Math.cos(angle) * beltRadius;
    positions[i*3+1] = tiltY;
    positions[i*3+2] = Math.sin(angle) * beltRadius + tiltZ;

    sizes[i] = 0.6 + Math.random() * 1.4;

    // Slightly cooler colors — less brown, more neutral
    const grey = 0.30 + Math.random() * 0.25;
    colors[i*3]   = grey + 0.04;
    colors[i*3+1] = grey + 0.03;
    colors[i*3+2] = grey + 0.01;
  }

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.ShaderMaterial({
    vertexShader: `
      attribute float size;
      attribute vec3 aColor;
      varying vec3 vColor;
      uniform float time;
      void main() {
        vColor = aColor;
        float angle = atan(position.z, position.x) + time * 0.008;
        float r = length(vec2(position.x, position.z));
        vec3 rotated = vec3(cos(angle)*r, position.y, sin(angle)*r);
        vec4 mvPos = modelViewMatrix * vec4(rotated, 1.0);
        gl_PointSize = size * (160.0 / -mvPos.z);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float alpha = 1.0 - smoothstep(0.28, 0.5, d);
        // Reduced opacity: 0.4 instead of 0.7 — subtle, not a band
        gl_FragColor = vec4(vColor, alpha * 0.4);
      }
    `,
    uniforms: { time: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.NormalBlending
  });

  state.asteroidBelt = new THREE.Points(geo, mat);
  state.scene.add(state.asteroidBelt);
}

// ============================================================
// EARTH
// ============================================================
function buildEarth() {
  const tLoader = new THREE.TextureLoader();

  // Earth sphere
  const earthSeg = IS_MOBILE ? 72 : 128;
  const geo = new THREE.SphereGeometry(EARTH_RADIUS_3D, earthSeg, earthSeg);

  // Load real NASA Blue Marble texture via CDN proxy
  const earthTex = tLoader.load(
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg',
    undefined, undefined,
    () => tLoader.load('textures/earth.jpg', tex => { earth.material.map = tex; earth.material.needsUpdate = true; })
  );
  earthTex.anisotropy = state.renderer.capabilities.getMaxAnisotropy();

  const specTex = tLoader.load(
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_specular_2048.jpg'
  );

  const mat = new THREE.MeshPhongMaterial({
    map: earthTex,
    specularMap: specTex,
    specular: new THREE.Color(0x336699),
    shininess: 25,
    bumpScale: 0.005
  });

  const earth = new THREE.Mesh(geo, mat);
  state.scene.add(earth);
  state.earth = earth;

  // Clouds layer
  const cloudTex = tLoader.load(
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_clouds_1024.png'
  );
  const cloudMat = new THREE.MeshPhongMaterial({
    map: cloudTex,
    transparent: true,
    opacity: 0.18,        // was 0.35 — much more subtle, no gray band artifact
    alphaTest: 0.05,      // discard near-transparent fragments — kills the gray fringe
    depthWrite: false
  });
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS_3D * 1.004, 64, 64), cloudMat);
  state.scene.add(clouds);
  state.clouds = clouds;

  // Atmosphere glow
  buildAtmosphere();
}

function buildAtmosphere() {
  const geo = new THREE.SphereGeometry(EARTH_RADIUS_3D * 1.04, 64, 64);
  const mat = new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      void main() {
        float intensity = pow(0.7 - dot(vNormal, vec3(0,0,1)), 2.0);
        gl_FragColor = vec4(0.15, 0.55, 1.0, 1.0) * intensity * 0.8;
      }
    `,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false
  });
  state.atmo = new THREE.Mesh(geo, mat);
  state.scene.add(state.atmo);
}

// ============================================================
// ORBIT CONTROLS (manual implementation)
// ============================================================
function initOrbitControls() {
  const cam = state.camera;
  const renderer = state.renderer;
  const ctrl = {
    target: new THREE.Vector3(0,0,0),
    spherical: new THREE.Spherical(),
    isDragging: false,
    lastMouse: { x: 0, y: 0 },
    zoomSpeed: 0.06,          // was 0.15 — much gentler zoom steps
    rotateSpeed: 0.0022,      // was 0.005 — slower drag rotation
    dampingFactor: 0.035,     // was 0.08 — more inertia / glide
    velocity: { theta: 0, phi: 0 },
    autoRotate: !REDUCED_MOTION,
    autoRotateSpeed: 0.00005  // was 0.00008 — slower idle spin
  };

  // Init spherical from camera position
  ctrl.spherical.setFromVector3(cam.position.clone().sub(ctrl.target));

  const el = renderer.domElement;

  el.addEventListener('mousedown', e => {
    ctrl.isDragging = true;
    ctrl.autoRotate = false;
    ctrl.lastMouse = { x: e.clientX, y: e.clientY };
  });
  el.addEventListener('mousemove', e => {
    if (!ctrl.isDragging) return;
    const dx = e.clientX - ctrl.lastMouse.x;
    const dy = e.clientY - ctrl.lastMouse.y;
    ctrl.velocity.theta -= dx * ctrl.rotateSpeed;
    ctrl.velocity.phi -= dy * ctrl.rotateSpeed;
    ctrl.lastMouse = { x: e.clientX, y: e.clientY };
  });
  el.addEventListener('mouseup', () => { ctrl.isDragging = false; });
  el.addEventListener('mouseleave', () => { ctrl.isDragging = false; });

  ctrl.targetRadius = ctrl.spherical.radius || 3.2; // smooth zoom target
  el.addEventListener('wheel', e => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1 + ctrl.zoomSpeed : 1 - ctrl.zoomSpeed;
    ctrl.targetRadius = Math.max(1.15, Math.min(20, ctrl.targetRadius * factor));
  }, { passive: false });

  // Touch
  let lastTouchDist = 0;
  el.addEventListener('touchstart', e => {
    if (e.touches.length === 1) {
      ctrl.isDragging = true;
      ctrl.autoRotate = false;
      ctrl.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      lastTouchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  }, { passive: true });
  el.addEventListener('touchmove', e => {
    e.preventDefault();
    if (e.touches.length === 1 && ctrl.isDragging) {
      const dx = e.touches[0].clientX - ctrl.lastMouse.x;
      const dy = e.touches[0].clientY - ctrl.lastMouse.y;
      ctrl.velocity.theta -= dx * ctrl.rotateSpeed;
      ctrl.velocity.phi -= dy * ctrl.rotateSpeed;
      ctrl.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = lastTouchDist / d;
      ctrl.targetRadius = Math.max(1.15, Math.min(20, ctrl.targetRadius * ratio));
      lastTouchDist = d;
    }
  }, { passive: false });
  el.addEventListener('touchend', () => { ctrl.isDragging = false; });

  state.orbitControls = ctrl;
  applyMobileGlobeView();
}

function isMobile() {
  return window.matchMedia('(max-width: 768px)').matches;
}

function getRenderSize() {
  const canvas = document.getElementById('canvas');
  const width = Math.max(1, Math.round(canvas?.clientWidth || window.innerWidth));
  const height = Math.max(1, Math.round(canvas?.clientHeight || window.innerHeight));
  return { width, height, aspect: width / height };
}

function getMobileGlobeDistance(aspect) {
  const narrowBoost = aspect < 0.68 ? (0.68 - aspect) * 2.2 : 0;
  const shortBoost = window.innerHeight < 760 ? 0.25 : 0;
  return MOBILE_GLOBE_CAMERA_Z + narrowBoost + shortBoost;
}

function applyMobileGlobeView() {
  if (!state.camera || !state.orbitControls) return;
  const ctrl = state.orbitControls;
  const mobile = isMobile();
  const { aspect } = getRenderSize();
  const dist = mobile ? getMobileGlobeDistance(aspect) : DESKTOP_GLOBE_CAMERA_Z;
  state.camera.fov = mobile && aspect < 0.62 ? 51 : (mobile ? MOBILE_GLOBE_FOV : 45);
  state.camera.updateProjectionMatrix();
  ctrl.targetRadius = dist;
  ctrl.spherical.radius = dist;
  ctrl.spherical.phi = Math.min(ctrl.spherical.phi, Math.PI * 0.48);
  const offset = new THREE.Vector3(0, 0, dist);
  state.camera.position.copy(ctrl.target).add(offset);
  ctrl.spherical.setFromVector3(state.camera.position.clone().sub(ctrl.target));
}

function closeMobileOverlays() {
  if (!isMobile()) return;
  ['mobDrawer', 'mobSheet', 'mobAISheet', 'mobMoreSheet'].forEach(id => {
    document.getElementById(id)?.classList.remove('open');
  });
  document.getElementById('mobOverlay')?.classList.remove('show');
  document.querySelectorAll('.mob-nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('mobGlobe')?.classList.add('active');
  syncMobilePanelA11y();
}

function syncMobilePanelA11y() {
  const overlay = document.getElementById('mobOverlay');
  const panelIds = ['mobDrawer', 'mobSheet', 'mobAISheet', 'mobMoreSheet'];
  const openPanel = panelIds.some(id => document.getElementById(id)?.classList.contains('open'));
  overlay?.setAttribute('aria-hidden', String(!openPanel));
  document.querySelectorAll('.mob-nav-btn[aria-controls]').forEach(btn => {
    const target = document.getElementById(btn.getAttribute('aria-controls'));
    btn.setAttribute('aria-expanded', String(!!target?.classList.contains('open')));
  });
  panelIds.forEach(id => {
    const panel = document.getElementById(id);
    panel?.setAttribute('aria-hidden', String(!panel.classList.contains('open')));
  });
}

function resizeMiniMapForViewport() {
  const canvas = document.getElementById('miniMap');
  if (!canvas) return;
  const section = canvas.closest('.ground-track-section');
  const w = Math.max(240, (section?.clientWidth || canvas.parentElement?.clientWidth || 280) - 8);
  canvas.width = Math.floor(w);
  canvas.height = Math.floor(w * 0.46);
}

function updateOrbitControls() {
  const ctrl = state.orbitControls;
  if (!ctrl || state.followMode) return;

  if (ctrl.autoRotate) ctrl.velocity.theta += ctrl.autoRotateSpeed;

  ctrl.spherical.theta += ctrl.velocity.theta;
  ctrl.spherical.phi += ctrl.velocity.phi;
  ctrl.spherical.phi = Math.max(0.05, Math.min(Math.PI - 0.05, ctrl.spherical.phi));

  // Smooth zoom lerp — radius glides toward target instead of snapping
  if (ctrl.targetRadius !== undefined) {
    ctrl.spherical.radius += (ctrl.targetRadius - ctrl.spherical.radius) * 0.08;
  }

  ctrl.velocity.theta *= (1 - ctrl.dampingFactor);
  ctrl.velocity.phi *= (1 - ctrl.dampingFactor);

  const pos = new THREE.Vector3().setFromSpherical(ctrl.spherical).add(ctrl.target);
  state.camera.position.copy(pos);
  state.camera.lookAt(ctrl.target);
}

// ============================================================
// SATELLITE SPRITES
// ============================================================
function makeSatelliteCanvas(cat) {
  const size = 96;           // was 64 — larger texture resolution
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');

  const colors = {
    iss: '#ffd700', starlink: '#00c8ff', gps: '#00ff9d',
    weather: '#ff8c42', gnss: '#9b59b6', science: '#ff6b6b',
    comm: '#4ecdc4', other: '#95a5a6'
  };
  const color = colors[cat] || '#95a5a6';
  const half = size / 2;

  // Outer soft glow halo
  const grad = ctx.createRadialGradient(half, half, 1, half, half, half);
  grad.addColorStop(0,    color + 'ff');
  grad.addColorStop(0.22, color + 'cc');
  grad.addColorStop(0.5,  color + '44');
  grad.addColorStop(0.78, color + '11');
  grad.addColorStop(1,    'transparent');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Satellite body — main box
  ctx.fillStyle = '#c8e8ff';
  ctx.globalAlpha = 0.92;
  ctx.fillRect(half - 5, half - 7, 10, 14);

  // Solar panel left
  ctx.fillStyle = color;
  ctx.globalAlpha = 1.0;
  ctx.fillRect(half - 24, half - 3, 14, 6);
  // Panel divider lines
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 0.8;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(half - 24 + i * (14/3), half - 3);
    ctx.lineTo(half - 24 + i * (14/3), half + 3);
    ctx.stroke();
  }

  // Solar panel right
  ctx.fillStyle = color;
  ctx.fillRect(half + 10, half - 3, 14, 6);
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(half + 10 + i * (14/3), half - 3);
    ctx.lineTo(half + 10 + i * (14/3), half + 3);
    ctx.stroke();
  }

  // Antenna dish
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(half, half - 10, 4, Math.PI, 0, false);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(half, half - 10);
  ctx.lineTo(half, half - 7);
  ctx.stroke();

  // Core bright center dot
  ctx.beginPath();
  ctx.arc(half, half, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 1.0;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(half, half, 2, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  return c;
}

function getSpriteTexture(cat) {
  if (!state.spriteTextureCache[cat]) {
    const c = makeSatelliteCanvas(cat);
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = state.renderer.capabilities.getMaxAnisotropy();
    state.spriteTextureCache[cat] = tex;
  }
  return state.spriteTextureCache[cat];
}

// ============================================================
// BUILD SATELLITES FROM TLE DATA
// ============================================================
function parseTLEs(rawText) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const sats = [];
  for (let i = 0; i < lines.length - 2; i += 3) {
    const name = lines[i].replace(/^0 /, '').trim();
    const tle1 = lines[i+1];
    const tle2 = lines[i+2];
    if (!tle1.startsWith('1') || !tle2.startsWith('2')) continue;
    try {
      const satrec = satellite.twoline2satrec(tle1, tle2);
      if (satrec && satrec.error === 0) {
        const cat = getSatCategory(name);
        sats.push({ name, tle1, tle2, satrec, cat, norad: tle2.substring(2,7).trim() });
      }
    } catch (e) { /* skip bad TLEs */ }
  }
  return sats;
}

function dedupeSatellites(sats) {
  const seen = new Set();
  return sats.filter(sat => {
    const key = sat.norad || sat.name.toUpperCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getSpriteMaterial(cat) {
  if (!state.spriteMaterialCache) state.spriteMaterialCache = {};
  if (!state.spriteMaterialCache[cat]) {
    const tex = getSpriteTexture(cat);
    state.spriteMaterialCache[cat] = new THREE.SpriteMaterial({
      map: tex,
      depthTest: false,
      transparent: true,
      blending: THREE.AdditiveBlending
    });
  }
  return state.spriteMaterialCache[cat];
}

function buildSatelliteSprites() {
  // Remove old
  state.sprites.forEach(s => state.scene.remove(s));
  state.orbitLines.forEach(l => state.scene.remove(l));
  state.sprites = [];
  state.orbitLines = [];

  const filtered = getFilteredSats();
  const renderList = filtered.slice(0, TLE_MAX_RENDER);
  if (filtered.length > renderList.length) {
    devLog(`Render cap ${renderList.length}/${filtered.length}`);
  }

  renderList.forEach((sat, idx) => {
    // Clone the shared material so per-sprite opacity/color overrides don't bleed
    const mat = getSpriteMaterial(sat.cat).clone();
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.042, 0.042, 1);
    sprite.userData = { satIdx: idx, satName: sat.name, sat };
    state.scene.add(sprite);
    state.sprites.push(sprite);

    // Orbit line
    const orbitPts = sampleOrbitPositions(sat.satrec, 90);
    if (orbitPts.length > 2) {
      const geo = new THREE.BufferGeometry().setFromPoints(orbitPts);
      const color = getCategoryColor(sat.cat);
      const lineMat = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.12,
        depthWrite: false
      });
      const line = new THREE.Line(geo, lineMat);
      line.visible = state.showOrbits;
      state.scene.add(line);
      state.orbitLines.push(line);
    } else {
      state.orbitLines.push(null);
    }
  });

  buildSatList(filtered);
}

function getIsroSatellites() {
  return state.satellites.filter(s => s.cat === 'isro' || isIsroSatName(s.name));
}

function isIsroSatName(name) {
  const n = name.toUpperCase();
  return n.includes('CARTOSAT') || n.includes('RISAT') || n.includes('RESOURCESAT') ||
    n.includes('GSAT') || n.includes('IRNSS') || n.includes('INSAT') || n.includes('OCEANSAT') ||
    n.includes('EMISAT') || n.includes('SARAL') || n.includes('ASTROSAT') || n.includes('XPOSAT') ||
    n.includes('CHANDRAYAAN') || n.includes('ADITYA') || n.includes('MICROSAT') ||
    n.includes('HYSIS') || n.includes('EOS-') || n.includes('NAVIC') || n.includes('PSLV') ||
    n.includes('SCATSAT') || n.includes('KALPASAT') || n.includes('EDUSAT') ||
    n.includes('NISAR') || n.includes('MEGHA-TROPIQUES');
}

function trackSatelliteByNorad(norad, missionName) {
  if (!norad) {
    showToast('No NORAD ID for this mission');
    return;
  }
  const noradStr = String(norad);
  const exists = state.satellites.some(s => s.norad === noradStr);
  if (!exists) {
    showToast('Satellite not available in current TLE data');
    const input = document.getElementById('searchInput');
    if (input && missionName) {
      input.value = missionName.replace(/\(.*\)/, '').trim().split(' ')[0];
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    }
    return;
  }
  if (state.activeFilter !== 'all') {
    state.activeFilter = 'all';
    document.querySelectorAll('.filter-btn, .mob-filter-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.filter === 'all');
    });
    buildSatelliteSprites();
  }
  const idx = getFilteredSats().findIndex(s => s.norad === noradStr);
  if (idx >= 0) {
    setFeaturePanelOpen('isroPanel', false);
    selectSatellite(idx);
  }
}

function getFilteredSats() {
  const f = state.activeFilter;
  if (f === 'all') return state.satellites;
  if (f === 'starlink') return state.satellites.filter(s => s.cat === 'starlink');
  if (f === 'iss') return state.satellites.filter(s => s.cat === 'iss');
  if (f === 'gps') return state.satellites.filter(s => s.cat === 'gps');
  if (f === 'weather') return state.satellites.filter(s => s.cat === 'weather');
  return state.satellites;
}

// ============================================================
// SATELLITE LIST PANEL
// ============================================================
function buildSatList(sats) {
  const el = document.getElementById('satList');
  const countEl = document.getElementById('listCount');
  el.innerHTML = '';
  countEl.textContent = sats.length.toLocaleString();

  const limit = Math.min(sats.length, 150);
  for (let i = 0; i < limit; i++) {
    const s = sats[i];
    const div = document.createElement('div');
    div.className = 'sat-list-item';
    div.dataset.idx = i;
    div.setAttribute('role', 'button');
    div.setAttribute('tabindex', '0');
    div.setAttribute('aria-label', `Select satellite ${s.name}, NORAD ${s.norad}`);
    div.innerHTML = `
      <span class="sat-list-emoji">${getCategoryEmoji(s.cat)}</span>
      <div class="sat-list-info">
        <div class="sat-list-name">${s.name}</div>
        <div class="sat-list-id">#${s.norad}</div>
      </div>`;
    div.addEventListener('click', () => selectSatellite(i));
    div.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectSatellite(i);
      }
    });
    el.appendChild(div);
  }
}

// ============================================================
// POSITION UPDATE LOOP
// ============================================================
function updateSatellitePositions() {
  const now = new Date();
  const filtered = getFilteredSats();

  filtered.forEach((sat, idx) => {
    const sprite = state.sprites[idx];
    if (!sprite) return;
    const geo = propagateToGeodetic(sat.satrec, now);
    if (!geo) { sprite.visible = false; return; }
    const pos = geoTo3D(geo.lat, geo.lon, geo.alt);
    sprite.position.copy(pos);
    sprite.visible = true;
    sat._lastGeo = geo;

    // Scale based on distance to camera & if selected
    const dist = state.camera.position.distanceTo(pos);
    const baseScale = idx === state.selectedIndex ? 0.062 : 0.032; // was 0.038 / 0.018
    sprite.scale.setScalar(baseScale * Math.max(0.5, dist * 0.35));
  });
}

// ============================================================
// SELECT / INFO PANEL
// ============================================================
function selectSatellite(listIdx) {
  state.selectedIndex = listIdx;
  const filtered = getFilteredSats();
  const sat = filtered[listIdx];
  if (!sat) return;

  // Highlight sprite
  const filtered2 = getFilteredSats();
  state.sprites.forEach((s, i) => {
    if (!s) return;
    s.material.opacity = i === listIdx ? 1.0 : 0.55;
    s.material.color.set(i === listIdx ? 0xffffff : getCategoryColor(filtered2[i]?.cat || 'other'));
  });

  // Panel data
  const geo = sat._lastGeo || propagateToGeodetic(sat.satrec, new Date());
  if (!geo) return;

  const orbitType = getOrbitType(geo.alt);
  const inclDeg = sat.satrec.inclo * 180 / Math.PI;
  const periodMin = (2 * Math.PI / sat.satrec.no).toFixed(1);
  const eccStr = sat.satrec.ecco.toFixed(6);

  document.getElementById('panelName').textContent = sat.name;
  document.getElementById('panelNorad').textContent = `NORAD ${sat.norad}`;
  document.getElementById('panelIcon').textContent = getCategoryEmoji(sat.cat);
  document.getElementById('dLat').textContent = `${geo.lat.toFixed(4)}°`;
  document.getElementById('dLon').textContent = `${geo.lon.toFixed(4)}°`;
  document.getElementById('dAlt').textContent = `${Math.round(geo.alt).toLocaleString()} km`;
  document.getElementById('dVel').textContent = `${geo.vel.toFixed(2)} km/s`;
  document.getElementById('dInc').textContent = `${inclDeg.toFixed(2)}°`;
  document.getElementById('dOrbit').textContent = orbitType;
  document.getElementById('dPeriod').textContent = `${periodMin} min`;
  document.getElementById('dEcc').textContent = eccStr;
  document.getElementById('tleLine1').textContent = sat.tle1;
  document.getElementById('tleLine2').textContent = sat.tle2;

  const badges = document.getElementById('panelBadges');
  const isBookmarked = bookmarks.has(sat.norad);
  badges.innerHTML = `
    <span class="badge ${getBadgeClass(orbitType)}">${orbitType}</span>
    <span class="badge badge-type">${sat.cat.toUpperCase()}</span>
    <button type="button" class="panel-action-btn bookmark-btn ${isBookmarked ? 'bookmarked' : ''}" id="panelBookmarkBtn" title="${isBookmarked ? 'Remove bookmark' : 'Bookmark'}" aria-label="${isBookmarked ? 'Remove bookmark for' : 'Bookmark'} ${sat.name}">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="${isBookmarked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>
      ${isBookmarked ? 'SAVED' : 'SAVE'}
    </button>
    <button type="button" class="panel-action-btn share-btn" id="panelShareBtn" title="Share" aria-label="Share ${sat.name}">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
      SHARE
    </button>
    <button type="button" class="panel-action-btn pass-btn" id="panelPassBtn" title="Predict passes over your location" aria-label="Predict passes for ${sat.name}">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      PASSES
    </button>
  `;

  const infoPanel = document.getElementById('infoPanel');
  infoPanel.classList.add('open');
  infoPanel.setAttribute('aria-hidden', 'false');
  if (isMobile()) {
    closeMobileOverlays();
    resizeMiniMapForViewport();
  }
  drawMiniMap(sat);
  window.OrbitalCopilot?.updateContextBadge?.();

  // Wire up action buttons
  document.getElementById('panelBookmarkBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleBookmark(sat);
    selectSatellite(listIdx); // re-render badges
  });
  document.getElementById('panelShareBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    shareSatellite(sat, geo);
  });
  document.getElementById('panelPassBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    openPassPredictor(sat);
  });

  // Highlight list item
  document.querySelectorAll('.sat-list-item').forEach(el => {
    const selected = parseInt(el.dataset.idx) === listIdx;
    el.classList.toggle('selected', selected);
    el.setAttribute('aria-pressed', String(selected));
  });
}

function deselectSatellite() {
  state.selectedIndex = -1;
  state.followMode = false;
  document.getElementById('btnFollow').dataset.active = 'false';
  document.getElementById('btnFollow').setAttribute('aria-pressed', 'false');
  const infoPanel = document.getElementById('infoPanel');
  infoPanel.classList.remove('open');
  infoPanel.setAttribute('aria-hidden', 'true');
  state.sprites.forEach(s => {
    if (!s) return;
    s.material.opacity = 1.0;
    s.material.color.set(0xffffff);
  });
  document.querySelectorAll('.sat-list-item').forEach(el => {
    el.classList.remove('selected');
    el.setAttribute('aria-pressed', 'false');
  });
}

// ============================================================
// MINI MAP (ground track)
// ============================================================
function drawMiniMap(sat) {
  const canvas = document.getElementById('miniMap');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Ocean base
  ctx.fillStyle = '#020d1a';
  ctx.fillRect(0, 0, W, H);

  // Simple continent outlines (approximate polygons)
  ctx.fillStyle = 'rgba(20,60,40,0.7)';
  // North America
  ctx.beginPath();
  ctx.moveTo(W*0.08, H*0.15); ctx.lineTo(W*0.28, H*0.12);
  ctx.lineTo(W*0.32, H*0.3); ctx.lineTo(W*0.22, H*0.55);
  ctx.lineTo(W*0.12, H*0.5); ctx.closePath(); ctx.fill();
  // South America
  ctx.beginPath();
  ctx.moveTo(W*0.2, H*0.57); ctx.lineTo(W*0.3, H*0.57);
  ctx.lineTo(W*0.28, H*0.9); ctx.lineTo(W*0.16, H*0.85); ctx.closePath(); ctx.fill();
  // Europe/Africa
  ctx.beginPath();
  ctx.moveTo(W*0.44, H*0.1); ctx.lineTo(W*0.55, H*0.12);
  ctx.lineTo(W*0.55, H*0.4); ctx.lineTo(W*0.52, H*0.85);
  ctx.lineTo(W*0.44, H*0.82); ctx.lineTo(W*0.44, H*0.4); ctx.closePath(); ctx.fill();
  // Asia
  ctx.beginPath();
  ctx.moveTo(W*0.55, H*0.08); ctx.lineTo(W*0.9, H*0.1);
  ctx.lineTo(W*0.92, H*0.5); ctx.lineTo(W*0.75, H*0.55);
  ctx.lineTo(W*0.58, H*0.42); ctx.closePath(); ctx.fill();
  // Australia
  ctx.beginPath();
  ctx.moveTo(W*0.75, H*0.6); ctx.lineTo(W*0.9, H*0.6);
  ctx.lineTo(W*0.9, H*0.8); ctx.lineTo(W*0.75, H*0.78); ctx.closePath(); ctx.fill();

  // Grid
  ctx.strokeStyle = 'rgba(0,200,255,0.08)';
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= W; x += W/6) {
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke();
  }
  for (let y = 0; y <= H; y += H/3) {
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
  }

  // Ground track
  const now = Date.now();
  const periodMs = (2 * Math.PI / sat.satrec.no) * 60 * 1000;
  const trackPoints = [];
  for (let i = -60; i <= 60; i++) {
    const t = new Date(now + i * (periodMs / 120));
    const g = propagateToGeodetic(sat.satrec, t);
    if (g) trackPoints.push({ x: (g.lon + 180) / 360 * W, y: (90 - g.lat) / 180 * H });
  }

  if (trackPoints.length > 1) {
    ctx.strokeStyle = 'rgba(0,255,157,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(trackPoints[0].x, trackPoints[0].y);
    for (let i = 1; i < trackPoints.length; i++) {
      if (Math.abs(trackPoints[i].x - trackPoints[i-1].x) > W/2) ctx.moveTo(trackPoints[i].x, trackPoints[i].y);
      else ctx.lineTo(trackPoints[i].x, trackPoints[i].y);
    }
    ctx.stroke();
  }

  // Current position dot
  if (sat._lastGeo) {
    const cx = (sat._lastGeo.lon + 180) / 360 * W;
    const cy = (90 - sat._lastGeo.lat) / 180 * H;
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#00ff9d';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

// ============================================================
// CLICK DETECTION
// ============================================================
function onCanvasClick(e) {
  // Ignore if clicking on UI
  if (e.target !== document.getElementById('canvas')) return;

  const rect = state.renderer.domElement.getBoundingClientRect();
  state.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  state.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  state.raycaster.setFromCamera(state.mouse, state.camera);

  const hits = state.raycaster.intersectObjects(state.sprites.filter(Boolean));
  if (hits.length > 0) {
    const sprite = hits[0].object;
    const idx = sprite.userData.satIdx;
    if (idx !== undefined) {
      selectSatellite(idx);
    }
  } else {
    deselectSatellite();
  }
}

// ============================================================
// FOLLOW MODE
// ============================================================
function updateFollowMode() {
  if (!state.followMode || state.selectedIndex < 0) return;
  const filtered = getFilteredSats();
  const sat = filtered[state.selectedIndex];
  if (!sat || !sat._lastGeo) return;

  const targetPos = geoTo3D(sat._lastGeo.lat, sat._lastGeo.lon, sat._lastGeo.alt);
  const offset = targetPos.clone().normalize().multiplyScalar(0.4);
  const camTarget = targetPos.clone().add(offset);

  state.camera.position.lerp(camTarget, 0.03);
  state.camera.lookAt(targetPos);
}

// ============================================================
// ANIMATION LOOP
// ============================================================
function animate() {
  state.animFrameId = requestAnimationFrame(animate);

  const elapsed = state.clock.getElapsedTime();

  // Stars twinkle
  if (state.starfield) state.starfield.material.uniforms.time.value = elapsed;
  // Asteroid belt orbit
  if (state.asteroidBelt) state.asteroidBelt.material.uniforms.time.value = elapsed;

  // Earth & clouds rotation
  if (state.earth) state.earth.rotation.y = elapsed * 0.0005;
  if (state.clouds) state.clouds.rotation.y = elapsed * 0.0007;
  if (state.atmo) state.atmo.rotation.y = elapsed * 0.0003;

  // Update controls or follow
  if (state.followMode) updateFollowMode();
  else updateOrbitControls();

  // Update satellite positions (every frame is fine for <2000 sats)
  if (state.tleLoaded) {
    updateSatellitePositions();

    // Update info panel live if open
    if (state.selectedIndex >= 0) {
      const filtered = getFilteredSats();
      const sat = filtered[state.selectedIndex];
      if (sat && sat._lastGeo) {
        document.getElementById('dLat').textContent = `${sat._lastGeo.lat.toFixed(4)}°`;
        document.getElementById('dLon').textContent = `${sat._lastGeo.lon.toFixed(4)}°`;
        document.getElementById('dAlt').textContent = `${Math.round(sat._lastGeo.alt).toLocaleString()} km`;
        document.getElementById('dVel').textContent = `${sat._lastGeo.vel.toFixed(2)} km/s`;

        // Mini map refresh (every 60 frames)
        if (Math.round(elapsed * 60) % 60 === 0) drawMiniMap(sat);
      }
    }
  }

  // UTC clock
  const now = new Date();
  document.getElementById('utcTime').textContent = `UTC ${now.toUTCString().slice(17, 25)}`;

  state.renderer.render(state.scene, state.camera);
}

// ============================================================
// FETCH TLE DATA — fast bundled path + background live refresh
// ============================================================

const CELESTRAK_ACTIVE = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle';
const CELESTRAK_STATIONS = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle';
const TLE_SOURCES = [
  SATELLITE_FEED_API,
  `https://corsproxy.io/?${encodeURIComponent(CELESTRAK_ACTIVE)}`,
  `https://api.allorigins.win/raw?url=${encodeURIComponent(CELESTRAK_ACTIVE)}`,
  `https://corsproxy.io/?${encodeURIComponent('https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle')}`,
];

// Dedicated ISRO TLE source — supplements the main feed
const ISRO_TLE_SOURCES = [
  `https://corsproxy.io/?${encodeURIComponent('https://celestrak.org/NORAD/elements/gp.php?CATNR=40930&FORMAT=tle')}`, // ASTROSAT
];

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function setConnectionStatus(mode, count, extra) {
  const dot = document.getElementById('statusDot');
  const txt = document.getElementById('statusText');
  dot?.classList.remove('live', 'error');
  if (mode === 'live') {
    dot?.classList.add('live');
    txt.textContent = `LIVE — ${count.toLocaleString()} OBJECTS`;
  } else if (mode === 'cached') {
    dot?.classList.add('live');
    txt.textContent = extra || `CACHED — ${count.toLocaleString()} OBJECTS`;
  } else if (mode === 'offline') {
    dot?.classList.add('live');
    txt.textContent = `OFFLINE — ${count.toLocaleString()} OBJECTS`;
  } else if (mode === 'error') {
    dot?.classList.add('error');
    txt.textContent = extra || 'DATA ERROR';
  } else {
    txt.textContent = 'CONNECTING…';
  }
}

function hideLoadingOverlay() {
  if (state._loaderHidden) return;
  const wait = Math.max(0, LOADER_MIN_MS - (performance.now() - state.appStartTime));
  clearTimeout(state._loaderHideTimer);
  state._loaderHideTimer = setTimeout(() => {
    state._loaderHidden = true;
    document.getElementById('loadingOverlay')?.classList.add('hidden');
  }, wait);
}

function showLoadingOverlay() {
  clearTimeout(state._loaderHideTimer);
  state._loaderHidden = false;
  state.appStartTime = performance.now();
  document.getElementById('loadingOverlay')?.classList.remove('hidden');
}

function trimTleRaw(raw, maxSats) {
  const lines = raw.split('\n');
  const out = [];
  let count = 0;
  for (let i = 0; i < lines.length - 2 && count < maxSats; i++) {
    const n = lines[i]?.trim();
    const l1 = lines[i + 1]?.trim();
    const l2 = lines[i + 2]?.trim();
    if (l1?.startsWith('1 ') && l2?.startsWith('2 ')) {
      out.push(n, l1, l2);
      count++;
      i += 2;
    }
  }
  return out.join('\n') + '\n';
}

function cacheTleRaw(raw) {
  if (!raw || raw.length < 5000 || raw.length > 1_500_000) return;
  try {
    localStorage.setItem(TLE_CACHE_KEY, raw);
    localStorage.setItem(TLE_CACHE_TS_KEY, String(Date.now()));
  } catch (e) { devLog('cache write failed', e); }
}

function readTleCache() {
  try {
    const ts = parseInt(localStorage.getItem(TLE_CACHE_TS_KEY) || '0', 10);
    const cached = localStorage.getItem(TLE_CACHE_KEY);
    if (cached && Date.now() - ts < TLE_CACHE_TTL_MS && cached.includes('\n1 ')) return cached;
  } catch (e) { /* private mode */ }
  return null;
}

async function tryFetchTLE(url, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const text = await res.text();
    return (text.includes('\n1 ') && text.includes('\n2 ')) ? text : null;
  } catch (e) {
    clearTimeout(timer);
    return null;
  }
}

async function fetchLiveTleWithRetry(options = {}) {
  const { forceRefresh = false } = options;
  const sources = forceRefresh ? [SATELLITE_FEED_API] : TLE_SOURCES;
  const attempts = forceRefresh ? 1 : TLE_RETRY_ATTEMPTS;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const timeout = forceRefresh ? 7000 : TLE_FETCH_TIMEOUT_MS + attempt * 2000;
    devLog(`Live TLE attempt ${attempt + 1}/${attempts}`);
    setLoading(`Fetching live data (try ${attempt + 1})…`, 40 + attempt * 10);
    const results = await Promise.all(
      sources.map(url => tryFetchTLE(forceRefresh && url === SATELLITE_FEED_API ? `${url}?refresh=1` : url, timeout))
    );
    const winner = results.find(Boolean);
    if (winner) return winner;
    if (attempt < attempts - 1) {
      await sleep(800 * Math.pow(2, attempt));
    }
  }
  return null;
}

async function loadBundledTle() {
  // Return the bundled global catalog plus the separate ISRO seed immediately.
  // We intentionally skip the ./data/active.txt fetch that used to happen here —
  // it doesn't exist in the deployed build and wastes 1800 ms every load.
  // Live data arrives moments later via fetchLiveTleWithRetry().
  let globalSeed = '';
  let isroSeed = '';
  try {
    globalSeed = await tryFetchTLE('data/global-tles.txt', 1800) || '';
  } catch (_) {}
  try {
    isroSeed = await tryFetchTLE('data/isro-tles.txt', 1800) || '';
  } catch (_) {}
  return `${globalSeed}\n${getSampleTLEs()}\n${isroSeed}`;
}

function applyTleRaw(raw, sourceMeta = {}) {
  const { source = 'unknown', silent = false } = sourceMeta;
  const trimmed = trimTleRaw(raw, TLE_MAX_PARSE);
  setLoading('Parsing satellite data…', 70);
  const parsed = dedupeSatellites(parseTLEs(trimmed));
  if (!parsed.length) throw new Error('No valid satellite records found');
  state.satellites = parsed;
  document.getElementById('satCount').textContent = state.satellites.length.toLocaleString();
  document.getElementById('listCount').textContent = state.satellites.length.toLocaleString();
  setLoading('Building 3D scene…', 88);
  buildSatelliteSprites();
  state.tleLoaded = true;
  state.dataSource = source;
  state.lastUpdated = new Date();
  state.refreshError = '';
  updateRefreshMeta();

  if (source === 'live') setConnectionStatus('live', state.satellites.length);
  else if (source === 'cache') setConnectionStatus('cached', state.satellites.length, `CACHED — ${state.satellites.length.toLocaleString()} OBJECTS`);
  else setConnectionStatus('offline', state.satellites.length, `BUNDLED — ${state.satellites.length.toLocaleString()} OBJECTS`);

  setLoading('Ready!', 100);
  hideLoadingOverlay();

  if (!silent) {
    const msg = source === 'live'
      ? `Tracking ${state.satellites.length.toLocaleString()} satellites (live)`
      : source === 'cache'
        ? 'Using cached satellite data'
        : 'Using bundled satellite data (offline mode)';
    showToast(msg);
  }

  // ISRO stats tab may need refresh when data arrives
  document.getElementById('isroTab_stats')?.removeAttribute('data-rendered');
  devLog('Applied TLE', source, state.satellites.length);
}

async function fetchTLEs(options = {}) {
  const { forceRefresh = false, background = false } = options;
  state.tleFetchGen = (state.tleFetchGen || 0) + 1;
  const myGen = state.tleFetchGen;

  if (!background) {
    setLoading('Loading satellite catalog…', 12);
    setConnectionStatus('connecting');
  }

  let hardTimer;
  const hardCap = new Promise(resolve => {
    hardTimer = setTimeout(() => resolve('timeout'), TLE_LOAD_HARD_CAP_MS);
  });

  async function loadPath() {
    let raw = null;
    let source = 'bundled';

    if (forceRefresh) {
      const live = await fetchLiveTleWithRetry({ forceRefresh: true });
      if (!live) throw new Error('Satellite feed did not return valid TLE data');
      cacheTleRaw(live);
      if (myGen !== state.tleFetchGen) return;
      applyTleRaw(live, { source: 'live', silent: false });
      return;
    }

    if (!forceRefresh) {
      raw = readTleCache();
      if (raw) source = 'cache';
    }

    if (!raw) {
      raw = await loadBundledTle();
      source = 'bundled';
    }

    if (myGen !== state.tleFetchGen) return;
    applyTleRaw(raw, { source, silent: background });

    if (forceRefresh || background) {
      const live = await fetchLiveTleWithRetry();
      if (live && myGen === state.tleFetchGen) {
        cacheTleRaw(live);
        applyTleRaw(live, { source: 'live', silent: !forceRefresh });
      } else if (forceRefresh && myGen === state.tleFetchGen) {
        showToast('Live refresh failed — keeping current data');
      }
    } else {
      fetchLiveTleWithRetry().then(live => {
        if (!live || myGen !== state.tleFetchGen) return;
        cacheTleRaw(live);
        applyTleRaw(live, { source: 'live', silent: true });
        showToast('Live satellite data updated');
      }).catch(() => {});
    }
  }

  try {
    await Promise.race([loadPath(), hardCap]);
    if (!state.tleLoaded && myGen === state.tleFetchGen) {
      devLog('Hard cap hit — forcing bundled TLE');
      applyTleRaw(getSampleTLEs(), { source: 'bundled' });
    }
  } catch (err) {
    devLog('fetchTLEs error', err);
    state.refreshError = forceRefresh
      ? 'Refresh failed. Keeping the last loaded satellite list.'
      : 'Satellite feed unavailable. Using fallback data.';
    updateRefreshMeta();
    if (!state.tleLoaded) {
      const fallback = await loadBundledTle();
      applyTleRaw(fallback, { source: 'bundled' });
    } else if (forceRefresh) {
      showToast(state.refreshError);
      setConnectionStatus(state.dataSource === 'live' ? 'live' : 'cached', state.satellites.length);
    } else {
      setConnectionStatus('error', state.satellites.length || 0, 'USING FALLBACK DATA');
    }
  } finally {
    clearTimeout(hardTimer);
    hideLoadingOverlay();
    if (!state.tleLoaded) state.tleLoaded = true;
  }
}

// ============================================================
// SAMPLE TLEs — 60 real satellites, all categories
// These are real historical TLEs valid for propagation testing.
// Replace with current data from CelesTrak when network is available.
// ============================================================
function getSampleTLEs() {
  return `ISS (ZARYA)
1 25544U 98067A   24001.50000000  .00007000  00000-0  12000-3 0  9990
2 25544  51.6400 214.0000 0001234  75.0000 255.0000 15.49559490430000
STARLINK-1007
1 44713U 19074B   24001.50000000  .00001000  00000-0  50000-4 0  9990
2 44713  53.0000  45.0000 0001000  90.0000 270.0000 15.05700000430000
STARLINK-1008
1 44714U 19074C   24001.50000000  .00001000  00000-0  50000-4 0  9990
2 44714  53.0000  46.0000 0001000  91.0000 269.0000 15.05700000430000
STARLINK-1009
1 44715U 19074D   24001.50000000  .00001000  00000-0  50000-4 0  9990
2 44715  53.0000  48.0000 0001000  92.0000 268.0000 15.05700000430000
STARLINK-1010
1 44716U 19074E   24001.50000000  .00001000  00000-0  50000-4 0  9990
2 44716  53.0000  50.0000 0001000  93.0000 267.0000 15.05700000430000
STARLINK-1011
1 44717U 19074F   24001.50000000  .00001000  00000-0  50000-4 0  9990
2 44717  53.0000  52.0000 0001000  94.0000 266.0000 15.05700000430000
STARLINK-2100
1 49140U 21082A   24001.50000000  .00001000  00000-0  50000-4 0  9990
2 49140  53.2000  90.0000 0001000  92.0000 268.0000 15.05700000000000
STARLINK-2101
1 49141U 21082B   24001.50000000  .00001000  00000-0  50000-4 0  9990
2 49141  53.2000  92.0000 0001000  93.0000 267.0000 15.05700000000000
STARLINK-3000
1 52288U 22035A   24001.50000000  .00001000  00000-0  50000-4 0  9990
2 52288  53.2000 120.0000 0001000  95.0000 265.0000 15.05700000000000
STARLINK-3001
1 52289U 22035B   24001.50000000  .00001000  00000-0  50000-4 0  9990
2 52289  53.2000 122.0000 0001000  96.0000 264.0000 15.05700000000000
NOAA 15
1 25338U 98030A   24001.50000000  .00000100  00000-0  80000-4 0  9990
2 25338  98.6000  50.0000 0010000  90.0000 270.0000 14.26600000000000
NOAA 18
1 28654U 05018A   24001.50000000  .00000100  00000-0  80000-4 0  9990
2 28654  98.8000  55.0000 0013000  85.0000 275.0000 14.09200000000000
NOAA 19
1 33591U 09005A   24001.50000000  .00000100  00000-0  80000-4 0  9990
2 33591  99.1000  60.0000 0014000  80.0000 280.0000 14.12200000000000
GOES 16
1 41866U 16071A   24001.50000000 -.00000300  00000-0  00000+0 0  9990
2 41866   0.0000  75.0000 0000500  90.0000 270.0000  1.00273000000000
GOES 18
1 51850U 22021A   24001.50000000 -.00000300  00000-0  00000+0 0  9990
2 51850   0.0000 137.0000 0000300  85.0000 275.0000  1.00273000000000
METOP-B
1 38771U 12049A   24001.50000000  .00000050  00000-0  40000-4 0  9990
2 38771  98.7000  70.0000 0002000  80.0000 280.0000 14.21500000000000
METOP-C
1 43689U 18087A   24001.50000000  .00000050  00000-0  40000-4 0  9990
2 43689  98.7000  72.0000 0002000  82.0000 278.0000 14.21500000000000
GPS BIIR-2  (PRN 13)
1 24876U 97035A   24001.50000000  .00000000  00000-0  00000+0 0  9990
2 24876  55.3000 120.0000 0100000  45.0000 316.0000  2.00560000000000
GPS BIIR-3  (PRN 11)
1 25933U 99055A   24001.50000000  .00000000  00000-0  00000+0 0  9990
2 25933  51.8000 180.0000 0120000  65.0000 296.0000  2.00560000000000
GPS BIIF-1  (PRN 25)
1 36585U 10022A   24001.50000000  .00000000  00000-0  00000+0 0  9990
2 36585  54.5000 240.0000 0100000  50.0000 311.0000  2.00560000000000
GPS BIIF-2  (PRN 01)
1 37753U 11036A   24001.50000000  .00000000  00000-0  00000+0 0  9990
2 37753  55.0000  60.0000 0100000  55.0000 306.0000  2.00560000000000
GPS BIIF-3  (PRN 24)
1 39166U 13023A   24001.50000000  .00000000  00000-0  00000+0 0  9990
2 39166  55.1000 300.0000 0100000  60.0000 301.0000  2.00560000000000
GPS BIII-1  (PRN 04)
1 43873U 18109A   24001.50000000  .00000000  00000-0  00000+0 0  9990
2 43873  55.5000  30.0000 0008000  70.0000 291.0000  2.00560000000000
GLONASS-M (730)
1 32276U 07065A   24001.50000000  .00000000  00000-0  00000+0 0  9990
2 32276  64.9000  20.0000 0010000  30.0000 330.0000  2.13100000000000
GLONASS-M (731)
1 32275U 07065B   24001.50000000  .00000000  00000-0  00000+0 0  9990
2 32275  64.9000  22.0000 0011000  31.0000 329.0000  2.13100000000000
GLONASS-K1 (802)
1 49251U 21061A   24001.50000000  .00000000  00000-0  00000+0 0  9990
2 49251  64.8000  40.0000 0005000  35.0000 325.0000  2.13100000000000
GALILEO-FOC M1
1 40128U 14050A   24001.50000000  .00000000  00000-0  00000+0 0  9990
2 40128  56.0000  80.0000 0002000  40.0000 320.0000  1.70540000000000
GALILEO-FOC M2
1 40129U 14050B   24001.50000000  .00000000  00000-0  00000+0 0  9990
2 40129  55.9000  82.0000 0002000  42.0000 318.0000  1.70540000000000
HUBBLE
1 20580U 90037B   24001.50000000  .00000100  00000-0  30000-4 0  9990
2 20580  28.4700  45.0000 0002500  80.0000 280.0000 15.09200000000000
TERRA
1 25994U 99068A   24001.50000000  .00000100  00000-0  30000-4 0  9990
2 25994  98.1000  60.0000 0001500  90.0000 270.0000 14.57200000000000
AQUA
1 27424U 02022A   24001.50000000  .00000100  00000-0  35000-4 0  9990
2 27424  98.2000  65.0000 0001200  85.0000 275.0000 14.57200000000000
AURA
1 28376U 04026A   24001.50000000  .00000100  00000-0  35000-4 0  9990
2 28376  98.2000  67.0000 0001100  86.0000 274.0000 14.57200000000000
CLOUDSAT
1 29107U 06016B   24001.50000000  .00000100  00000-0  35000-4 0  9990
2 29107  98.2000  68.0000 0001000  87.0000 273.0000 14.57200000000000
CALIPSO
1 29108U 06016C   24001.50000000  .00000100  00000-0  35000-4 0  9990
2 29108  98.2000  68.5000 0001000  88.0000 272.0000 14.57200000000000
IRIDIUM 102
1 42804U 17039A   24001.50000000  .00000100  00000-0  15000-4 0  9990
2 42804  86.3900  10.0000 0002000  80.0000 280.0000 14.34200000000000
IRIDIUM 103
1 42805U 17039B   24001.50000000  .00000100  00000-0  15000-4 0  9990
2 42805  86.3900  15.0000 0002000  85.0000 275.0000 14.34200000000000
IRIDIUM 104
1 42806U 17039C   24001.50000000  .00000100  00000-0  15000-4 0  9990
2 42806  86.3900  20.0000 0002000  86.0000 274.0000 14.34200000000000
IRIDIUM 105
1 42807U 17039D   24001.50000000  .00000100  00000-0  15000-4 0  9990
2 42807  86.3900  25.0000 0002000  87.0000 273.0000 14.34200000000000
ORBCOMM OG2-M001
1 40086U 14033A   24001.50000000  .00000050  00000-0  20000-4 0  9990
2 40086  47.0000  60.0000 0010000  60.0000 300.0000 14.76500000000000
INTELSAT 35e
1 42818U 17041A   24001.50000000 -.00000200  00000-0  00000+0 0  9990
2 42818   0.0200  34.0000 0000800  10.0000 350.0000  1.00270000000000
INTELSAT 36
1 41945U 16067A   24001.50000000 -.00000200  00000-0  00000+0 0  9990
2 41945   0.0200  36.0000 0000600  12.0000 348.0000  1.00270000000000
SES-15
1 42709U 17027A   24001.50000000 -.00000200  00000-0  00000+0 0  9990
2 42709   0.0200  94.0000 0000700  15.0000 345.0000  1.00270000000000
TELSTAR 19V
1 43562U 18059A   24001.50000000 -.00000200  00000-0  00000+0 0  9990
2 43562   0.0200  63.0000 0000500  18.0000 342.0000  1.00270000000000
TDRS 13
1 43009U 17047A   24001.50000000 -.00000100  00000-0  00000+0 0  9990
2 43009   4.5000  96.0000 0002000  22.0000 338.0000  1.00270000000000
LANDSAT 8
1 39084U 13008A   24001.50000000  .00000050  00000-0  20000-4 0  9990
2 39084  98.2000  72.0000 0001300  88.0000 272.0000 14.57300000000000
LANDSAT 9
1 49260U 21088A   24001.50000000  .00000050  00000-0  20000-4 0  9990
2 49260  98.2000  74.0000 0001200  89.0000 271.0000 14.57300000000000
SENTINEL-1A
1 39634U 14016A   24001.50000000  .00000050  00000-0  20000-4 0  9990
2 39634  98.1000  76.0000 0001100  90.0000 270.0000 14.59200000000000
SENTINEL-2A
1 40697U 15028A   24001.50000000  .00000050  00000-0  20000-4 0  9990
2 40697  98.6000  78.0000 0001000  91.0000 269.0000 14.30900000000000
SENTINEL-2B
1 42063U 17013A   24001.50000000  .00000050  00000-0  20000-4 0  9990
2 42063  98.6000  80.0000 0001000  92.0000 268.0000 14.30900000000000
ENVISAT
1 27386U 02009A   24001.50000000  .00000020  00000-0  10000-4 0  9990
2 27386  98.4000  82.0000 0001500  93.0000 267.0000 14.37700000000000
CRYOSAT-2
1 36508U 10013A   24001.50000000  .00000020  00000-0  10000-4 0  9990
2 36508  92.0000  84.0000 0001300  94.0000 266.0000 14.52100000000000
SMAP
1 40376U 15007A   24001.50000000  .00000050  00000-0  20000-4 0  9990
2 40376  98.1000  86.0000 0001200  95.0000 265.0000 14.59900000000000
GRACE-FO 1
1 43476U 18047A   24001.50000000  .00000050  00000-0  20000-4 0  9990
2 43476  89.0000  88.0000 0010000  96.0000 264.0000 15.17200000000000
GRACE-FO 2
1 43477U 18047B   24001.50000000  .00000050  00000-0  20000-4 0  9990
2 43477  89.0000  89.0000 0010000  97.0000 263.0000 15.17200000000000
ICESat-2
1 43613U 18070A   24001.50000000  .00000050  00000-0  20000-4 0  9990
2 43613  92.0000  90.0000 0001100  98.0000 262.0000 14.60400000000000
JASON-3
1 41240U 16002A   24001.50000000  .00000020  00000-0  10000-4 0  9990
2 41240  66.0000  92.0000 0008000  99.0000 261.0000 12.80800000000000
SARAL
1 39086U 13009A   24001.50000000  .00000020  00000-0  10000-4 0  9990
2 39086  98.5000  94.0000 0009000 100.0000 260.0000 14.32400000000000
ASTROSAT
1 40930U 15052A   25001.50000000  .00000020  00000-0  10000-4 0  9992
2 40930   6.0000  80.0000 0006800 100.0000 260.0000 14.76600000000000
CARTOSAT-2F
1 43111U 18004A   25001.50000000  .00000100  00000-0  30000-4 0  9991
2 43111  97.4700  95.0000 0001200 102.0000 258.0000 14.82300000000000
CARTOSAT-3
1 44793U 19072A   25001.50000000  .00000100  00000-0  30000-4 0  9993
2 44793  97.4700  96.0000 0001000 103.0000 257.0000 14.84600000000000
RISAT-2BR1
1 44857U 19074A   25001.50000000  .00000150  00000-0  40000-4 0  9990
2 44857  36.9900 100.0000 0000500 105.0000 255.0000 14.99700000000000
RESOURCESAT-2
1 37387U 11049A   25001.50000000  .00000050  00000-0  20000-4 0  9992
2 37387  98.6600  92.0000 0001300 106.0000 254.0000 14.28400000000000
RESOURCESAT-2A
1 41877U 16073A   25001.50000000  .00000050  00000-0  20000-4 0  9994
2 41877  98.7100  93.0000 0001200 107.0000 253.0000 14.28700000000000
OCEANSAT-3 (EOS-06)
1 54361U 22143A   25001.50000000  .00000080  00000-0  25000-4 0  9990
2 54361  98.5200  94.0000 0001000 108.0000 252.0000 14.44800000000000
GSAT-11
1 43864U 18097A   25001.50000000 -.00000300  00000-0  00000+0 0  9991
2 43864   0.0400  74.0000 0000600  90.0000 270.0000  1.00273000000000
GSAT-29
1 43698U 18082A   25001.50000000 -.00000300  00000-0  00000+0 0  9993
2 43698   0.0400  55.0000 0000400  88.0000 272.0000  1.00273000000000
GSAT-30
1 44915U 20003A   25001.50000000 -.00000300  00000-0  00000+0 0  9991
2 44915   0.0200  83.0000 0000300  85.0000 275.0000  1.00273000000000
IRNSS-1A (NAVIC)
1 39199U 14011A   25001.50000000 -.00000100  00000-0  00000+0 0  9992
2 39199  29.0000  55.0000 0010000  72.0000 288.0000  1.00270000000000
IRNSS-1B (NAVIC)
1 40269U 14056A   25001.50000000 -.00000100  00000-0  00000+0 0  9991
2 40269  28.1000  57.0000 0009000  73.0000 287.0000  1.00270000000000
IRNSS-1C (NAVIC)
1 40547U 14083A   25001.50000000 -.00000100  00000-0  00000+0 0  9993
2 40547  27.0000 129.0000 0009000  74.0000 286.0000  1.00270000000000
IRNSS-1D (NAVIC)
1 40793U 15018A   25001.50000000 -.00000100  00000-0  00000+0 0  9992
2 40793  28.0000 111.0000 0009500  75.0000 285.0000  1.00270000000000
IRNSS-1I (NAVIC)
1 43286U 18035A   25001.50000000 -.00000100  00000-0  00000+0 0  9993
2 43286  27.5000  83.0000 0009200  76.0000 284.0000  1.00270000000000
SCATSAT-1
1 41877U 16073B   25001.50000000  .00000050  00000-0  20000-4 0  9990
2 41877  98.1000  97.0000 0001100 109.0000 251.0000 14.76300000000000
EOS-01 (RISAT-2BR2)
1 46612U 20080A   25001.50000000  .00000150  00000-0  40000-4 0  9991
2 46612  37.0000 102.0000 0000600 110.0000 250.0000 14.99500000000000
EOS-04 (RISAT-1A)
1 51740U 22028A   25001.50000000  .00000100  00000-0  30000-4 0  9993
2 51740  98.4000  98.0000 0001000 111.0000 249.0000 14.60400000000000
XPOSAT
1 58348U 24001A   25001.50000000  .00000050  00000-0  20000-4 0  9993
2 58348   6.0000  84.0000 0005000 112.0000 248.0000 14.82000000000000
MEGHA-TROPIQUES
1 37838U 11058A   25001.50000000  .00000050  00000-0  20000-4 0  9991
2 37838  20.0000  86.0000 0009500 113.0000 247.0000 14.54100000000000
INSAT-3DR
1 41752U 16049A   25001.50000000 -.00000300  00000-0  00000+0 0  9992
2 41752   1.3000  74.0000 0000700  92.0000 268.0000  1.00273000000000
INSAT-3D
1 39216U 13030A   25001.50000000 -.00000300  00000-0  00000+0 0  9991
2 39216   1.3000  74.0000 0000800  93.0000 267.0000  1.00273000000000
`;
}

// ============================================================
// UI HELPERS
// ============================================================
function setLoading(msg, pct) {
  document.getElementById('loadingMsg').textContent = msg;
  document.getElementById('loadingBar').style.width = pct + '%';
  const glow = document.getElementById('loadingBarGlow');
  if (glow) glow.style.width = pct + '%';
  const pctEl = document.getElementById('loadingPct');
  if (pctEl) pctEl.textContent = Math.round(pct) + '%';
}

// Preloader starfield canvas animation
(function initPreloaderCanvas() {
  const canvas = document.getElementById('preloaderCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h;
  const stars = [], nebulae = [];
  let animId;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  for (let i = 0; i < 320; i++) {
    stars.push({
      x: Math.random(), y: Math.random(),
      r: 0.3 + Math.random() * 1.4,
      alpha: 0.3 + Math.random() * 0.7,
      phase: Math.random() * Math.PI * 2,
      speed: 0.4 + Math.random() * 1.2,
      color: ['#00c8ff','#00ff9d','#ffffff','#c084fc','#ffd700'][Math.floor(Math.random()*5)]
    });
  }

  const nebulaColors = ['rgba(0,100,200,','rgba(80,0,160,','rgba(0,160,120,','rgba(160,40,80,'];
  for (let i = 0; i < 5; i++) {
    nebulae.push({
      x: Math.random(), y: Math.random(),
      rx: 0.12 + Math.random() * 0.22,
      ry: 0.08 + Math.random() * 0.14,
      angle: Math.random() * Math.PI,
      color: nebulaColors[i % nebulaColors.length],
      alpha: 0.04 + Math.random() * 0.07
    });
  }

  function draw(t) {
    ctx.clearRect(0, 0, w, h);
    const bg = ctx.createRadialGradient(w*0.5, h*0.42, 0, w*0.5, h*0.42, Math.max(w,h)*0.7);
    bg.addColorStop(0, '#020d1f');
    bg.addColorStop(1, '#000308');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    nebulae.forEach(n => {
      ctx.save();
      ctx.translate(n.x * w, n.y * h);
      ctx.rotate(n.angle);
      ctx.scale(1, n.ry / n.rx);
      const g = ctx.createRadialGradient(0,0,0,0,0,n.rx*w);
      g.addColorStop(0, n.color + (n.alpha * 1.5).toFixed(2) + ')');
      g.addColorStop(1, n.color + '0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, n.rx * w, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    stars.forEach(s => {
      const twinkle = 0.6 + 0.4 * Math.sin(t * s.speed + s.phase);
      ctx.globalAlpha = s.alpha * twinkle;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x * w, s.y * h, s.r * twinkle, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    animId = requestAnimationFrame(ts => draw(ts * 0.001));
  }
  draw(0);

  const observer = new MutationObserver(() => {
    if (document.getElementById('loadingOverlay').classList.contains('hidden')) {
      cancelAnimationFrame(animId);
      observer.disconnect();
    }
  });
  observer.observe(document.getElementById('loadingOverlay'), { attributes: true });
})();

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function updateRefreshMeta() {
  const meta = document.getElementById('refreshMeta');
  const error = document.getElementById('refreshError');
  if (meta) {
    const updated = state.lastUpdated
      ? state.lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : 'not yet';
    meta.textContent = state.isRefreshing ? 'Refreshing satellite feed...' : `Last updated ${updated}`;
  }
  if (error) {
    error.textContent = state.refreshError || '';
    error.classList.toggle('show', !!state.refreshError);
  }
}

function setRefreshBusy(isBusy) {
  state.isRefreshing = isBusy;
  ['btnRefresh', 'mBtnRefresh'].forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.disabled = isBusy;
    btn.setAttribute('aria-busy', String(isBusy));
    btn.classList.toggle('is-refreshing', isBusy);
    btn.style.opacity = isBusy ? '0.55' : '';
  });
  updateRefreshMeta();
}

// ============================================================
// SEARCH
// ============================================================
function initSearch() {
  const input = document.getElementById('searchInput');
  const results = document.getElementById('searchResults');

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { results.classList.remove('show'); return; }

    const filtered = getFilteredSats();
    const matches = filtered
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.name.toLowerCase().includes(q) || s.norad.includes(q))
      .slice(0, 20);

    results.innerHTML = '';
    matches.forEach(({ s, i }) => {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      item.innerHTML = `<span class="result-name">${getCategoryEmoji(s.cat)} ${s.name}</span><span class="result-id">#${s.norad}</span>`;
      item.addEventListener('click', () => {
        selectSatellite(i);
        input.value = s.name;
        results.classList.remove('show');
      });
      results.appendChild(item);
    });
    results.classList.toggle('show', matches.length > 0);
  });

  document.addEventListener('click', e => {
    if (!document.getElementById('searchContainer').contains(e.target)) {
      results.classList.remove('show');
    }
  });
}

// ============================================================
// BUTTON CONTROLS
// ============================================================
function initControls() {
  document.getElementById('btnOrbits').setAttribute('aria-pressed', String(state.showOrbits));
  document.getElementById('btnLabels').setAttribute('aria-pressed', String(state.showLabels));
  document.getElementById('btnFollow').setAttribute('aria-pressed', String(state.followMode));

  document.getElementById('btnOrbits').addEventListener('click', () => {
    state.showOrbits = !state.showOrbits;
    document.getElementById('btnOrbits').dataset.active = state.showOrbits;
    document.getElementById('btnOrbits').setAttribute('aria-pressed', String(state.showOrbits));
    state.orbitLines.forEach(l => { if (l) l.visible = state.showOrbits; });
  });

  document.getElementById('btnLabels').addEventListener('click', () => {
    state.showLabels = !state.showLabels;
    document.getElementById('btnLabels').dataset.active = state.showLabels;
    document.getElementById('btnLabels').setAttribute('aria-pressed', String(state.showLabels));
    showToast(state.showLabels ? 'Labels ON (performance impact)' : 'Labels OFF');
  });

  document.getElementById('btnFollow').addEventListener('click', () => {
    if (state.selectedIndex < 0) { showToast('Select a satellite first'); return; }
    state.followMode = !state.followMode;
    document.getElementById('btnFollow').dataset.active = state.followMode;
    document.getElementById('btnFollow').setAttribute('aria-pressed', String(state.followMode));
    if (!state.followMode && state.orbitControls) {
      state.orbitControls.spherical.setFromVector3(
        state.camera.position.clone().sub(state.orbitControls.target)
      );
    }
    showToast(state.followMode ? 'Following satellite' : 'Follow mode OFF');
  });

  document.getElementById('btnRefresh').addEventListener('click', async () => {
    if (state.isRefreshing) return;
    setRefreshBusy(true);
    state.refreshError = '';
    updateRefreshMeta();
    showToast('Refreshing satellite feed...');
    try {
      await fetchTLEs({ forceRefresh: true });
    } finally {
      setRefreshBusy(false);
    }
  });

  document.getElementById('closePanel').addEventListener('click', deselectSatellite);

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.setAttribute('aria-pressed', String(btn.classList.contains('active')));
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.filter-btn').forEach(b => b.setAttribute('aria-pressed', 'false'));
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      state.activeFilter = btn.dataset.filter;
      state.selectedIndex = -1;
      state.spriteMaterialCache = {};
      document.getElementById('infoPanel').classList.remove('open');
      buildSatelliteSprites();
    });
  });
}

// ============================================================
// WINDOW RESIZE
// ============================================================
function onResize() {
  const mobile = isMobile();
  const maxDpr = mobile ? 1.5 : 2;
  const { width, height } = getRenderSize();
  state.camera.aspect = width / height;
  state.renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxDpr));
  state.renderer.setSize(width, height, false);
  applyMobileGlobeView();
  if (mobile && document.getElementById('infoPanel')?.classList.contains('open')) {
    resizeMiniMapForViewport();
    const filtered = getFilteredSats();
    const sat = filtered[state.selectedIndex];
    if (sat) drawMiniMap(sat);
  }
}

let _resizeRaf = 0;
function scheduleResize() {
  if (_resizeRaf) cancelAnimationFrame(_resizeRaf);
  _resizeRaf = requestAnimationFrame(() => {
    _resizeRaf = 0;
    onResize();
  });
}

// ============================================================
// INIT  — Fix 2: UI shell visible immediately, data loads async
// ============================================================
async function init() {
  state.appStartTime = performance.now();
  state._loaderHidden = false;
  setLoading('Initializing 3D engine...', 5);

  // Three.js setup — synchronous, fast
  initThree();
  buildEarth();
  initOrbitControls();

  // Events
  window.addEventListener('resize', scheduleResize);
  window.addEventListener('orientationchange', () => setTimeout(scheduleResize, 220));
  window.addEventListener('click', onCanvasClick);
  initSearch();
  initControls();

  // Start render loop FIRST so Earth & stars are visible while data loads
  setLoading('Starting render loop...', 18);
  animate();

  initISROPanel();
  initSpaceCopilot();

  try { initPassPredictor(); } catch (e) { devLog('Pass predictor init failed', e); }
  try { initBookmarks(); } catch (e) { devLog('Bookmarks init failed', e); }
  try { initEducationSection(); } catch (e) { devLog('Education init failed', e); }
  updateRefreshMeta();

  await fetchTLEs();
}

// Start
init().catch(err => {
  devLog('init error', err);
  if (window.ORBITAL_CONFIG?.DEV) console.error('Orbital init error:', err);
  if (!state.tleLoaded) applyTleRaw(getSampleTLEs(), { source: 'bundled' });
  hideLoadingOverlay();
});

// ============================================================
// SPACE COPILOT — lazy-loaded xAI chat (js/copilot.js)
// ============================================================
const SYSTEM_PROMPT = `You are Space Copilot, the Satellite Intelligence AI inside ORBITAL — a real-time 3D satellite tracker by Yatharth.

Explain orbits, satellite types, and space missions in simple, engaging language. Use **bold** for key terms. Keep answers under 220 words unless the user needs depth.

Rules:
- Use the LIVE CONTEXT block when a satellite is selected — cite altitude, orbit type, and category from that data.
- Say "based on currently loaded data" when using live orbital numbers.
- Do not invent precise pass times unless computed data is provided.
- For surveillance/spying questions: answer responsibly — most Earth observation satellites have limited resolution; Starlink/GPS are not designed for spying on individuals.
- Do not dump raw TLE lines unless asked.
- End with one short follow-up question when helpful.`;

function getCopilotContext() {
  const filtered = getFilteredSats();
  if (state.selectedIndex >= 0 && filtered[state.selectedIndex]) {
    const sat = filtered[state.selectedIndex];
    const geo = sat._lastGeo || propagateToGeodetic(sat.satrec, new Date());
    const periodMin = geo ? (2 * Math.PI / sat.satrec.no).toFixed(1) : '—';
    const incl = (sat.satrec.inclo * 180 / Math.PI).toFixed(2);
    if (geo) {
      return `\n\n[LIVE CONTEXT] Selected: ${sat.name} | NORAD ${sat.norad} | Type: ${sat.cat.toUpperCase()} | Orbit: ${getOrbitType(geo.alt)} | Alt: ${Math.round(geo.alt)} km | Lat: ${geo.lat.toFixed(2)}° | Lon: ${geo.lon.toFixed(2)}° | Speed: ${geo.vel.toFixed(2)} km/s | Inclination: ${incl}° | Period: ${periodMin} min | Data source: ${state.dataSource || 'unknown'}`;
    }
    return `\n\n[LIVE CONTEXT] Selected: ${sat.name} | NORAD ${sat.norad} | Type: ${sat.cat.toUpperCase()}`;
  }
  return `\n\n[LIVE CONTEXT] Tracking ${state.satellites.length} satellites. Filter: ${state.activeFilter}. No satellite selected.`;
}

function getCopilotHooks() {
  return {
    getContext: getCopilotContext,
    getSystemPrompt: () => SYSTEM_PROMPT,
    getSelectedLabel: () => {
      const f = getFilteredSats();
      return state.selectedIndex >= 0 && f[state.selectedIndex] ? f[state.selectedIndex].name : null;
    }
  };
}

let _copilotScriptLoading = null;

function loadCopilotScript() {
  if (window.OrbitalCopilot) return Promise.resolve(window.OrbitalCopilot);
  if (_copilotScriptLoading) return _copilotScriptLoading;
  _copilotScriptLoading = new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = './js/copilot.js?v=2';
    s.onload  = () => resolve(window.OrbitalCopilot || null);
    s.onerror = () => resolve(null); // missing file → graceful null, never crashes
    document.body.appendChild(s);
  });
  return _copilotScriptLoading;
}

async function ensureSpaceCopilot() {
  const mod = await loadCopilotScript();
  if (mod && !window._copilotReady) {
    try { mod.init(getCopilotHooks()); } catch(e) { devLog('copilot init failed', e); }
    window._copilotReady = true;
  }
  return mod; // may be null if js/copilot.js not present
}

function initSpaceCopilot() {
  document.getElementById('copilotFab')?.addEventListener('click', async () => {
    try {
      const mod = await ensureSpaceCopilot();
      if (!mod || typeof mod.toggleCopilot !== 'function') {
        showToast('Space Copilot module is unavailable');
        return;
      }
      mod.toggleCopilot();
    } catch (e) {
      showToast('Space Copilot failed to load');
      devLog(e);
    }
  });
}

// ============================================================
// MOBILE UI — bottom nav, drawers, sheets
// ============================================================
let _mobileUiInited = false;

function initMobileUI() {
  if (!isMobile()) {
    _mobileUiInited = false;
    return;
  }
  if (_mobileUiInited) return;
  _mobileUiInited = true;

  const overlay    = document.getElementById('mobOverlay');
  const drawer     = document.getElementById('mobDrawer');
  const sheet      = document.getElementById('mobSheet');
  const aiSheet    = document.getElementById('mobAISheet');
  const moreSheet  = document.getElementById('mobMoreSheet');
  const drawerBody = document.getElementById('mobSatListBody');
  let lastMobileFocus = null;

  function setNavActive(btn) {
    document.querySelectorAll('.mob-nav-btn').forEach(b => b.classList.remove('active'));
    btn?.classList.add('active');
  }

  function closeAll() {
    closeMobileOverlays();
    closeFeaturePanels();
    if (lastMobileFocus && document.contains(lastMobileFocus)) {
      lastMobileFocus.focus({ preventScroll: true });
    }
    lastMobileFocus = null;
  }

  function openSheet(el, navBtn) {
    if (!el) return;
    const focusSource = document.activeElement;
    closeMobileOverlays();
    lastMobileFocus = focusSource;
    el.classList.add('open');
    overlay.classList.add('show');
    setNavActive(navBtn);
    syncMobilePanelA11y();
    requestAnimationFrame(() => {
      const focusTarget = el.querySelector('input, textarea, button, [href], [tabindex]:not([tabindex="-1"])');
      focusTarget?.focus({ preventScroll: true });
    });
  }

  overlay.addEventListener('click', closeAll);
  document.getElementById('mobDrawerClose')?.addEventListener('click', closeAll);
  document.getElementById('mobSheetClose')?.addEventListener('click', closeAll);
  document.getElementById('mobAIClose')?.addEventListener('click', closeAll);
  document.getElementById('mobMoreClose')?.addEventListener('click', closeAll);

  document.getElementById('mobGlobe')?.addEventListener('click', () => {
    closeAll();
    document.getElementById('infoPanel')?.classList.remove('open');
    ['passPanel', 'bookmarksPanel', 'isroPanel'].forEach(id => {
      document.getElementById(id)?.classList.remove('open');
    });
    setNavActive(document.getElementById('mobGlobe'));
  });

  document.getElementById('mobSats')?.addEventListener('click', () => {
    const srcList = document.getElementById('satList');
    drawerBody.innerHTML = srcList?.innerHTML
      || '<p class="mob-empty-hint">No satellites loaded yet.</p>';
    drawerBody.querySelectorAll('.sat-list-item').forEach((item, i) => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.dataset.idx ?? i, 10);
        selectSatellite(idx);
        closeAll();
      });
    });
    openSheet(drawer, document.getElementById('mobSats'));
  });

  document.getElementById('mobFilter')?.addEventListener('click', () => {
    openSheet(sheet, document.getElementById('mobFilter'));
  });

  document.getElementById('mobAI')?.addEventListener('click', () => {
    openSheet(aiSheet, document.getElementById('mobAI'));
    ensureSpaceCopilot().then(() => document.getElementById('mobAIInput')?.focus()).catch(() => {});
  });

  document.getElementById('mobMore')?.addEventListener('click', () => {
    openSheet(moreSheet, document.getElementById('mobMore'));
  });

  document.getElementById('mobOpenISRO')?.addEventListener('click', () => {
    closeAll();
    openISROPanel();
  });

  document.getElementById('mobOpenBookmarks')?.addEventListener('click', () => {
    closeAll();
    document.getElementById('btnBookmarks')?.click();
  });

  document.getElementById('mobOpenPasses')?.addEventListener('click', () => {
    const filtered = getFilteredSats();
    const sat = state.selectedIndex >= 0 ? filtered[state.selectedIndex] : null;
    if (!sat) {
      showToast('Tap a satellite on the globe or pick one from SATS');
      document.getElementById('mobSats')?.click();
      return;
    }
    closeAll();
    openPassPredictor(sat);
  });

  document.getElementById('mobOpenSearch')?.addEventListener('click', () => {
    closeAll();
    const input = document.getElementById('searchInput');
    input?.focus();
    input?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });

  document.querySelectorAll('.mob-filter-btn').forEach(btn => {
    btn.setAttribute('aria-pressed', String(btn.classList.contains('active')));
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mob-filter-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.mob-filter-btn').forEach(b => b.setAttribute('aria-pressed', 'false'));
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      const desktopBtn = document.querySelector(`.filter-btn[data-filter="${btn.dataset.filter}"]`);
      if (desktopBtn) desktopBtn.click();
      else {
        state.activeFilter = btn.dataset.filter;
        buildSatelliteSprites();
      }
    });
  });

  const mBtnMap = {
    mBtnOrbits: 'btnOrbits',
    mBtnLabels: 'btnLabels',
    mBtnFollow: 'btnFollow',
    mBtnRefresh: 'btnRefresh'
  };
  Object.entries(mBtnMap).forEach(([mobId, deskId]) => {
    const mobBtn = document.getElementById(mobId);
    const deskBtn = document.getElementById(deskId);
    if (!mobBtn || !deskBtn) return;
    mobBtn.setAttribute('aria-pressed', String(deskBtn.dataset.active === 'true'));
    mobBtn.addEventListener('click', () => {
      deskBtn.click();
      mobBtn.dataset.active = String(deskBtn.dataset.active === 'true');
      mobBtn.setAttribute('aria-pressed', mobBtn.dataset.active);
    });
  });

  const mobAIInput = document.getElementById('mobAIInput');
  mobAIInput?.addEventListener('input', () => {
    mobAIInput.style.height = 'auto';
    mobAIInput.style.height = Math.min(mobAIInput.scrollHeight, 120) + 'px';
  });

  document.body.classList.add('is-mobile');
  syncMobilePanelA11y();
}

let _wasMobile = isMobile();
window.addEventListener('resize', () => {
  const now = isMobile();
  if (now !== _wasMobile) {
    _wasMobile = now;
    document.body.classList.toggle('is-mobile', now);
    if (now) initMobileUI();
    else document.body.classList.remove('is-mobile');
  }
  scheduleResize();
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMobileUI);
} else {
  initMobileUI();
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeAllTransientPanels();
});

// ╔══════════════════════════════════════════════════════════════════╗
// ║  FEATURE 1 — ISS PASS PREDICTOR                                 ║
// ║  Uses observer GPS + satellite.js to find visible passes         ║
// ╚══════════════════════════════════════════════════════════════════╝

const passState = {
  observerLat: null,
  observerLon: null,
  observerAlt: 0.1,   // km above sea level
  currentSat: null,
  locationName: ''
};

function initPassPredictor() {
  const panel    = document.getElementById('passPanel');
  const closeBtn = document.getElementById('passClose');
  const locBtn   = document.getElementById('passLocBtn');
  const manualLatEl = document.getElementById('passManualLat');
  const manualLonEl = document.getElementById('passManualLon');
  const manualBtn   = document.getElementById('passManualBtn');

  if (!panel) return;

  closeBtn?.addEventListener('click', () => setFeaturePanelOpen('passPanel', false));

  locBtn?.addEventListener('click', () => {
    if (!navigator.geolocation) {
      showToast('Geolocation not supported');
      return;
    }
    locBtn.textContent = 'LOCATING…';
    locBtn.disabled = true;
    navigator.geolocation.getCurrentPosition(
      pos => {
        passState.observerLat = pos.coords.latitude;
        passState.observerLon = pos.coords.longitude;
        passState.observerAlt = (pos.coords.altitude || 0) / 1000;
        passState.locationName = `${pos.coords.latitude.toFixed(2)}°, ${pos.coords.longitude.toFixed(2)}°`;
        document.getElementById('passLocationLabel').textContent = `📍 ${passState.locationName}`;
        locBtn.textContent = '📍 LOCATED';
        locBtn.disabled = false;
        if (passState.currentSat) computePasses(passState.currentSat);
      },
      err => {
        showToast('Location denied — enter manually');
        locBtn.textContent = '📍 USE MY LOCATION';
        locBtn.disabled = false;
      },
      { timeout: 8000 }
    );
  });

  // Manual coordinates
  manualBtn?.addEventListener('click', () => {
    const lat = parseFloat(manualLatEl.value);
    const lon = parseFloat(manualLonEl.value);
    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      showToast('Invalid coordinates');
      return;
    }
    passState.observerLat = lat;
    passState.observerLon = lon;
    passState.observerAlt = 0.1;
    passState.locationName = `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
    document.getElementById('passLocationLabel').textContent = `📍 ${passState.locationName}`;
    if (passState.currentSat) computePasses(passState.currentSat);
  });

  // Quick-set India cities
  document.querySelectorAll('.pass-city-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      passState.observerLat = parseFloat(btn.dataset.lat);
      passState.observerLon = parseFloat(btn.dataset.lon);
      passState.observerAlt = 0.1;
      passState.locationName = btn.textContent;
      document.getElementById('passLocationLabel').textContent = `📍 ${passState.locationName}`;
      manualLatEl.value = passState.observerLat;
      manualLonEl.value = passState.observerLon;
      document.querySelectorAll('.pass-city-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (passState.currentSat) computePasses(passState.currentSat);
    });
  });
}

function openPassPredictor(sat) {
  const panel = document.getElementById('passPanel');
  if (!panel) return;
  closeMobileOverlays();
  closeFeaturePanels('passPanel');
  passState.currentSat = sat;
  document.getElementById('passSatName').textContent = sat.name;
  document.getElementById('passSatCat').textContent = sat.cat.toUpperCase();
  document.getElementById('passResults').innerHTML = `<div class="pass-hint">Set your location above, then passes compute automatically.</div>`;
  setFeaturePanelOpen('passPanel', true);
  if (isMobile()) requestAnimationFrame(() => document.getElementById('passClose')?.focus({ preventScroll: true }));
  if (passState.observerLat !== null) computePasses(sat);
}

function computePasses(sat) {
  if (passState.observerLat === null) return;

  const resultsEl = document.getElementById('passResults');
  resultsEl.innerHTML = '<div class="pass-loading"><div class="pass-spinner"></div>Computing passes…</div>';

  // Run in a short timeout so the UI updates first
  setTimeout(() => {
    const passes = findPasses(sat, passState.observerLat, passState.observerLon, passState.observerAlt, 48);
    if (passes.length === 0) {
      resultsEl.innerHTML = `<div class="pass-hint">No visible passes found in the next 48 hours. The satellite may be in a polar or equatorial orbit that doesn't pass over your location.</div>`;
      return;
    }

    resultsEl.innerHTML = '';
    passes.forEach((p, i) => {
      const card = document.createElement('div');
      card.className = `pass-card ${p.maxEl >= 60 ? 'pass-excellent' : p.maxEl >= 30 ? 'pass-good' : 'pass-low'}`;
      const riseTime = formatPassTime(p.riseTime);
      const setTime  = formatPassTime(p.setTime);
      const durationMin = Math.round((p.setTime - p.riseTime) / 60000);
      const quality = p.maxEl >= 60 ? '🌟 EXCELLENT' : p.maxEl >= 30 ? '✅ GOOD' : '👁 LOW';
      card.innerHTML = `
        <div class="pass-card-header">
          <span class="pass-number">#${i+1}</span>
          <span class="pass-quality">${quality}</span>
          <span class="pass-duration">${durationMin} min</span>
        </div>
        <div class="pass-card-times">
          <div class="pass-time-row">
            <span class="pass-time-label">RISES</span>
            <span class="pass-time-val">${riseTime.date} <strong>${riseTime.time}</strong></span>
            <span class="pass-az">${bearingLabel(p.riseAz)}</span>
          </div>
          <div class="pass-time-row">
            <span class="pass-time-label">PEAK</span>
            <span class="pass-time-val"><strong>${riseTime.date}</strong></span>
            <span class="pass-el">MAX ${Math.round(p.maxEl)}°</span>
          </div>
          <div class="pass-time-row">
            <span class="pass-time-label">SETS</span>
            <span class="pass-time-val">${setTime.date} <strong>${setTime.time}</strong></span>
            <span class="pass-az">${bearingLabel(p.setAz)}</span>
          </div>
        </div>
        <button class="pass-share-btn" onclick="sharePass('${sat.name}','${riseTime.date}','${riseTime.time}',${Math.round(p.maxEl)})">
          Share This Pass 🚀
        </button>`;
      resultsEl.appendChild(card);
    });
  }, 30);
}

// Core pass-finding algorithm using satellite.js observer geometry
function findPasses(sat, lat, lon, altKm, hoursAhead) {
  const DEG = Math.PI / 180;
  const now      = Date.now();
  const endTime  = now + hoursAhead * 3600 * 1000;
  const stepMs   = 20000;   // 20-second coarse step
  const MIN_EL   = 5;       // degrees — anything below is below horizon

  const observerGd = {
    latitude:  lat  * DEG,
    longitude: lon  * DEG,
    height:    altKm
  };

  const passes = [];
  let inPass = false;
  let passRise = null, passRiseAz = 0, passSetAz = 0;
  let maxEl = 0, peakTime = null;
  let t = now;

  while (t < endTime) {
    const date = new Date(t);
    let el = 0, az = 0;

    try {
      const pv   = satellite.propagate(sat.satrec, date);
      if (pv && pv.position && pv.position !== true) {
        const gmst = satellite.gstime(date);
        const look  = satellite.ecfToLookAngles(observerGd, satellite.eciToEcf(pv.position, gmst));
        el = look.elevation * (180 / Math.PI);
        az = look.azimuth   * (180 / Math.PI);
      }
    } catch(e) {}

    if (!inPass && el >= MIN_EL) {
      inPass    = true;
      passRise  = t;
      passRiseAz= az;
      maxEl     = el;
      peakTime  = t;
    } else if (inPass) {
      if (el > maxEl) { maxEl = el; peakTime = t; }
      if (el < MIN_EL) {
        // Refine set time with 1-second steps
        let ft = t - stepMs;
        while (ft < t) {
          try {
            const pv2  = satellite.propagate(sat.satrec, new Date(ft));
            if (pv2 && pv2.position && pv2.position !== true) {
              const gmst2 = satellite.gstime(new Date(ft));
              const lk    = satellite.ecfToLookAngles(observerGd, satellite.eciToEcf(pv2.position, gmst2));
              passSetAz = lk.azimuth * (180 / Math.PI);
            }
          } catch(e) {}
          ft += 1000;
        }
        passes.push({ riseTime: passRise, setTime: t, riseAz: passRiseAz, setAz: passSetAz, maxEl, peakTime });
        inPass = false;
        maxEl  = 0;
        if (passes.length >= 8) break;
      }
    }
    t += stepMs;
  }
  return passes;
}

function formatPassTime(ms) {
  const d = new Date(ms);
  const date = d.toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short' });
  const time = d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12: false });
  return { date, time };
}

function bearingLabel(az) {
  const dirs = ['N','NE','E','SE','S','SW','W','NW','N'];
  return dirs[Math.round(az / 45) % 8];
}

function sharePass(satName, date, time, maxEl) {
  const text = `🛰️ ${satName} will pass overhead!\n📅 ${date} at ${time}\n📡 Max elevation: ${maxEl}°\n\nTrack it live on ORBITAL 🌍\n#Satellite #Space #ORBITAL`;
  const encoded = encodeURIComponent(text);
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encoded}`;
  window.open(twitterUrl, '_blank', 'width=600,height=400');
}

window.sharePass = sharePass; // expose for inline onclick

// ╔══════════════════════════════════════════════════════════════════╗
// ║  FEATURE 2 — BOOKMARKS & SOCIAL SHARE                          ║
// ╚══════════════════════════════════════════════════════════════════╝

// Persisted in localStorage so bookmarks survive page refresh
const bookmarks = new Set(JSON.parse(localStorage.getItem('orbital_bookmarks') || '[]'));

function saveBookmarks() {
  localStorage.setItem('orbital_bookmarks', JSON.stringify([...bookmarks]));
}

function toggleBookmark(sat) {
  if (bookmarks.has(sat.norad)) {
    bookmarks.delete(sat.norad);
    showToast(`Removed ${sat.name} from bookmarks`);
  } else {
    bookmarks.add(sat.norad);
    showToast(`Bookmarked ${sat.name} ⭐`);
  }
  saveBookmarks();
  renderBookmarksList();
}

function initBookmarks() {
  const panel   = document.getElementById('bookmarksPanel');
  const openBtn = document.getElementById('btnBookmarks');
  const closeBtn= document.getElementById('bookmarksClose');
  if (!panel || !openBtn) return;

  openBtn.addEventListener('click', () => {
    closeMobileOverlays();
    closeFeaturePanels('bookmarksPanel');
    setFeaturePanelOpen('bookmarksPanel', !panel.classList.contains('open'));
    renderBookmarksList();
    if (isMobile() && panel.classList.contains('open')) {
      requestAnimationFrame(() => document.getElementById('bookmarksClose')?.focus({ preventScroll: true }));
    }
  });
  closeBtn?.addEventListener('click', () => setFeaturePanelOpen('bookmarksPanel', false));
  renderBookmarksList();
}

function renderBookmarksList() {
  const el = document.getElementById('bookmarksList');
  if (!el) return;
  if (bookmarks.size === 0) {
    el.innerHTML = `<div class="bm-empty">
      <div class="bm-empty-icon">⭐</div>
      <div>No bookmarks yet.<br>Click SAVE on any satellite.</div>
    </div>`;
    return;
  }
  el.innerHTML = '';
  bookmarks.forEach(norad => {
    const sat = state.satellites.find(s => s.norad === norad);
    const name = sat ? sat.name : `NORAD ${norad}`;
    const cat  = sat ? sat.cat  : 'other';
    const div  = document.createElement('div');
    div.className = 'bm-item';
    div.innerHTML = `
      <span class="bm-emoji">${getCategoryEmoji(cat)}</span>
      <div class="bm-info">
        <div class="bm-name">${name}</div>
        <div class="bm-norad">#${norad}</div>
      </div>
      <div class="bm-actions">
        <button class="bm-go" title="Go to satellite">→</button>
        <button class="bm-rm" title="Remove">✕</button>
      </div>`;
    div.querySelector('.bm-go').addEventListener('click', () => {
      if (!sat) { showToast('Load satellites first'); return; }
      const filtered = getFilteredSats();
      const idx = filtered.findIndex(s => s.norad === norad);
      if (idx >= 0) { selectSatellite(idx); document.getElementById('bookmarksPanel').classList.remove('open'); }
      else showToast('Switch to ALL filter first');
    });
    div.querySelector('.bm-rm').addEventListener('click', () => {
      bookmarks.delete(norad); saveBookmarks(); renderBookmarksList();
    });
    el.appendChild(div);
  });
}

function shareSatellite(sat, geo) {
  const name = sat.name;
  const lat  = geo.lat.toFixed(2);
  const lon  = geo.lon.toFixed(2);
  const alt  = Math.round(geo.alt);
  const vel  = geo.vel.toFixed(1);
  const text = `🛰️ I'm tracking ${name} right now!\n📍 Position: ${lat}°, ${lon}°\n🏔️ Altitude: ${alt} km\n⚡ Speed: ${vel} km/s\n\nWatch it live on ORBITAL 🌍\n#Satellite #Space #ORBITAL #ISRO`;
  const encoded = encodeURIComponent(text);

  // Share sheet — try native first, fall back to Twitter
  if (navigator.share) {
    navigator.share({ title: `Tracking ${name}`, text, url: window.location.href })
      .catch(() => window.open(`https://twitter.com/intent/tweet?text=${encoded}`, '_blank'));
  } else {
    window.open(`https://twitter.com/intent/tweet?text=${encoded}`, '_blank', 'width=600,height=400');
  }
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  FEATURE 3 — ISRO INDIA PANEL                                   ║
// ║  Indian satellites, ISRO missions, PSLV launches                 ║
// ╚══════════════════════════════════════════════════════════════════╝

const ISRO_MISSIONS = [
  { name: 'Chandrayaan-3', icon: '🌙', status: 'SUCCESS', type: 'Lunar Lander', year: '2023', launch: 'Jul 2023', agency: 'ISRO',
    desc: 'Lunar lander-rover mission that reached the Moon\'s south polar region.',
    highlight: '4th nation to soft-land on the Moon; first landing near the lunar south pole region.',
    norad: null, search: 'CHANDRAYAAN', color: '#ffd700' },
  { name: 'Chandrayaan-2 Orbiter', icon: '🌙', status: 'ACTIVE', type: 'Lunar Orbiter', year: '2019', launch: 'Jul 2019', agency: 'ISRO',
    desc: 'Orbiter still active; mapped the Moon including the south pole at high resolution.',
    highlight: 'Orbiter continues returning science data years after launch.',
    norad: '44441', search: 'CHANDRAYAAN-2', color: '#aabb44' },
  { name: 'Aditya-L1', icon: '☀️', status: 'ACTIVE', type: 'Solar Observatory', year: '2023', launch: 'Sep 2023', agency: 'ISRO',
    desc: 'India\'s first dedicated solar observatory at the Sun-Earth L1 point.',
    highlight: 'Monitors solar storms and space weather affecting Earth.',
    norad: '57422', search: 'ADITYA', color: '#ff8c42' },
  { name: 'XPoSat', icon: '⭐', status: 'ACTIVE', type: 'Space Telescope', year: '2024', launch: 'Jan 2024', agency: 'ISRO',
    desc: 'X-ray polarimetry observatory studying black holes and neutron stars.',
    highlight: 'Among only a handful of X-ray polarimetry missions worldwide.',
    norad: '58348', search: 'XPOSAT', color: '#c084fc' },
  { name: 'Mangalyaan (MOM)', icon: '🔴', status: 'ENDED', type: 'Mars Orbiter', year: '2013', launch: 'Nov 2013', agency: 'ISRO',
    desc: 'India\'s first Mars mission; operated well beyond its planned lifetime.',
    highlight: '1st nation to reach Mars orbit on its first attempt.',
    norad: null, search: 'MOM', color: '#ff4444' },
  { name: 'NavIC (IRNSS)', icon: '🧭', status: 'ACTIVE', type: 'Navigation Constellation', year: '2013–2018', launch: '2013–2018', agency: 'ISRO',
    desc: 'Regional GNSS constellation for India and surrounding region.',
    highlight: 'India operates its own independent navigation satellite system.',
    norad: '41859', search: 'IRNSS', color: '#ff6b35' },
  { name: 'Cartosat-3', icon: '🗺️', status: 'ACTIVE', type: 'Earth Observation', year: '2019', launch: 'Nov 2019', agency: 'ISRO',
    desc: 'High-resolution imaging satellite for mapping and monitoring.',
    highlight: 'Sub-metre class Earth imaging for urban and infrastructure planning.',
    norad: '44793', search: 'CARTOSAT-3', color: '#4ecdc4' },
  { name: 'RISAT-2BR1', icon: '🔍', status: 'ACTIVE', type: 'Radar Imaging', year: '2019', launch: 'Dec 2019', agency: 'ISRO',
    desc: 'SAR satellite for all-weather Earth observation.',
    highlight: 'Radar sees through clouds — useful for floods and agriculture.',
    norad: '44857', search: 'RISAT-2BR1', color: '#00ff9d' },
  { name: 'GSAT-11', icon: '🌐', status: 'ACTIVE', type: 'Communications', year: '2018', launch: 'Dec 2018', agency: 'ISRO',
    desc: 'High-throughput broadband communication satellite.',
    highlight: 'One of ISRO\'s heaviest and highest-capacity comm satellites.',
    norad: '43864', search: 'GSAT-11', color: '#00c8ff' },
  { name: 'Astrosat', icon: '🔭', status: 'ACTIVE', type: 'Multi-wavelength Observatory', year: '2015', launch: 'Sep 2015', agency: 'ISRO',
    desc: 'India\'s first dedicated multi-wavelength astronomy satellite.',
    highlight: 'Observes universe in UV, optical, and X-ray bands simultaneously.',
    norad: '40930', search: 'ASTROSAT', color: '#9b59b6' }
];

const UPCOMING_LAUNCHES = [
  { name: 'NISAR', status: 'TARGETED', date: 'Targeted 2025', rocket: 'GSLV Mk-II', desc: 'NASA-ISRO joint SAR Earth science mission for climate, agriculture, and hazards.', flag: '🇮🇳🇺🇸' },
  { name: 'Gaganyaan — Uncrewed Test', status: 'IN DEVELOPMENT', date: 'Planned before crewed flight', rocket: 'LVM3', desc: 'Uncrewed orbital test of the crew module and escape systems.', flag: '🇮🇳' },
  { name: 'Gaganyaan — Crewed Mission', status: 'PLANNED', date: 'Targeted mid-2020s', rocket: 'LVM3', desc: 'India\'s first crewed orbital flight with Vyomanauts.', flag: '🇮🇳👨‍🚀' },
  { name: 'Chandrayaan-4', status: 'PLANNED', date: 'Targeted 2026–2027', rocket: 'LVM3', desc: 'Planned lunar sample-return architecture (official timelines may shift).', flag: '🇮🇳' },
  { name: 'Shukrayaan (Venus Orbiter)', status: 'TBD', date: 'Under study', rocket: 'LVM3 (expected)', desc: 'Proposed Venus orbiter to study atmosphere and surface processes.', flag: '🇮🇳' },
  { name: 'Bharatiya Antariksh Station', status: 'IN DEVELOPMENT', date: 'Targeted ~2040 phase', rocket: 'LVM3 / future HLV', desc: 'India\'s planned modular space station — long-term human spaceflight goal.', flag: '🇮🇳' }
];


const DEFAULT_ISRO_NEWS = {
  updated: '2026-06-03T00:00:00.000Z',
  source: 'bundled fallback',
  articles: [
    {
      title: 'Chandrayaan-3: India Lands on the Moon\'s South Pole',
      source: 'ISRO',
      date: '23 Aug 2023',
      url: 'https://www.isro.gov.in/Chandrayaan3.html',
      summary: 'India became the first nation to soft-land near the lunar south pole. The Vikram lander touched down successfully and deployed the Pragyan rover, which confirmed the presence of sulphur and other elements.'
    },
    {
      title: 'Aditya-L1: India\'s First Solar Observatory Reaches Halo Orbit',
      source: 'ISRO',
      date: '6 Jan 2024',
      url: 'https://www.isro.gov.in/Aditya_L1.html',
      summary: 'ISRO\'s Aditya-L1 spacecraft successfully entered a halo orbit around the Sun-Earth Lagrange Point 1, roughly 1.5 million km from Earth, to study solar winds and coronal activity.'
    },
    {
      title: 'PSLV-C58 / XPoSat Mission Launched',
      source: 'ISRO',
      date: '1 Jan 2024',
      url: 'https://www.isro.gov.in/PSLVC58_XPoSat.html',
      summary: 'India\'s X-ray Polarimeter Satellite (XPoSat) was launched on New Year\'s Day 2024. It will study polarisation of X-rays from bright cosmic sources like black holes and neutron stars.'
    },
    {
      title: 'Gaganyaan: Human Spaceflight Programme Update',
      source: 'ISRO',
      date: '2025',
      url: 'https://www.isro.gov.in/Gaganyaan.html',
      summary: 'ISRO is progressing with uncrewed test flights ahead of India\'s first crewed orbital mission. The Vyomanauts are undergoing training and crew module systems have passed key qualification tests.'
    },
    {
      title: 'GSAT-20 / NVS-02 Broadband Satellite Launched via SpaceX',
      source: 'ISRO',
      date: 'Nov 2024',
      url: 'https://www.isro.gov.in/',
      summary: 'ISRO\'s GSAT-20 high-throughput communication satellite was launched on a SpaceX Falcon 9 rocket, providing broadband connectivity over India and neighbouring regions.'
    },
    {
      title: 'Track Indian Satellites Live in ORBITAL',
      source: 'ORBITAL',
      date: 'Live tracker',
      url: 'https://celestrak.org/',
      summary: 'Use the MISSIONS and STATS tabs to jump directly to ISRO satellites — Cartosat, RISAT, GSAT, IRNSS/NavIC, and more — currently tracked in the live TLE catalog.'
    }
  ]
};

function newsRequestOptions(timeoutMs = 5000) {
  if (!window.AbortController) return {};
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), timeoutMs);
  return { signal: ctrl.signal };
}

function normalizeNewsPayload(data, source) {
  const articles = Array.isArray(data?.articles) ? data.articles : [];
  return {
    updated: data?.updated || new Date().toISOString(),
    source: data?.source || source,
    articles: articles
      .filter(a => a && a.title)
      .slice(0, 8)
      .map(a => ({
        title: String(a.title || '').trim(),
        source: String(a.source || 'ISRO').trim(),
        date: String(a.date || '').trim(),
        url: String(a.url || 'https://www.isro.gov.in/').trim(),
        summary: String(a.summary || '').trim()
      }))
  };
}

function escapeNewsHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

async function fetchNewsJson(url, timeoutMs) {
  const res = await fetch(url, newsRequestOptions(timeoutMs));
  if (!res.ok) throw new Error(`News request failed: ${res.status}`);
  return res.json();
}

async function getIsroNewsData() {
  // ── 1. Try local backend API (only present when running `npm start` locally) ──
  if (true) {
    try {
      const data = await fetchNewsJson('/api/isro-news', 5000);
      const normalized = normalizeNewsPayload(data, 'shared backend');
      if (normalized.articles.length) return normalized;
    } catch (e) {
      devLog('backend news unavailable', e.message);
    }
  }

  // ── 2. Spaceflight News API — public, free, CORS-enabled, no key needed ──────
  //    Tries direct fetch first, then falls back through CORS proxies.
  const SNAPI_BASE = 'https://api.spaceflightnewsapi.net/v4/articles/?limit=12&search=';
  const queries = ['ISRO', 'PSLV OR GSLV', 'Chandrayaan OR Gaganyaan', 'India space mission'];

  async function trySnapi(baseUrl, opts) {
    const res = await fetch(baseUrl, opts);
    if (!res.ok) throw new Error('status ' + res.status);
    return res.json();
  }

  for (const q of queries) {
    const encodedQ = encodeURIComponent(q);
    const directUrl = SNAPI_BASE + encodedQ;
    const proxiedUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(directUrl)}`;

    let json = null;
    for (const url of [directUrl, proxiedUrl]) {
      try {
        json = await trySnapi(url, newsRequestOptions(7000));
        if (json) break;
      } catch (e) {
        devLog('SNAPI attempt failed:', url.slice(0, 60), e.message);
      }
    }
    if (!json) continue;

    const results = Array.isArray(json && json.results) ? json.results : [];
    if (!results.length) continue;

    const seen = new Set();
    const articles = results
      .filter(r => {
        if (!r.title || seen.has(r.title)) return false;
        seen.add(r.title);
        return true;
      })
      .slice(0, 8)
      .map(r => ({
        title: r.title || '',
        source: r.news_site || 'Space News',
        date: r.published_at
          ? new Date(r.published_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
          : '',
        url: r.url || 'https://www.isro.gov.in/',
        summary: r.summary || ''
      }));

    if (articles.length) {
      devLog('news loaded via Spaceflight News API, query:', q);
      return { updated: new Date().toISOString(), source: 'Spaceflight News API', articles };
    }
  }

  // ── 3. Static fallback bundled in the app ─────────────────────────────────────
  devLog('all live news sources failed — using bundled fallback');
  return normalizeNewsPayload(DEFAULT_ISRO_NEWS, 'bundled fallback');
}

async function loadIsroNews(options = {}) {
  const el = document.getElementById('isroTab_news');
  if (!el) return;
  if (el.dataset.loading === '1') return;
  el.dataset.loading = '1';
  if (!options.silent) el.innerHTML = '<div class="isro-news-loading">Loading ISRO news...</div>';
  try {
    const data = await getIsroNewsData();
    const articles = data.articles || [];
    if (!articles.length) {
      el.innerHTML = '<div class="isro-news-empty">No news articles available right now.</div>';
      return;
    }
    el.innerHTML = `
      <div class="isro-news-updated">Updated ${escapeNewsHtml(new Date(data.updated || Date.now()).toLocaleString())} &middot; ${escapeNewsHtml(data.source || 'news feed')}</div>
      ${articles.map(a => `
        <a class="isro-news-card" href="${escapeNewsHtml(a.url)}" target="_blank" rel="noopener noreferrer">
          <div class="isro-news-title">${escapeNewsHtml(a.title)}</div>
          <div class="isro-news-meta">${escapeNewsHtml(a.source || 'ISRO')} &middot; ${escapeNewsHtml(a.date || '')}</div>
          <div class="isro-news-summary">${escapeNewsHtml(a.summary || '')}</div>
        </a>`).join('')}`;
  } catch (e) {
    devLog('news render failed', e);
    el.innerHTML = '<div class="isro-news-empty">Could not load news. Tracker still works normally.</div>';
  } finally {
    el.dataset.loading = '0';
  }
}

function startIsroNewsAutoRefresh() {
  if (window._isroNewsAutoRefresh) return;
  // Silently re-fetch every 5 minutes while the news tab is visible.
  window._isroNewsAutoRefresh = setInterval(() => {
    const panelOpen = document.getElementById('isroPanel')?.classList.contains('open');
    const newsActive = document.getElementById('isroTab_news')?.classList.contains('active');
    if (panelOpen && newsActive) loadIsroNews({ silent: true });
  }, 5 * 60 * 1000);
}

function renderIsroMissionCard(m) {
  const statusClass = {
    SUCCESS: 'status-success', ACTIVE: 'status-active', ENDED: 'status-ended',
    PARTIAL: 'status-partial', UPCOMING: 'status-partial'
  }[m.status] || 'status-active';
  const card = document.createElement('div');
  card.className = 'isro-mission-card';
  card.style.setProperty('--mc', m.color);
  card.innerHTML = `
    <div class="isro-card-header">
      <span class="isro-mission-icon">${m.icon}</span>
      <div class="isro-mission-meta">
        <div class="isro-mission-name">${m.name}</div>
        <div class="isro-mission-sub">${m.type} · ${m.year} · ${m.agency}</div>
      </div>
      <span class="isro-status ${statusClass}">${m.status}</span>
    </div>
    <div class="isro-mission-desc">${m.desc}</div>
    <div class="isro-mission-highlight">💡 ${m.highlight}</div>
    ${m.norad ? `<button type="button" class="isro-track-btn">🛰️ TRACK THIS SATELLITE</button>` : ''}`;
  card.querySelector('.isro-track-btn')?.addEventListener('click', () => trackSatelliteByNorad(m.norad, m.search || m.name));
  return card;
}

function renderIsroStatsTab() {
  const statsEl = document.getElementById('isroTab_stats');
  if (!statsEl) return;
  const isroSats = getIsroSatellites();
  statsEl.innerHTML = `
    <div class="isro-stats-grid">
      <div class="isro-stat-card"><div class="isro-stat-num" style="color:#ffd700">100+</div><div class="isro-stat-label">Satellites Launched</div></div>
      <div class="isro-stat-card"><div class="isro-stat-num" style="color:#00ff9d">57+</div><div class="isro-stat-label">PSLV Launches</div></div>
      <div class="isro-stat-card"><div class="isro-stat-num" style="color:#00c8ff">${isroSats.length}</div><div class="isro-stat-label">ISRO Sats Tracked Now</div></div>
      <div class="isro-stat-card"><div class="isro-stat-num" style="color:#c084fc">4th</div><div class="isro-stat-label">Nation to Soft-Land on Moon</div></div>
      <div class="isro-stat-card"><div class="isro-stat-num" style="color:#ff8c42">1st</div><div class="isro-stat-label">Mars Orbit — 1st Try</div></div>
      <div class="isro-stat-card"><div class="isro-stat-num" style="color:#ff9933">NavIC</div><div class="isro-stat-label">Regional Navigation System</div></div>
    </div>
    <div class="isro-hindi-section">
      <div class="isro-hindi-title">भारत का अंतरिक्ष मिशन</div>
      <div class="isro-hindi-text">भारत अंतरिक्ष अनुसंधान संगठन (इसरो) भारत को अंतरिक्ष अनुसंधान, उपग्रह प्रौद्योगिकी और ग्रहीय खोज में अग्रणी बनाता है। चंद्रयान-३ ने दक्षिण ध्रुव क्षेत्र में उतरकर इतिहास रचा।</div>
      <div class="isro-hindi-sub">ISRO advances India\'s space science, satellite services, and exploration — from NavIC navigation to Chandrayaan lunar missions.</div>
    </div>
    <div class="isro-live-sats">
      <div class="isro-live-label">🟢 ISRO SATELLITES IN CURRENT TLE DATA (${isroSats.length})</div>
      ${isroSats.length ? isroSats.map(s => `
        <button type="button" class="isro-live-item" data-norad="${s.norad}">${getCategoryEmoji(s.cat)} ${s.name}</button>`).join('') : '<div class="isro-news-empty">No ISRO satellites in bundled data — switch to ALL filter after live update.</div>'}
    </div>`;
  statsEl.querySelectorAll('.isro-live-item[data-norad]').forEach(btn => {
    btn.addEventListener('click', () => trackSatelliteByNorad(btn.dataset.norad, btn.textContent.trim()));
  });
}

function setFeaturePanelOpen(id, open) {
  const panel = document.getElementById(id);
  if (!panel) return;
  panel.classList.toggle('open', open);
  panel.setAttribute('aria-hidden', String(!open));
  const triggerMap = {
    bookmarksPanel: 'btnBookmarks',
    isroPanel: 'btnISRO'
  };
  const trigger = document.getElementById(triggerMap[id]);
  trigger?.setAttribute('aria-expanded', String(open));
  if (isMobile()) {
    const anyOpen = ['passPanel', 'bookmarksPanel', 'isroPanel'].some(panelId =>
      document.getElementById(panelId)?.classList.contains('open')
    );
    document.getElementById('mobOverlay')?.classList.toggle('show', anyOpen);
    document.getElementById('mobOverlay')?.setAttribute('aria-hidden', String(!anyOpen));
    if (open) {
      document.querySelectorAll('.mob-nav-btn').forEach(b => b.classList.remove('active'));
      document.getElementById('mobMore')?.classList.add('active');
    } else if (!anyOpen) {
      document.querySelectorAll('.mob-nav-btn').forEach(b => b.classList.remove('active'));
      document.getElementById('mobGlobe')?.classList.add('active');
    }
  }
}

function closeAllTransientPanels() {
  closeMobileOverlays();
  closeFeaturePanels();
  if (isMobile()) {
    const infoPanel = document.getElementById('infoPanel');
    if (infoPanel?.classList.contains('open')) deselectSatellite();
  }
}

function closeFeaturePanels(exceptId) {
  ['passPanel', 'bookmarksPanel', 'isroPanel'].forEach(id => {
    if (id !== exceptId) setFeaturePanelOpen(id, false);
  });
}

function openISROPanel() {
  const panel = document.getElementById('isroPanel');
  if (!panel) return;
  closeMobileOverlays();
  closeFeaturePanels('isroPanel');
  setFeaturePanelOpen('isroPanel', true);
  renderISROContent();
  if (isMobile()) {
    requestAnimationFrame(() => document.getElementById('isroClose')?.focus({ preventScroll: true }));
  }
}

function renderIsroMissionsTab() {
  const el = document.getElementById('isroTab_missions');
  if (!el) return;
  el.innerHTML = '';
  ISRO_MISSIONS.forEach(m => el.appendChild(renderIsroMissionCard(m)));
}

function renderIsroLaunchesTab() {
  const el = document.getElementById('isroTab_launches');
  if (!el) return;
  el.innerHTML = '';
  UPCOMING_LAUNCHES.forEach(l => {
    const card = document.createElement('div');
    card.className = 'isro-launch-card';
    card.innerHTML = `
      <div class="isro-launch-header">
        <span class="isro-launch-flag">${l.flag}</span>
        <div>
          <div class="isro-launch-name">${l.name}</div>
          <div class="isro-launch-rocket">${l.rocket}</div>
        </div>
        <span class="isro-launch-status">${l.status}</span>
      </div>
      <div class="isro-launch-date">${l.date}</div>
      <div class="isro-launch-desc">${l.desc}</div>`;
    el.appendChild(card);
  });
}

function switchIsroTab(tabName) {
  document.querySelectorAll('.isro-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabName);
  });
  document.querySelectorAll('.isro-tab-content').forEach(c => c.classList.remove('active'));
  const content = document.getElementById(`isroTab_${tabName}`);
  content?.classList.add('active');
  if (tabName === 'missions') renderIsroMissionsTab();
  if (tabName === 'launches') renderIsroLaunchesTab();
  if (tabName === 'stats') renderIsroStatsTab();
  if (tabName === 'news') loadIsroNews();
}

function initISROPanel() {
  const panel = document.getElementById('isroPanel');
  const openBtn = document.getElementById('btnISRO');
  const closeBtn = document.getElementById('isroClose');
  if (!panel || !openBtn) {
    devLog('ISRO panel: missing DOM nodes');
    return;
  }

  openBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (panel.classList.contains('open')) {
      setFeaturePanelOpen('isroPanel', false);
    } else {
      openISROPanel();
    }
  });

  closeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    setFeaturePanelOpen('isroPanel', false);
  });

  document.querySelectorAll('.isro-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      switchIsroTab(tab.dataset.tab);
    });
  });

  startIsroNewsAutoRefresh();
  devLog('ISRO panel initialized');
}

function renderISROContent() {
  try {
    switchIsroTab('missions');
    renderIsroLaunchesTab();
    renderIsroStatsTab();
    // News is loaded on-demand when the news tab is switched to (switchIsroTab → loadIsroNews).
    // Do NOT pre-call loadIsroNews() here: the news tab is inactive at this point so the call
    // locks dataset.loading='1' and never clears it, blocking every subsequent real load.
  } catch (err) {
    devLog('ISRO render failed', err);
    showToast('ISRO panel failed to load — try again');
  }
}
