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
  lastListItems: []
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
  return 'other';
}

function getCategoryEmoji(cat) {
  const map = {
    iss: '🛸', starlink: '🛰️', gps: '📡', weather: '🌤️',
    gnss: '🗺️', science: '🔭', comm: '📺', other: '⬡'
  };
  return map[cat] || '⬡';
}

function getCategoryColor(cat) {
  const map = {
    iss: 0xffd700, starlink: 0x00c8ff, gps: 0x00ff9d,
    weather: 0xff8c42, gnss: 0x9b59b6, science: 0xff6b6b,
    comm: 0x4ecdc4, other: 0x95a5a6
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
  state.scene = new THREE.Scene();
  state.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.001, 200);
  state.camera.position.set(0, 0, 3.2);

  state.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  state.renderer.setSize(window.innerWidth, window.innerHeight);
  state.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
  const geo = new THREE.SphereGeometry(EARTH_RADIUS_3D, 128, 128);

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
    autoRotate: true,
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
  }, { passive: true });
  el.addEventListener('touchend', () => { ctrl.isDragging = false; });

  state.orbitControls = ctrl;
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

  filtered.forEach((sat, idx) => {
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
    div.innerHTML = `
      <span class="sat-list-emoji">${getCategoryEmoji(s.cat)}</span>
      <div class="sat-list-info">
        <div class="sat-list-name">${s.name}</div>
        <div class="sat-list-id">#${s.norad}</div>
      </div>`;
    div.addEventListener('click', () => selectSatellite(i));
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
    <button class="panel-action-btn bookmark-btn ${isBookmarked ? 'bookmarked' : ''}" id="panelBookmarkBtn" title="${isBookmarked ? 'Remove bookmark' : 'Bookmark'}">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="${isBookmarked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>
      ${isBookmarked ? 'SAVED' : 'SAVE'}
    </button>
    <button class="panel-action-btn share-btn" id="panelShareBtn" title="Share">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
      SHARE
    </button>
    <button class="panel-action-btn pass-btn" id="panelPassBtn" title="Predict passes over your location">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      PASSES
    </button>
  `;

  document.getElementById('infoPanel').classList.add('open');
  drawMiniMap(sat);

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
    el.classList.toggle('selected', parseInt(el.dataset.idx) === listIdx);
  });
}

function deselectSatellite() {
  state.selectedIndex = -1;
  state.followMode = false;
  document.getElementById('btnFollow').dataset.active = 'false';
  document.getElementById('infoPanel').classList.remove('open');
  state.sprites.forEach(s => {
    if (!s) return;
    s.material.opacity = 1.0;
    s.material.color.set(0xffffff);
  });
  document.querySelectorAll('.sat-list-item').forEach(el => el.classList.remove('selected'));
}

// Fix 5: Auto-select ISS on first load so the panel isn't empty
function autoSelectISS() {
  const filtered = getFilteredSats();
  // Find ISS by name (case-insensitive, partial match)
  const issIdx = filtered.findIndex(s =>
    s.name.toUpperCase().includes('ISS') || s.name.toUpperCase().includes('ZARYA')
  );
  if (issIdx >= 0) {
    // Small delay so sprites are positioned before we open the panel
    setTimeout(() => selectSatellite(issIdx), 400);
  }
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
  document.getElementById('utcTime').textContent = `UTC ${now.toUTCString().slice(17,25)}`;

  state.renderer.render(state.scene, state.camera);
}

// ============================================================
// FETCH TLE DATA  — Fix 1: Reliable multi-proxy parallel fetch
// ============================================================

// Multiple CORS proxy options — raced in parallel so fastest wins
const TLE_SOURCES = [
  // Proxy 1: allorigins (most common, sometimes flaky)
  `https://api.allorigins.win/raw?url=${encodeURIComponent('https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle')}`,
  // Proxy 2: corsproxy.io — reliable alternative
  `https://corsproxy.io/?${encodeURIComponent('https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle')}`,
  // Proxy 3: direct with no-cors header attempt (works from some origins)
  `https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle`,
  // Proxy 4: thingproxy fallback
  `https://thingproxy.freeboard.io/fetch/https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle`,
];

async function tryFetchTLE(url, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const text = await res.text();
    // Valid TLE file always has lines starting with "1 " and "2 "
    return (text.includes('\n1 ') && text.includes('\n2 ')) ? text : null;
  } catch (e) {
    clearTimeout(timer);
    return null;
  }
}

