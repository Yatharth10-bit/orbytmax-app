(function () {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));

  const partCopy = {
    'Main satellite bus': ['The main structural body of the spacecraft.', 'Holds computers, wiring, tanks, batteries, and payload mounts together.', 'A strong bus keeps every subsystem aligned and protected during launch and orbit.'],
    'Solar panels': ['Deployable panels covered with solar cells.', 'Convert sunlight into electrical power for instruments, radios, computers, and heaters.', 'Most satellites must generate their own power for years without repair.'],
    Antennas: ['Radio structures shaped for sending and receiving signals.', 'Connect the satellite to ground stations and sometimes users on Earth.', 'Without antennas, a satellite cannot return data or receive commands.'],
    Sensors: ['Cameras, radiometers, radar units, or science detectors.', 'Measure Earth, space, the Moon, Mars, or the Sun depending on the mission.', 'Sensors turn orbit into useful knowledge.'],
    'Payload section': ['The mission-specific instrument bay.', 'Carries cameras, spectrometers, radar, astronomy instruments, or experiment packages.', 'Changing the payload changes what the satellite can discover or provide.'],
    'Communication module': ['Radios, transponders, and signal-processing electronics.', 'Receives, amplifies, routes, and transmits data or communication signals.', 'It lets satellites become relays, broadcasters, and data-return systems.'],
    'Power system': ['Batteries, regulators, and power-distribution electronics.', 'Stores solar energy and supplies stable voltage to every subsystem.', 'Power stability keeps instruments alive during eclipse and high-demand operations.'],
    'Propulsion system': ['Thrusters, tanks, valves, and control plumbing.', 'Changes orbit, controls attitude, or performs station-keeping.', 'Propulsion helps spacecraft reach mission orbits and stay useful longer.'],
    'Star tracker/navigation unit': ['Optical navigation sensors and attitude-reference equipment.', 'Recognizes star patterns or reference directions to determine spacecraft orientation.', 'Precise pointing is essential for imaging, communication, and science observations.'],
    'Thermal protection': ['Radiators, blankets, coatings, and heat-control surfaces.', 'Keeps spacecraft electronics and instruments within safe temperatures.', 'Spacecraft face intense sunlight, cold shadow, and limited ways to shed heat.'],
    'Radar antenna': ['A radar transmitter/receiver antenna, often large or panel-like.', 'Sends microwave pulses to Earth and measures echoes.', 'Radar imaging can work at night and through clouds.'],
    'Navigation unit': ['Precise clocks and navigation signal electronics.', 'Generates timing and navigation signals for receivers on Earth.', 'Navigation satellites depend on stable timing to calculate position accurately.'],
    'Data handling unit': ['Onboard computing and storage for mission data.', 'Collects instrument data, formats telemetry, and queues data for downlink.', 'It keeps the mission organized when data cannot be transmitted immediately.'],
    'Dish antenna': ['A curved high-gain communication reflector.', 'Focuses radio energy into a tight beam for long-distance links.', 'Deep-space and GEO missions need focused signals to reach ground stations clearly.'],
    'Science telescope': ['An optical or high-energy observing tube.', 'Keeps detectors aligned with a narrow view of the target.', 'A stable telescope structure improves scientific measurements.'],
    'Engine nozzle': ['The visible outlet of a thruster or apogee motor.', 'Accelerates propellant to change orbit or orientation.', 'Mission lifetime often depends on careful propulsion use.']
  };

  const modelCatalog = {
    'geo-comms': { path: 'models/satellites/generic/geostationary-comms.glb', fallback: 'procedural-geo-comms' },
    'earth-observer': { path: 'models/satellites/generic/earth-observer.glb', fallback: 'procedural-earth-observer' },
    'imaging-sat': { path: 'models/satellites/generic/imaging-satellite.glb', fallback: 'procedural-imager' },
    'radar-sat': { path: 'models/satellites/generic/radar-sar.glb', fallback: 'procedural-radar' },
    'navigation-sat': { path: 'models/satellites/generic/navigation-satellite.glb', fallback: 'procedural-navigation' },
    'science-observatory': { path: 'models/satellites/generic/space-observatory.glb', fallback: 'procedural-observatory' },
    'lunar-orbiter': { path: 'models/satellites/generic/lunar-orbiter.glb', fallback: 'procedural-lunar' },
    'planetary-orbiter': { path: 'models/satellites/generic/planetary-orbiter.glb', fallback: 'procedural-planetary' },
    'solar-observatory': { path: 'models/satellites/generic/solar-observatory.glb', fallback: 'procedural-solar' },
    'propulsion-module': { path: 'models/satellites/generic/propulsion-module.glb', fallback: 'procedural-propulsion' },
    'faceted-science': { path: 'models/satellites/generic/faceted-science-probe.glb', fallback: 'procedural-science-probe' },
    'compact-test': { path: 'models/satellites/generic/compact-test-satellite.glb', fallback: 'procedural-compact' }
  };

  const edu = {
    satellites: [],
    selected: null,
    part: 'Main satellite bus',
    scene: null,
    camera: null,
    renderer: null,
    group: null,
    meshes: [],
    raycaster: null,
    mouse: null,
    dragging: false,
    panning: false,
    lastX: 0,
    lastY: 0,
    ready3d: false
  };

  function initEducationSection() {
    const root = document.getElementById('isroEducation');
    if (!root) return;
    const heading = document.getElementById('educationTitle');
    if (heading) heading.tabIndex = -1;
    edu.satellites = Array.isArray(window.ISRO_EDUCATION_SATELLITES) ? window.ISRO_EDUCATION_SATELLITES : [];
    document.getElementById('btnEducation')?.addEventListener('click', () => {
      root.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
      window.setTimeout(() => heading?.focus({ preventScroll: true }), reducedMotion ? 0 : 450);
    });
    document.getElementById('eduReturnTop')?.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
      window.setTimeout(() => document.getElementById('btnEducation')?.focus({ preventScroll: true }), reducedMotion ? 0 : 450);
    });
    document.getElementById('eduSearch')?.addEventListener('input', renderList);
    document.getElementById('eduFilter')?.addEventListener('change', renderList);
    document.getElementById('eduShowAllParts')?.addEventListener('click', showAllParts);
    document.getElementById('eduResetCamera')?.addEventListener('click', resetCamera);
    document.getElementById('eduFullscreen')?.addEventListener('click', () => document.getElementById('eduViewerWrap')?.requestFullscreen?.());
    const modeObserver = new IntersectionObserver(entries => {
      const visible = entries.some(entry => entry.isIntersecting && entry.intersectionRatio > 0.12);
      document.body.classList.toggle('education-mode', visible);
    }, { threshold: [0, 0.12, 0.5] });
    modeObserver.observe(root);
    renderList();
    if (edu.satellites[0]) selectSatellite(edu.satellites[0].id);
  }

  function renderList() {
    const list = document.getElementById('eduSatelliteList');
    if (!list) return;
    const q = (document.getElementById('eduSearch')?.value || '').trim().toLowerCase();
    const f = document.getElementById('eduFilter')?.value || 'all';
    const sats = edu.satellites.filter(s => {
      const haystack = `${s.name} ${s.missionType} ${s.orbitType} ${s.purpose}`.toLowerCase();
      return (!q || haystack.includes(q)) && (f === 'all' || String(s.missionType || '').includes(f) || String(s.orbitType || '').includes(f));
    });
    list.innerHTML = sats.length ? sats.map(s => `
      <button type="button" class="edu-card ${edu.selected?.id === s.id ? 'active' : ''}" data-edu-id="${esc(s.id)}" aria-label="Inspect ${esc(s.name)}">
        <span class="edu-card-name">${esc(s.name)}</span>
        <span class="edu-card-meta">${esc(s.missionType)} · ${esc(s.orbitType)}</span>
      </button>`).join('') : '<div class="edu-info-empty">No matching ISRO missions.</div>';
    list.querySelectorAll('[data-edu-id]').forEach(btn => btn.addEventListener('click', () => selectSatellite(btn.dataset.eduId)));
  }

  function selectSatellite(id) {
    const sat = edu.satellites.find(item => item.id === id);
    if (!sat) return;
    edu.selected = sat;
    edu.part = sat.components?.[0] || 'Main satellite bus';
    document.getElementById('eduSelectedName').textContent = sat.name;
    renderList();
    renderParts();
    renderInfo();
    if (hasExternalModel(sat)) {
      renderExternalModel(sat);
    } else {
      hideExternalModel();
      ensure3d();
      buildModel(sat);
    }
  }

  function renderParts() {
    const el = document.getElementById('eduPartList');
    if (!el || !edu.selected) return;
    const parts = edu.selected.components?.length ? edu.selected.components : Object.keys(partCopy).slice(0, 6);
    el.innerHTML = parts.map(part => `<button type="button" class="edu-part-btn ${part === edu.part ? 'active' : ''}" data-part="${esc(part)}">${esc(part)}</button>`).join('');
    el.querySelectorAll('[data-part]').forEach(btn => btn.addEventListener('click', () => selectPart(btn.dataset.part)));
  }

  function selectPart(part) {
    edu.part = part;
    edu.meshes.forEach(mesh => {
      const selected = mesh.userData.partName === part;
      if (mesh.material?.emissive) mesh.material.emissive.set(selected ? 0x553000 : 0x000000);
      if (mesh.material) mesh.material.opacity = selected ? 1 : 0.48;
    });
    renderParts();
    renderHotspots();
    renderInfo();
  }

  function showAllParts() {
    edu.part = 'All parts';
    edu.meshes.forEach(mesh => {
      if (mesh.material?.emissive) mesh.material.emissive.set(0x000000);
      if (mesh.material) mesh.material.opacity = 0.9;
    });
    renderParts();
    renderHotspots();
    renderInfo();
  }

  function hasExternalModel(sat) {
    return sat?.externalModel?.provider === 'sketchfab' && sat.externalModel.uid;
  }

  function getSketchfabEmbedUrl(model) {
    const params = new URLSearchParams({
      autostart: '1',
      preload: '1',
      ui_infos: '0',
      ui_stop: '0',
      ui_watermark: '1',
      transparent: '1'
    });
    return `https://sketchfab.com/models/${encodeURIComponent(model.uid)}/embed?${params.toString()}`;
  }

  function renderExternalModel(sat) {
    const wrap = document.getElementById('eduViewerWrap');
    const canvas = document.getElementById('eduModelCanvas');
    const hint = wrap?.querySelector('.edu-hotspot-hint');
    if (!wrap || !canvas || !hasExternalModel(sat)) return;

    if (edu.group) {
      while (edu.group.children.length) edu.group.remove(edu.group.children[0]);
      edu.meshes = [];
    }
    wrap.querySelectorAll('.edu-hotspot-btn').forEach(btn => btn.remove());
    document.getElementById('eduWebglFallback')?.setAttribute('hidden', '');
    canvas.hidden = true;

    let external = wrap.querySelector('.edu-external-model');
    if (!external) {
      external = document.createElement('div');
      external.className = 'edu-external-model';
      wrap.insertBefore(external, wrap.firstChild);
    }

    const model = sat.externalModel;
    external.innerHTML = `
      <iframe
        title="${esc(model.title || sat.name)} interactive 3D model"
        src="${esc(getSketchfabEmbedUrl(model))}"
        allow="autoplay; fullscreen; xr-spatial-tracking"
        allowfullscreen
        mozallowfullscreen="true"
        webkitallowfullscreen="true"></iframe>
      <div class="edu-model-credit">
        <span>Real model: ${esc(model.title || sat.name)} by ${esc(model.author || 'Sketchfab creator')}</span>
        <a href="${esc(model.url)}" target="_blank" rel="noopener">Open source model</a>
      </div>`;

    if (hint) hint.textContent = 'Sketchfab model · Drag to rotate · Scroll/pinch to zoom · Use viewer controls';
    renderHotspots();
  }

  function hideExternalModel() {
    const wrap = document.getElementById('eduViewerWrap');
    const canvas = document.getElementById('eduModelCanvas');
    const hint = wrap?.querySelector('.edu-hotspot-hint');
    wrap?.querySelector('.edu-external-model')?.remove();
    if (canvas) canvas.hidden = false;
    if (hint) hint.textContent = 'Drag to rotate · Shift-drag to pan · Scroll to zoom';
  }

  function renderInfo() {
    const el = document.getElementById('eduInfoPanel');
    const sat = edu.selected;
    if (!el || !sat) return;
    const part = partCopy[edu.part] || partCopy['Main satellite bus'];
    const allParts = edu.part === 'All parts';
    const model = sat.externalModel;
    el.innerHTML = `
      <h3>${esc(sat.name)}</h3>
      <p>${esc(sat.detailedDescription)}</p>
      ${model ? `<p class="edu-model-source"><strong>3D model:</strong> ${esc(model.title)} by ${esc(model.author)}. ${esc(model.note || '')}</p>` : ''}
      <div class="edu-facts">
        <div class="edu-fact"><span>LAUNCH</span><strong>${esc(sat.launchDate)}</strong></div>
        <div class="edu-fact"><span>VEHICLE</span><strong>${esc(sat.launchVehicle)}</strong></div>
        <div class="edu-fact"><span>ORBIT</span><strong>${esc(sat.orbitType)}</strong></div>
        <div class="edu-fact"><span>STATUS</span><strong>${esc(sat.status)}</strong></div>
      </div>
      <p><strong>Purpose:</strong> ${esc(sat.purpose)}</p>
      <div class="edu-chip-row">${(sat.keyAchievements || []).map(x => `<span class="edu-chip">${esc(x)}</span>`).join('')}</div>
      <p><strong>Instruments:</strong> ${esc((sat.instruments || []).join(', '))}</p>
      <div class="edu-part-detail">
        <h4>${esc(edu.part)}</h4>
        ${allParts
          ? `<p><strong>Visible components:</strong> ${esc((sat.components || []).join(', '))}</p><p>Use the part buttons or canvas hotspots to isolate a subsystem.</p>`
          : `<p><strong>What it is:</strong> ${esc(part[0])}</p><p><strong>What it does:</strong> ${esc(part[1])}</p><p><strong>Why it matters:</strong> ${esc(part[2])}</p>`}
      </div>
      <p><strong>Fun fact:</strong> ${esc((sat.funFacts || [])[0] || '')}</p>`;
  }

  function webglAvailable() {
    try {
      const c = document.createElement('canvas');
      return !!(c.getContext('webgl') || c.getContext('experimental-webgl'));
    } catch (_) {
      return false;
    }
  }

  function ensure3d() {
    if (edu.ready3d) return;
    const canvas = document.getElementById('eduModelCanvas');
    if (!canvas || !window.THREE || !webglAvailable()) {
      document.getElementById('eduWebglFallback')?.removeAttribute('hidden');
      return;
    }
    edu.scene = new THREE.Scene();
    edu.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    edu.camera.position.set(0, 0.7, 5);
    edu.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    edu.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    edu.raycaster = new THREE.Raycaster();
    edu.mouse = new THREE.Vector2();
    edu.group = new THREE.Group();
    edu.scene.add(edu.group);
    edu.scene.add(new THREE.AmbientLight(0x8fbfff, 0.8));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(3, 3, 4);
    edu.scene.add(key);
    const rim = new THREE.DirectionalLight(0xff9933, 0.7);
    rim.position.set(-4, 1, -3);
    edu.scene.add(rim);
    canvas.addEventListener('pointerdown', e => {
      edu.dragging = true;
      edu.panning = e.shiftKey || e.button === 1 || e.button === 2;
      edu.lastX = e.clientX;
      edu.lastY = e.clientY;
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('pointerup', () => { edu.dragging = false; edu.panning = false; });
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('click', onModelClick);
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      edu.camera.position.z = Math.min(8, Math.max(2.4, edu.camera.position.z + e.deltaY * 0.004));
    }, { passive: false });
    window.addEventListener('resize', resizeViewer);
    edu.ready3d = true;
    resizeViewer();
    animate();
  }

  function resizeViewer() {
    if (!edu.renderer) return;
    const rect = document.getElementById('eduViewerWrap').getBoundingClientRect();
    const w = Math.max(320, rect.width);
    const h = Math.max(420, rect.height);
    edu.camera.aspect = w / h;
    edu.camera.updateProjectionMatrix();
    edu.renderer.setSize(w, h, false);
  }

  function resetCamera() {
    if (!edu.camera || !edu.group) return;
    edu.camera.position.set(0, 0.7, 5);
    edu.group.position.set(0, 0, 0);
    edu.group.rotation.set(0.2, -0.4, 0);
  }

  function mat(color, options = {}) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: options.roughness ?? 0.42,
      metalness: options.metalness ?? 0.28,
      transparent: true,
      opacity: options.opacity ?? 0.9
    });
  }

  function addPart(name, geometry, material, position, scale, rotation = [0, 0, 0]) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position[0], position[1], position[2]);
    mesh.scale.set(scale[0], scale[1], scale[2]);
    mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    mesh.userData.partName = name;
    edu.group.add(mesh);
    edu.meshes.push(mesh);
    return mesh;
  }

  function hasComponent(sat, name) {
    return (sat.components || []).includes(name);
  }

  function addSolarWing(x, z = 0) {
    addPart('Solar panels', new THREE.BoxGeometry(1, 0.055, 0.62), mat(0x00c8ff, { metalness: 0.12 }), [x, 0, z], [1.45, 1, 1]);
    [-0.42, 0, 0.42].forEach(offset => {
      addPart('Solar panels', new THREE.BoxGeometry(0.035, 0.07, 0.68), mat(0x72e0ff, { opacity: 0.7 }), [x + Math.sign(x) * offset, 0.005, z], [1, 1, 1]);
    });
  }

  function addDish(name, position, scale, rotation = [Math.PI / 2, 0, 0]) {
    addPart(name, new THREE.CylinderGeometry(0.42, 0.16, 0.12, 48, 1, true), mat(0xf0f4ff, { metalness: 0.55 }), position, scale, rotation);
    addPart(name, new THREE.CylinderGeometry(0.035, 0.035, 0.55, 18), mat(0xffb347), [position[0], position[1] - 0.18, position[2]], [1, 1, 1], [0, 0, 0]);
  }

  function addBoom(name, position, scale, rotation) {
    addPart(name, new THREE.CylinderGeometry(0.035, 0.035, 1.15, 16), mat(0x9aa8ba, { metalness: 0.5 }), position, scale, rotation);
  }

  function renderHotspots() {
    const wrap = document.getElementById('eduViewerWrap');
    if (!wrap || !edu.selected) return;
    wrap.querySelectorAll('.edu-hotspot-btn').forEach(btn => btn.remove());
    if (hasExternalModel(edu.selected)) return;
    const positions = [
      ['Main satellite bus', '50%', '48%'],
      ['Solar panels', '20%', '42%'],
      ['Antennas', '55%', '20%'],
      ['Dish antenna', '68%', '28%'],
      ['Sensors', '60%', '56%'],
      ['Payload section', '44%', '63%'],
      ['Radar antenna', '50%', '72%'],
      ['Propulsion system', '50%', '82%'],
      ['Engine nozzle', '50%', '84%'],
      ['Science telescope', '56%', '38%'],
      ['Navigation unit', '63%', '46%'],
      ['Communication module', '58%', '60%'],
      ['Power system', '40%', '68%'],
      ['Thermal protection', '38%', '52%'],
      ['Star tracker/navigation unit', '62%', '40%'],
      ['Data handling unit', '42%', '36%']
    ];
    const available = new Set(['Main satellite bus', ...edu.meshes.map(mesh => mesh.userData.partName)]);
    positions.filter(([name]) => available.has(name)).slice(0, 7).forEach(([name, left, top]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `edu-hotspot-btn ${edu.part === name ? 'active' : ''}`;
      btn.style.left = left;
      btn.style.top = top;
      btn.textContent = name;
      btn.setAttribute('aria-label', `Inspect ${name}`);
      btn.addEventListener('click', () => selectPart(name));
      wrap.appendChild(btn);
    });
  }

  function buildModel(sat) {
    if (!edu.group || !window.THREE) return;
    while (edu.group.children.length) edu.group.remove(edu.group.children[0]);
    edu.meshes = [];
    const modelType = sat.modelIdentifier || 'earth-observer';
    const modelMeta = modelCatalog[modelType] || modelCatalog['earth-observer'];
    sat.modelPath = modelMeta.path;
    sat.modelFallback = modelMeta.fallback;

    const faceted = modelType.includes('faceted') || modelType.includes('compact');
    const busGeo = faceted ? new THREE.DodecahedronGeometry(0.78, 0) : new THREE.BoxGeometry(1.25, 0.92, 1);
    addPart('Main satellite bus', busGeo, mat(0x8fbfff, { metalness: 0.42 }), [0, 0, 0], [1, modelType === 'navigation-sat' ? 0.9 : 1, 1]);

    if (hasComponent(sat, 'Solar panels')) {
      if (modelType === 'solar-observatory') {
        addSolarWing(-1.35, 0.18);
        addSolarWing(1.35, 0.18);
        addSolarWing(-1.35, -0.52);
        addSolarWing(1.35, -0.52);
      } else {
        addSolarWing(-1.55);
        addSolarWing(1.55);
      }
    }

    if (hasComponent(sat, 'Antennas')) {
      addPart('Antennas', new THREE.ConeGeometry(0.16, 0.62, 24), mat(0xffb347), [0, 0.83, 0.18], [1, 1, 1]);
      addBoom('Antennas', [-0.48, 0.72, 0], [1, 0.7, 1], [0, 0, Math.PI / 2]);
    }

    if (hasComponent(sat, 'Communication module')) {
      addPart('Communication module', new THREE.CylinderGeometry(0.27, 0.27, 0.2, 32), mat(0x1b2a44, { metalness: 0.2 }), [0, -0.18, 0.68], [1, 1, 1], [Math.PI / 2, 0, 0]);
      addDish('Dish antenna', [0.58, 0.25, 0.72], [0.72, 0.72, 0.72]);
    }

    if (hasComponent(sat, 'Power system')) {
      addPart('Power system', new THREE.BoxGeometry(0.42, 0.24, 0.28), mat(0x00ff9d, { metalness: 0.1 }), [0.38, -0.42, 0.62], [1, 1, 1]);
    }

    if (hasComponent(sat, 'Radar antenna')) {
      addPart('Radar antenna', new THREE.BoxGeometry(1.55, 0.1, 0.72), mat(0xb58cff, { metalness: 0.18 }), [0, -0.86, 0.1], [1, 1, 1]);
      addPart('Radar antenna', new THREE.BoxGeometry(1.45, 0.035, 0.08), mat(0xffffff, { opacity: 0.6 }), [0, -0.8, 0.1], [1, 1, 1]);
    }

    if (hasComponent(sat, 'Propulsion system')) {
      addPart('Propulsion system', new THREE.CylinderGeometry(0.24, 0.32, 0.28, 32), mat(0x9aa8ba, { metalness: 0.5 }), [0, -0.74, 0], [1, 1, 1]);
      addPart('Engine nozzle', new THREE.ConeGeometry(0.28, 0.52, 32), mat(0xffb347), [0, -1.08, 0], [1, 1, 1], [Math.PI, 0, 0]);
    }

    if (hasComponent(sat, 'Navigation unit')) {
      addPart('Navigation unit', new THREE.SphereGeometry(0.22, 24, 16), mat(0xffffff, { metalness: 0.15 }), [-0.35, 0.34, 0.63], [1, 1, 1]);
      addPart('Navigation unit', new THREE.TorusGeometry(0.32, 0.035, 12, 36), mat(0xffe28a, { metalness: 0.45 }), [0.3, 0.36, 0.63], [1, 1, 1], [Math.PI / 2, 0, 0]);
    } else if (hasComponent(sat, 'Star tracker/navigation unit')) {
      addPart('Star tracker/navigation unit', new THREE.CylinderGeometry(0.18, 0.18, 0.22, 24), mat(0xffffff), [-0.35, 0.34, 0.63], [1, 1, 1], [Math.PI / 2, 0, 0]);
    } else if (hasComponent(sat, 'Sensors')) {
      addPart('Sensors', new THREE.SphereGeometry(0.22, 24, 16), mat(0xffffff), [-0.35, 0.34, 0.63], [1, 1, 1]);
    }

    if (hasComponent(sat, 'Payload section')) {
      const payloadName = modelType === 'science-observatory' || modelType === 'solar-observatory' ? 'Science telescope' : 'Payload section';
      const payloadGeo = payloadName === 'Science telescope'
        ? new THREE.CylinderGeometry(0.25, 0.31, 0.92, 36)
        : new THREE.CylinderGeometry(0.34, 0.34, 0.5, 32);
      addPart(payloadName, payloadGeo, mat(0xff6b35, { metalness: 0.3 }), [0, 0.34, -0.62], [1, 1, 1], [Math.PI / 2, 0, 0]);
      addPart('Payload section', new THREE.CylinderGeometry(0.17, 0.17, 0.12, 24), mat(0x0b1020), [0, 0.34, -1.08], [1, 1, 1], [Math.PI / 2, 0, 0]);
    }

    if (hasComponent(sat, 'Data handling unit')) {
      addPart('Data handling unit', new THREE.BoxGeometry(0.34, 0.28, 0.22), mat(0x7fd5ff, { metalness: 0.1 }), [-0.42, -0.34, 0.62], [1, 1, 1]);
    }

    if (hasComponent(sat, 'Thermal protection') || modelType === 'solar-observatory') {
      addPart('Thermal protection', new THREE.BoxGeometry(1.34, 1.06, 0.045), mat(0xd6d1ba, { roughness: 0.75, metalness: 0.08 }), [0, 0, -0.53], [1, 1, 1]);
    }

    if (modelType.includes('lunar') || modelType.includes('planetary')) {
      addDish('Dish antenna', [-0.54, 0.38, 0.55], [0.64, 0.64, 0.64], [Math.PI / 2, 0.35, 0]);
    }

    edu.group.rotation.set(0.2, -0.4, 0);
    selectPart(edu.part);
  }

  function onPointerMove(e) {
    if (!edu.dragging || !edu.group) return;
    const dx = e.clientX - edu.lastX;
    const dy = e.clientY - edu.lastY;
    if (edu.panning || e.shiftKey) {
      edu.group.position.x += dx * 0.006;
      edu.group.position.y -= dy * 0.006;
    } else {
      edu.group.rotation.y += dx * 0.008;
      edu.group.rotation.x += dy * 0.006;
    }
    edu.lastX = e.clientX;
    edu.lastY = e.clientY;
  }

  function onModelClick(e) {
    if (!edu.raycaster || !edu.camera || !edu.renderer) return;
    const rect = edu.renderer.domElement.getBoundingClientRect();
    edu.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    edu.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    edu.raycaster.setFromCamera(edu.mouse, edu.camera);
    const hit = edu.raycaster.intersectObjects(edu.meshes, false)[0];
    if (hit?.object?.userData?.partName) selectPart(hit.object.userData.partName);
  }

  function animate() {
    requestAnimationFrame(animate);
    if (!edu.renderer || !edu.scene || !edu.camera) return;
    if (!edu.dragging && edu.group && !reducedMotion) edu.group.rotation.y += 0.002;
    edu.renderer.render(edu.scene, edu.camera);
  }

  window.initEducationSection = initEducationSection;
})();