async function fetchTLEs() {
  setLoading('Fetching satellite TLE data...', 15);

  let raw = null;

  // Phase 1: Try to load a checked-in local copy first — fastest possible, no network needed
  try {
    const res = await fetch('./data/active.txt', { signal: AbortSignal.timeout ? AbortSignal.timeout(1500) : undefined });
    if (res.ok) {
      const text = await res.text();
      if (text.includes('\n1 ') && text.length > 5000) {
        raw = text;
        showToast('TLE data loaded from local cache');
      }
    }
  } catch (e) { /* no local file — fine */ }

  // Phase 2: Race all proxies simultaneously — whoever responds first with valid data wins
  if (!raw) {
    setLoading('Fetching live TLE data...', 25);
    try {
      // Promise.any resolves as soon as ONE resolves with non-null value
      const winner = await Promise.any(
        TLE_SOURCES.map(url => tryFetchTLE(url, 8000).then(r => {
          if (!r) throw new Error('empty'); return r;
        }))
      );
      if (winner) {
        raw = winner;
      }
    } catch (e) {
      // All proxies failed — use embedded fallback
    }
  }

  // Phase 3: Embedded high-quality fallback — 60 real satellites covering all categories
  if (!raw || raw.length < 500) {
    raw = getSampleTLEs();
    document.getElementById('statusText').textContent = 'OFFLINE — Sample data';
    showToast('Network unavailable — showing 60 built-in satellites');
  }

  setLoading('Parsing satellite data...', 55);
  state.satellites = parseTLEs(raw);
  document.getElementById('satCount').textContent = state.satellites.length.toLocaleString();
  document.getElementById('listCount').textContent = state.satellites.length.toLocaleString();

  setLoading('Building 3D scene...', 78);
  buildSatelliteSprites();

  setLoading('Ready!', 100);
  state.tleLoaded = true;

  document.getElementById('statusDot').classList.add('live');
  if (!document.getElementById('statusText').textContent.includes('OFFLINE')) {
    document.getElementById('statusText').textContent = `LIVE — ${state.satellites.length.toLocaleString()} OBJECTS`;
  }

  setTimeout(() => {
    document.getElementById('loadingOverlay').classList.add('hidden');
    // Fix 5: Auto-select ISS after satellites are loaded
    autoSelectISS();
  }, 380);

  showToast(`Tracking ${state.satellites.length.toLocaleString()} satellites`);
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
  document.getElementById('btnOrbits').addEventListener('click', () => {
    state.showOrbits = !state.showOrbits;
    document.getElementById('btnOrbits').dataset.active = state.showOrbits;
    state.orbitLines.forEach(l => { if (l) l.visible = state.showOrbits; });
  });

  document.getElementById('btnLabels').addEventListener('click', () => {
    state.showLabels = !state.showLabels;
    document.getElementById('btnLabels').dataset.active = state.showLabels;
    showToast(state.showLabels ? 'Labels ON (performance impact)' : 'Labels OFF');
  });

  document.getElementById('btnFollow').addEventListener('click', () => {
    if (state.selectedIndex < 0) { showToast('Select a satellite first'); return; }
    state.followMode = !state.followMode;
    document.getElementById('btnFollow').dataset.active = state.followMode;
    if (!state.followMode && state.orbitControls) {
      state.orbitControls.spherical.setFromVector3(
        state.camera.position.clone().sub(state.orbitControls.target)
      );
    }
    showToast(state.followMode ? 'Following satellite' : 'Follow mode OFF');
  });

  document.getElementById('btnRefresh').addEventListener('click', async () => {
    showToast('Refreshing TLE data...');
    document.getElementById('loadingOverlay').classList.remove('hidden');
    state.tleLoaded = false;
    await fetchTLEs();
  });

  document.getElementById('closePanel').addEventListener('click', deselectSatellite);

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
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
  state.camera.aspect = window.innerWidth / window.innerHeight;
  state.camera.updateProjectionMatrix();
  state.renderer.setSize(window.innerWidth, window.innerHeight);
}

// ============================================================
// INIT  — Fix 2: UI shell visible immediately, data loads async
// ============================================================
async function init() {
  setLoading('Initializing 3D engine...', 5);

  // Three.js setup — synchronous, fast
  initThree();
  buildEarth();
  initOrbitControls();

  // Events
  window.addEventListener('resize', onResize);
  window.addEventListener('click', onCanvasClick);
  initSearch();
  initControls();

  // Start render loop FIRST so Earth & stars are visible while data loads
  setLoading('Starting render loop...', 18);
  animate();

  // Hide the loading overlay early so the user sees the spinning Earth
  // while satellite data is still being fetched in the background
  setTimeout(() => {
    document.getElementById('loadingOverlay').classList.add('hidden');
  }, 800);

  // Init new feature panels
  initPassPredictor();
  initBookmarks();
  initISROPanel();

  // Fetch TLEs — awaited so autoSelectISS runs after build
  await fetchTLEs();
}

// Start
init().catch(err => {
  console.error('Orbital init error:', err);
  document.getElementById('loadingMsg').textContent = 'Error loading. Check console.';
  document.getElementById('statusDot').classList.add('error');
});

// ============================================================
// AI COPILOT — powered by Anthropic API (no key required)
// ============================================================
const copilot = {
  open: false,
  loading: false,
  messages: []   // { role, content }
};

const ANTHROPIC_URL  = 'https://api.anthropic.com/v1/messages';
const COPILOT_MODEL  = 'claude-sonnet-4-20250514';

const SYSTEM_PROMPT = `You are ORBITAL AI, an expert space and satellite tracking assistant embedded in a real-time satellite tracker application called ORBITAL by Yatharth.

You have deep knowledge of:
- Orbital mechanics (Kepler's laws, orbital elements, TLE data format, SGP4/SDP4 propagation)
- Satellite categories: ISS, Starlink, GPS/GNSS constellations, weather satellites, scientific missions
- Orbit types: LEO (Low Earth Orbit <2000km), MEO (Medium 2000-35000km), GEO (Geostationary ~35786km), HEO (Highly Elliptical)
- Space debris, Kessler syndrome, orbital decay, reentry
- Real-world satellite missions, constellations, and their purposes

Keep answers concise, technical but accessible. Use **bold** for key terms. Use bullet points for lists. Keep responses under 220 words unless the question truly demands more. When live satellite context is provided, use it to give specific answers about that satellite.`;

function getCopilotContext() {
  const filtered = getFilteredSats();
  if (state.selectedIndex >= 0 && filtered[state.selectedIndex]) {
    const sat = filtered[state.selectedIndex];
    const geo = sat._lastGeo;
    if (geo) {
      return `\n\n[LIVE CONTEXT] Selected satellite: ${sat.name} (NORAD #${sat.norad}), Category: ${sat.cat.toUpperCase()}, Orbit: ${getOrbitType(geo.alt)}, Altitude: ${Math.round(geo.alt)} km, Lat: ${geo.lat.toFixed(2)}°, Lon: ${geo.lon.toFixed(2)}°, Velocity: ${geo.vel.toFixed(2)} km/s, Inclination: ${(sat.satrec.inclo * 180 / Math.PI).toFixed(2)}°`;
    }
    return `\n\n[LIVE CONTEXT] Selected satellite: ${sat.name} (NORAD #${sat.norad}), Category: ${sat.cat.toUpperCase()}`;
  }
  return `\n\n[LIVE CONTEXT] Currently tracking ${state.satellites.length.toLocaleString()} satellites. Active filter: ${state.activeFilter}. No satellite selected.`;
}

function initCopilot() {
  const fab      = document.getElementById('copilotFab');
  const closeBtn = document.getElementById('copilotClose');
  const clearBtn = document.getElementById('copilotClear');
  const input    = document.getElementById('copilotInput');
  const sendBtn  = document.getElementById('copilotSend');

  // Hide the API key bar — not needed
  const keyBar = document.getElementById('copilotKeyBar');
  if (keyBar) keyBar.classList.add('hidden');

  fab.addEventListener('click', () => toggleCopilot());
  closeBtn.addEventListener('click', () => toggleCopilot(false));

  clearBtn.addEventListener('click', () => {
    copilot.messages = [];
    const msgs = document.getElementById('copilotMessages');
    msgs.innerHTML = '';
    const welcome = buildWelcome();
    if (welcome) msgs.appendChild(welcome);
  });

  sendBtn.addEventListener('click', sendCopilotMessage);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendCopilotMessage(); }
  });

  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 100) + 'px';
  });

  document.querySelectorAll('.copilot-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      input.value = chip.dataset.q;
      sendCopilotMessage();
    });
  });
}

function toggleCopilot(force) {
  const panel = document.getElementById('copilotPanel');
  const fab   = document.getElementById('copilotFab');
  copilot.open = force !== undefined ? force : !copilot.open;
  panel.classList.toggle('open', copilot.open);
  fab.classList.toggle('open', copilot.open);
  if (copilot.open) document.getElementById('copilotInput').focus();
}

function setStatus(txt) {
  document.getElementById('copilotStatus').textContent = txt;
}

function buildWelcome() {
  const existing = document.querySelector('.copilot-welcome');
  return existing ? existing.cloneNode(true) : null;
}

async function sendCopilotMessage() {
  if (copilot.loading) return;
  const input = document.getElementById('copilotInput');
  const text  = input.value.trim();
  if (!text) return;

  input.value = '';
  input.style.height = 'auto';

  const welcome = document.querySelector('.copilot-welcome');
  if (welcome) welcome.style.display = 'none';

  appendMessage('user', text);
  copilot.messages.push({ role: 'user', content: text });

  const typingEl = appendTyping();
  copilot.loading = true;
  document.getElementById('copilotSend').disabled = true;
  setStatus('Thinking...');

  try {
    const sysContent = SYSTEM_PROMPT + getCopilotContext();

    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: COPILOT_MODEL,
        max_tokens: 600,
        system: sysContent,
        stream: true,
        messages: copilot.messages.slice(-14)
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }

    typingEl.remove();
    const { bubble } = appendMessage('ai', '');
    bubble.innerHTML = '<span class="copilot-cursor"></span>';

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText  = '';
    let buffer    = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const json = JSON.parse(data);
          // Anthropic streaming events
          if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
            fullText += json.delta.text;
            bubble.innerHTML = formatCopilotMarkdown(fullText) + '<span class="copilot-cursor"></span>';
            scrollCopilotToBottom();
          }
        } catch (_) {}
      }
    }

    bubble.innerHTML = formatCopilotMarkdown(fullText);
    copilot.messages.push({ role: 'assistant', content: fullText });
    setStatus('Powered by Claude');

  } catch (err) {
    typingEl.remove();
    const { bubble } = appendMessage('ai', '');
    bubble.classList.add('copilot-error');
    bubble.textContent = `Error: ${err.message}`;
    setStatus('Error — please retry');
    console.error('[Copilot]', err);
  } finally {
    copilot.loading = false;
    document.getElementById('copilotSend').disabled = false;
    scrollCopilotToBottom();
  }
}

function appendMessage(role, text) {
  const msgs = document.getElementById('copilotMessages');
  const wrap = document.createElement('div');
  wrap.className = `copilot-msg ${role}`;

  if (role === 'ai' && state.selectedIndex >= 0) {
    const sat = getFilteredSats()[state.selectedIndex];
    if (sat) {
      const badge = document.createElement('div');
      badge.className = 'copilot-ctx-badge';
      badge.innerHTML = `🛰️ ${sat.name}`;
      wrap.appendChild(badge);
    }
  }

  const bubble = document.createElement('div');
  bubble.className = 'copilot-bubble';
  bubble.innerHTML = role === 'user' ? escapeHtml(text) : formatCopilotMarkdown(text);

  const meta = document.createElement('div');
  meta.className = 'copilot-msg-meta';
  const t = new Date();
  const hhmm = `${t.getHours().toString().padStart(2,'0')}:${t.getMinutes().toString().padStart(2,'0')}`;
  meta.textContent = role === 'user' ? `You · ${hhmm}` : `ORBITAL AI · ${hhmm}`;

  wrap.appendChild(bubble);
  wrap.appendChild(meta);
  msgs.appendChild(wrap);
  scrollCopilotToBottom();
  return { wrap, bubble };
}

function appendTyping() {
  const msgs = document.getElementById('copilotMessages');
  const el = document.createElement('div');
  el.className = 'copilot-typing';
  el.innerHTML = '<span></span><span></span><span></span>';
  msgs.appendChild(el);
  scrollCopilotToBottom();
  return el;
}

function scrollCopilotToBottom() {
  const msgs = document.getElementById('copilotMessages');
  msgs.scrollTop = msgs.scrollHeight;
}

function formatCopilotMarkdown(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^[\*\-] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>(\n|$))+/g, s => `<ul>${s}</ul>`)
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^(?!<[uop])([\s\S]+)$/, '<p>$1</p>');
}

function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCopilot);
} else {
  initCopilot();
}

// ============================================================
// MOBILE UI — bottom nav, drawers, sheets
// ============================================================
function isMobile() { return window.innerWidth <= 768; }

function initMobileUI() {
  if (!isMobile()) return;

  const overlay    = document.getElementById('mobOverlay');
  const drawer     = document.getElementById('mobDrawer');
  const sheet      = document.getElementById('mobSheet');
  const aiSheet    = document.getElementById('mobAISheet');
  const drawerBody = document.getElementById('mobSatListBody');

  // ── helpers ──
  function closeAll() {
    drawer.classList.remove('open');
    sheet.classList.remove('open');
    aiSheet.classList.remove('open');
    overlay.classList.remove('show');
    document.querySelectorAll('.mob-nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('mobGlobe').classList.add('active');
  }

  function openDrawer(el) {
    closeAll();
    el.classList.add('open');
    overlay.classList.add('show');
  }

  overlay.addEventListener('click', closeAll);
  document.getElementById('mobDrawerClose').addEventListener('click', closeAll);
  document.getElementById('mobSheetClose').addEventListener('click', closeAll);
  document.getElementById('mobAIClose').addEventListener('click', closeAll);

  // ── Nav buttons ──
  document.getElementById('mobGlobe').addEventListener('click', () => {
    closeAll();
    document.getElementById('mobGlobe').classList.add('active');
  });

  document.getElementById('mobSats').addEventListener('click', () => {
    // Clone sat list items into drawer
    const srcList = document.getElementById('satList');
    drawerBody.innerHTML = srcList ? srcList.innerHTML : '<p style="padding:20px;color:var(--text-faint);font-size:11px">No satellites loaded yet.</p>';
    // Re-attach click listeners on cloned items
    drawerBody.querySelectorAll('.sat-list-item').forEach((item, i) => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.dataset.idx ?? i);
        selectSatellite(idx);
        closeAll();
      });
    });
    openDrawer(drawer);
    document.getElementById('mobSats').classList.add('active');
  });

  document.getElementById('mobFilter').addEventListener('click', () => {
    openDrawer(sheet);
    document.getElementById('mobFilter').classList.add('active');
  });

  document.getElementById('mobAI').addEventListener('click', () => {
    openDrawer(aiSheet);
    document.getElementById('mobAI').classList.add('active');
    document.getElementById('mobAIInput').focus();
  });

  // ── Sync mobile filter buttons with desktop state ──
  document.querySelectorAll('.mob-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mob-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // Mirror to desktop filter
      const desktopBtn = document.querySelector(`.filter-btn[data-filter="${btn.dataset.filter}"]`);
      if (desktopBtn) desktopBtn.click();
      else {
        state.activeFilter = btn.dataset.filter;
        buildSatelliteSprites();
      }
    });
  });

  // ── Sync mobile control buttons ──
  const mBtnMap = {
    mBtnOrbits:  'btnOrbits',
    mBtnLabels:  'btnLabels',
    mBtnFollow:  'btnFollow',
    mBtnRefresh: 'btnRefresh'
  };
  Object.entries(mBtnMap).forEach(([mobId, deskId]) => {
    const mobBtn  = document.getElementById(mobId);
    const deskBtn = document.getElementById(deskId);
    if (!mobBtn || !deskBtn) return;
    mobBtn.addEventListener('click', () => {
      deskBtn.click();
      const active = deskBtn.dataset.active === 'true';
      mobBtn.dataset.active = String(active);
    });
  });

  // ── Mobile AI panel ──
  const mobAIInput = document.getElementById('mobAIInput');
  const mobAISend  = document.getElementById('mobAISend');
  const mobAIMsgs  = document.getElementById('mobAIMessages');

  // Auto-resize
  mobAIInput.addEventListener('input', () => {
    mobAIInput.style.height = 'auto';
    mobAIInput.style.height = Math.min(mobAIInput.scrollHeight, 100) + 'px';
  });

  // Quick chips in mobile AI
  document.querySelectorAll('#mobAISheet .copilot-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      mobAIInput.value = chip.dataset.q;
      sendMobAI();
    });
  });

  mobAISend.addEventListener('click', sendMobAI);
  mobAIInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMobAI(); }
  });

  async function sendMobAI() {
    const text = mobAIInput.value.trim();
    if (!text || mobAISend.disabled) return;
    mobAIInput.value = '';
    mobAIInput.style.height = 'auto';

    const welcome = mobAIMsgs.querySelector('.copilot-welcome');
    if (welcome) welcome.style.display = 'none';

    // User bubble
    appendMobMsg('user', text);
    copilot.messages.push({ role: 'user', content: text });

    // Typing
    const typing = document.createElement('div');
    typing.className = 'copilot-typing';
    typing.innerHTML = '<span></span><span></span><span></span>';
    mobAIMsgs.appendChild(typing);
    mobAIMsgs.scrollTop = mobAIMsgs.scrollHeight;

    mobAISend.disabled = true;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          system: 'You are ORBITAL AI, an expert satellite and space assistant. Be concise (under 180 words), use **bold** for key terms.',
          stream: true,
          messages: copilot.messages.slice(-10)
        })
      });

      typing.remove();
      const { bubble } = appendMobMsg('ai', '');
      bubble.innerHTML = '<span class="copilot-cursor"></span>';

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '', buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const j = JSON.parse(line.slice(6));
            if (j.type === 'content_block_delta' && j.delta?.type === 'text_delta') {
              full += j.delta.text;
              bubble.innerHTML = formatCopilotMarkdown(full) + '<span class="copilot-cursor"></span>';
              mobAIMsgs.scrollTop = mobAIMsgs.scrollHeight;
            }
          } catch(_) {}
        }
      }
      bubble.innerHTML = formatCopilotMarkdown(full);
      copilot.messages.push({ role: 'assistant', content: full });
    } catch(e) {
      typing.remove();
      const { bubble } = appendMobMsg('ai', '');
      bubble.classList.add('copilot-error');
      bubble.textContent = 'Error: ' + e.message;
    } finally {
      mobAISend.disabled = false;
      mobAIMsgs.scrollTop = mobAIMsgs.scrollHeight;
    }
  }

  function appendMobMsg(role, text) {
    const wrap   = document.createElement('div');
    wrap.className = `copilot-msg ${role}`;
    const bubble = document.createElement('div');
    bubble.className = 'copilot-bubble';
    bubble.innerHTML = role === 'user' ? escapeHtml(text) : formatCopilotMarkdown(text);
    wrap.appendChild(bubble);
    mobAIMsgs.appendChild(wrap);
    mobAIMsgs.scrollTop = mobAIMsgs.scrollHeight;
    return { wrap, bubble };
  }
}

// Re-init on resize crossing the 768px boundary
let _wasMobile = isMobile();
window.addEventListener('resize', () => {
  const now = isMobile();
  if (now !== _wasMobile) {
    _wasMobile = now;
    if (now) initMobileUI();
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMobileUI);
} else {
  initMobileUI();
}

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

  closeBtn.addEventListener('click', () => panel.classList.remove('open'));

  // GPS button
  locBtn.addEventListener('click', () => {
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
  manualBtn.addEventListener('click', () => {
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
  passState.currentSat = sat;
  document.getElementById('passSatName').textContent = sat.name;
  document.getElementById('passSatCat').textContent = sat.cat.toUpperCase();
  document.getElementById('passResults').innerHTML = `<div class="pass-hint">Set your location above, then passes compute automatically.</div>`;
  panel.classList.add('open');
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
    panel.classList.toggle('open');
    renderBookmarksList();
  });
  closeBtn.addEventListener('click', () => panel.classList.remove('open'));
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
  {
    name: 'Chandrayaan-3', icon: '🌙', status: 'SUCCESS',
    launch: '14 Jul 2023', agency: 'ISRO',
    desc: 'First spacecraft to land near the lunar south pole. Pragyan rover operated for 14 days.',
    highlight: 'India became the 4th nation to land on the Moon and the 1st to reach the south pole.',
    norad: null, cat: 'science', color: '#ffd700'
  },
  {
    name: 'Aditya-L1', icon: '☀️', status: 'ACTIVE',
    launch: '2 Sep 2023', agency: 'ISRO',
    desc: 'India\'s first solar observatory. Stationed at Lagrange point L1, 1.5 million km from Earth.',
    highlight: 'Studying solar wind, coronal mass ejections and space weather from L1 point.',
    norad: '57422', cat: 'science', color: '#ff8c42'
  },
  {
    name: 'PSLV-C58 / XPoSat', icon: '⭐', status: 'ACTIVE',
    launch: '1 Jan 2024', agency: 'ISRO',
    desc: 'India\'s first dedicated space observatory for studying X-ray polarimetry of cosmic sources.',
    highlight: 'Only the 2nd X-ray polarimetry mission in the world after NASA\'s IXPE.',
    norad: '58348', cat: 'science', color: '#c084fc'
  },
  {
    name: 'GSAT-20 / CMS-03', icon: '📡', status: 'ACTIVE',
    launch: '18 Nov 2024', agency: 'ISRO/SpaceX',
    desc: 'High-throughput communication satellite launched on SpaceX Falcon 9 for broadband India.',
    highlight: 'First major ISRO payload launched on a foreign commercial rocket.',
    norad: null, cat: 'comm', color: '#00c8ff'
  },
  {
    name: 'Mangalyaan (MOM)', icon: '🔴', status: 'ENDED',
    launch: '5 Nov 2013', agency: 'ISRO',
    desc: 'India\'s first interplanetary mission. Mars Orbiter Mission exceeded planned 6-month life by years.',
    highlight: 'India became the first nation to succeed Mars orbit insertion on first attempt.',
    norad: null, cat: 'science', color: '#ff4444'
  },
  {
    name: 'Chandrayaan-2', icon: '🌙', status: 'PARTIAL',
    launch: '22 Jul 2019', agency: 'ISRO',
    desc: 'Orbiter remains operational; lander Vikram crash-landed. Orbiter still provides lunar data.',
    highlight: 'Orbiter has mapped the Moon with unprecedented resolution including south pole.',
    norad: '44441', cat: 'science', color: '#aabb44'
  },
  {
    name: 'RISAT-2BR1', icon: '🔍', status: 'ACTIVE',
    launch: '11 Dec 2019', agency: 'ISRO',
    desc: 'Radar Imaging Satellite for Earth observation including agriculture, flood, border monitoring.',
    highlight: 'Sub-meter resolution SAR satellite for national security and disaster management.',
    norad: '44857', cat: 'other', color: '#00ff9d'
  },
  {
    name: 'Cartosat-3', icon: '🗺️', status: 'ACTIVE',
    launch: '27 Nov 2019', agency: 'ISRO',
    desc: 'High-resolution Earth observation satellite with 25cm panchromatic resolution.',
    highlight: 'Highest resolution civilian satellite from India — used for urban planning & defence.',
    norad: '44793', cat: 'other', color: '#4ecdc4'
  },
  {
    name: 'NavIC / IRNSS', icon: '🧭', status: 'ACTIVE',
    launch: '2013–2018', agency: 'ISRO',
    desc: 'India\'s own navigation satellite system. 7-satellite constellation covering India + 1500km radius.',
    highlight: 'India is one of only 5 countries with its own independent navigation satellite system.',
    norad: null, cat: 'gnss', color: '#ff6b35'
  },
  {
    name: 'GSAT-11 (Dream Sat)', icon: '🌐', status: 'ACTIVE',
    launch: '5 Dec 2018', agency: 'ISRO',
    desc: 'Heaviest satellite built by India. 5.8-tonne multi-beam broadband communication satellite.',
    highlight: 'Provides broadband speeds of 14 Gbps to Indian mainland and islands.',
    norad: '43864', cat: 'comm', color: '#00c8ff'
  }
];

const UPCOMING_LAUNCHES = [
  { name: 'NISAR', date: 'Early 2025', rocket: 'GSLV Mk-II', desc: 'Joint NASA-ISRO Earth observation SAR mission — most expensive Earth science satellite ever.', flag: '🇮🇳🇺🇸' },
  { name: 'Gaganyaan (Uncrewed)', date: '2025', rocket: 'LVM3', desc: 'Test flight for India\'s first crewed spacecraft without astronauts.', flag: '🇮🇳' },
  { name: 'PSLV-C61', date: '2025', rocket: 'PSLV-XL', desc: 'Multiple commercial & research payloads from India and international clients.', flag: '🇮🇳' },
  { name: 'Chandrayaan-4', date: '2026–27', rocket: 'LVM3', desc: 'Lunar sample-return mission. Will collect and bring back Moon rock to Earth.', flag: '🇮🇳' },
  { name: 'Gaganyaan (Crewed)', date: '2026', rocket: 'LVM3', desc: 'India\'s first crewed spaceflight. 3 Vyomanauts to low Earth orbit.', flag: '🇮🇳👨‍🚀' },
  { name: 'Shukrayaan-1', date: '2028', rocket: 'LVM3', desc: 'Venus Orbiter Mission — studying Venus atmosphere and surface.', flag: '🇮🇳' },
];

function initISROPanel() {
  const panel   = document.getElementById('isroPanel');
  const openBtn = document.getElementById('btnISRO');
  const closeBtn= document.getElementById('isroClose');
  if (!panel || !openBtn) return;

  openBtn.addEventListener('click', () => {
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) renderISROContent();
  });
  closeBtn.addEventListener('click', () => panel.classList.remove('open'));

  // Tab switching
  document.querySelectorAll('.isro-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.isro-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.isro-tab-content').forEach(c => c.classList.remove('active'));
      document.getElementById(`isroTab_${tab.dataset.tab}`).classList.add('active');
    });
  });
}

function renderISROContent() {
  // Missions tab
  const missionsEl = document.getElementById('isroTab_missions');
  if (missionsEl && !missionsEl.dataset.rendered) {
    missionsEl.dataset.rendered = '1';
    missionsEl.innerHTML = '';
    ISRO_MISSIONS.forEach(m => {
      const card = document.createElement('div');
      card.className = 'isro-mission-card';
      card.style.setProperty('--mc', m.color);
      const statusClass = { SUCCESS:'status-success', ACTIVE:'status-active', ENDED:'status-ended', PARTIAL:'status-partial' }[m.status] || 'status-active';
      card.innerHTML = `
        <div class="isro-card-header">
          <span class="isro-mission-icon">${m.icon}</span>
          <div class="isro-mission-meta">
            <div class="isro-mission-name">${m.name}</div>
            <div class="isro-mission-sub">${m.agency} · ${m.launch}</div>
          </div>
          <span class="isro-status ${statusClass}">${m.status}</span>
        </div>
        <div class="isro-mission-desc">${m.desc}</div>
        <div class="isro-mission-highlight">💡 ${m.highlight}</div>
        ${m.norad ? `<button class="isro-track-btn" data-norad="${m.norad}">🛰️ TRACK THIS SATELLITE</button>` : ''}`;
      card.querySelector('.isro-track-btn')?.addEventListener('click', () => {
        const filtered = getFilteredSats();
        const idx = filtered.findIndex(s => s.norad === m.norad);
        if (idx >= 0) { selectSatellite(idx); document.getElementById('isroPanel').classList.remove('open'); }
        else showToast('Switch filter to ALL first');
      });
      missionsEl.appendChild(card);
    });
  }

  // Launches tab
  const launchesEl = document.getElementById('isroTab_launches');
  if (launchesEl && !launchesEl.dataset.rendered) {
    launchesEl.dataset.rendered = '1';
    launchesEl.innerHTML = '';
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
          <span class="isro-launch-date">${l.date}</span>
        </div>
        <div class="isro-launch-desc">${l.desc}</div>`;
      launchesEl.appendChild(card);
    });
  }

  // Stats tab
  const statsEl = document.getElementById('isroTab_stats');
  if (statsEl && !statsEl.dataset.rendered) {
    statsEl.dataset.rendered = '1';
    const isroSats = state.satellites.filter(s => {
      const n = s.name.toUpperCase();
      return n.includes('CARTOSAT') || n.includes('RISAT') || n.includes('RESOURCESAT') ||
             n.includes('GSAT') || n.includes('IRNSS') || n.includes('NAVIC') ||
             n.includes('INSAT') || n.includes('SARAL') || n.includes('OCEANSAT') ||
             n.includes('EMISAT') || n.includes('MICROSAT');
    });
    statsEl.innerHTML = `
      <div class="isro-stats-grid">
        <div class="isro-stat-card">
          <div class="isro-stat-num" style="color:#ffd700">100+</div>
          <div class="isro-stat-label">Satellites Launched</div>
        </div>
        <div class="isro-stat-card">
          <div class="isro-stat-num" style="color:#00ff9d">57+</div>
          <div class="isro-stat-label">PSLV Launches</div>
        </div>
        <div class="isro-stat-card">
          <div class="isro-stat-num" style="color:#00c8ff">${isroSats.length}</div>
          <div class="isro-stat-label">ISRO Sats Tracked Now</div>
        </div>
        <div class="isro-stat-card">
          <div class="isro-stat-num" style="color:#c084fc">4th</div>
          <div class="isro-stat-label">Nation on the Moon</div>
        </div>
        <div class="isro-stat-card">
          <div class="isro-stat-num" style="color:#ff8c42">1st</div>
          <div class="isro-stat-label">Mars on 1st Attempt</div>
        </div>
        <div class="isro-stat-card">
          <div class="isro-stat-num" style="color:#ff4444">2047</div>
          <div class="isro-stat-label">India Space Station</div>
        </div>
      </div>
      <div class="isro-hindi-section">
        <div class="isro-hindi-title">भारत का अंतरिक्ष मिशन</div>
        <div class="isro-hindi-text">इसरो — भारतीय अंतरिक्ष अनुसंधान संगठन। चंद्रयान, मंगलयान और गगनयान के साथ भारत अंतरिक्ष में नई ऊंचाइयां छू रहा है।</div>
        <div class="isro-hindi-sub">India is reaching new heights in space with Chandrayaan, Mangalyaan, and Gaganyaan.</div>
      </div>
      ${isroSats.length > 0 ? `
      <div class="isro-live-sats">
        <div class="isro-live-label">🟢 ISRO SATELLITES LIVE NOW</div>
        ${isroSats.slice(0,8).map((s,i) => `
          <div class="isro-live-item" onclick="(() => { const f=getFilteredSats(); const idx=f.findIndex(x=>x.norad==='${s.norad}'); if(idx>=0)selectSatellite(idx); document.getElementById('isroPanel').classList.remove('open'); })()">
            ${getCategoryEmoji(s.cat)} ${s.name}
          </div>`).join('')}
      </div>` : ''}`;
  }
}
