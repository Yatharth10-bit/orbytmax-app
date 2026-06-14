(function () {
  'use strict';

  const STORE_ALERTS = 'orbital_alert_preferences_v1';
  const passState = { lat: null, lon: null, place: '', filter: 'all', passes: [], countdownTimer: null };
  const data = { satellites: [], models: [], education: null, selectedAlert: null };

  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  const degToRad = deg => deg * Math.PI / 180;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));

  document.addEventListener('DOMContentLoaded', initDiscovery);

  async function initDiscovery() {
    try {
      const [satellites, models, education] = await Promise.all([
        fetchJson('/data/satellite-registry.json', []),
        fetchJson('/data/model-registry.json', []),
        fetchJson('/data/education-content.json', null)
      ]);
      data.satellites = satellites;
      data.models = models;
      data.education = education;
      renderDirectory();
      renderEducationMode();
      renderAlerts();
      bindDiscoveryEvents();
      initPlatformModeObserver();
      initSectionTransitions();
      initRevealCards();
      window.ORBITAL_DISCOVERY = {
        setSkyLocation,
        getAlerts,
        openAlertModal,
        renderAlerts
      };
      updateActiveNav();
      window.addEventListener('hashchange', updateActiveNav);
      window.addEventListener('scroll', updateActiveNav, { passive: true });
      if (location.hash === '#sky-tonight') maybeUseStoredLocation();
    } catch (err) {
      console.warn('Discovery features failed to initialize', err);
    }
  }

  async function fetchJson(url, fallback) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`status ${res.status}`);
      return await res.json();
    } catch (_) {
      return fallback;
    }
  }

  function bindDiscoveryEvents() {
    $('#skyUseLocation')?.addEventListener('click', requestSkyLocation);
    $('#skyManualToggle')?.addEventListener('click', () => {
      const form = $('#skyManualForm');
      if (form) form.hidden = !form.hidden;
    });
    $('#skyManualForm')?.addEventListener('submit', event => {
      event.preventDefault();
      const lat = Number($('#skyLat')?.value);
      const lon = Number($('#skyLon')?.value);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        setSkyStatus('Enter a valid latitude and longitude.');
        return;
      }
      setSkyLocation(lat, lon, $('#skyPlace')?.value || 'Manual location');
    });
    $$('.sky-filter').forEach(btn => btn.addEventListener('click', () => {
      $$('.sky-filter').forEach(item => item.classList.remove('active'));
      btn.classList.add('active');
      passState.filter = btn.dataset.skyFilter || 'all';
      renderPasses();
    }));
    $('#requestNotifyPermission')?.addEventListener('click', requestNotificationPermission);
    $('#alertModalClose')?.addEventListener('click', closeAlertModal);
    $('#saveAlertPreference')?.addEventListener('click', saveAlertFromModal);
    $('#downloadAlertIcs')?.addEventListener('click', () => {
      if (data.selectedAlert) downloadIcsForSatellite(data.selectedAlert);
    });
    document.addEventListener('click', event => {
      const followBtn = event.target.closest('[data-follow-id]');
      if (followBtn) openAlertModal(followBtn.dataset.followId);
      const removeBtn = event.target.closest('[data-alert-remove]');
      if (removeBtn) removeAlert(removeBtn.dataset.alertRemove);
      const icsBtn = event.target.closest('[data-alert-ics]');
      if (icsBtn) downloadIcsForSatellite(icsBtn.dataset.alertIcs);
    });
  }

  function initSectionTransitions() {
    const links = $$('a[href^="#"]');
    links.forEach(link => {
      const targetId = link.getAttribute('href')?.slice(1);
      if (!targetId || !document.getElementById(targetId)) return;
      link.addEventListener('click', event => {
        event.preventDefault();
        const rect = link.getBoundingClientRect();
        const flash = $('#pageTransitionFlash');
        if (flash) {
          flash.style.setProperty('--x', `${rect.left + rect.width / 2}px`);
          flash.style.setProperty('--y', `${rect.top + rect.height / 2}px`);
        }
        document.body.classList.add('is-transitioning');
        const target = document.getElementById(targetId);
        target?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
        history.replaceState(null, '', `#${targetId}`);
        updateActiveNav();
        window.setTimeout(() => document.body.classList.remove('is-transitioning'), prefersReducedMotion() ? 120 : 520);
      });
    });
  }

  function initRevealCards() {
    const selector = '.sky-pass-card, .directory-card, .alert-card, .alerts-empty, .edu-mode-card, .timeline-card';
    const apply = () => {
      const cards = $$(selector).filter(card => !card.classList.contains('reveal-card'));
      cards.forEach(card => card.classList.add('reveal-card'));
      if (!('IntersectionObserver' in window) || prefersReducedMotion()) {
        cards.forEach(card => card.classList.add('is-visible'));
        return;
      }
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12 });
      cards.forEach(card => observer.observe(card));
    };
    apply();
    const platformRoot = document.querySelector('.platform-hub')?.parentElement || document.body;
    new MutationObserver(apply).observe(platformRoot, { childList: true, subtree: true });
  }

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function initPlatformModeObserver() {
    const sections = $$('.platform-hub, .education-section');
    if (!sections.length) return;
    const updateByScroll = () => {
      const firstPlatformTop = sections[0].getBoundingClientRect().top + window.scrollY;
      const start = firstPlatformTop - window.innerHeight * 0.82;
      const end = firstPlatformTop - window.innerHeight * 0.18;
      const progress = Math.max(0, Math.min(1, (window.scrollY - start) / Math.max(1, end - start)));
      document.documentElement.style.setProperty('--feed-exit-progress', progress.toFixed(3));
      document.body.classList.toggle('platform-mode', progress > 0.96);
    };
    updateByScroll();
    window.addEventListener('scroll', updateByScroll, { passive: true });
    window.addEventListener('resize', updateByScroll, { passive: true });
  }

  function maybeUseStoredLocation() {
    const saved = localStorage.getItem('orbital_last_location');
    if (!saved) return;
    try {
      const loc = JSON.parse(saved);
      if (Number.isFinite(loc.lat) && Number.isFinite(loc.lon)) {
        setSkyLocation(loc.lat, loc.lon, loc.place || 'Saved location');
      }
    } catch (_) {}
  }

  function requestSkyLocation() {
    if (!navigator.geolocation) {
      $('#skyManualForm')?.removeAttribute('hidden');
      setSkyStatus('Geolocation is not available. Enter your location manually.');
      return;
    }
    setSkyStatus('Requesting location permission...');
    clearPassList();
    navigator.geolocation.getCurrentPosition(position => {
      setSkyLocation(position.coords.latitude, position.coords.longitude, 'Your location');
    }, () => {
      $('#skyManualForm')?.removeAttribute('hidden');
      setSkyStatus('Location permission was denied. Enter your location manually.');
      renderPasses();
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 30 * 60 * 1000 });
  }

  function setSkyLocation(lat, lon, place) {
    passState.lat = lat;
    passState.lon = lon;
    passState.place = place;
    localStorage.setItem('orbital_last_location', JSON.stringify({ lat, lon, place }));
    setSkyStatus(`Calculating visible passes for ${place}...`);
    clearPassList();
    calculateVisiblePasses().catch(err => {
      setSkyStatus(`Could not calculate passes: ${err.message}`);
      renderPasses();
    });
  }

  function setSkyStatus(text) {
    const el = $('#skyStatus');
    if (el) el.textContent = text;
  }

  function renderPassSkeletons() {
    const list = $('#skyPassList');
    if (!list) return;
    list.innerHTML = '';
  }

  function clearPassList() {
    renderPassSkeletons();
  }

  async function calculateVisiblePasses() {
    if (!window.satellite) throw new Error('satellite.js is not loaded');
    const tleRaw = await fetch('/api/satellites?refresh=1').then(res => res.text());
    const records = parseTles(tleRaw);
    const candidates = records.filter(record => isUsefulSkyCandidate(record)).slice(0, 48);
    const now = new Date();
    const start = new Date(now);
    if (start.getHours() < 17) start.setHours(18, 0, 0, 0);
    const end = new Date(start.getTime() + 12 * 60 * 60 * 1000);
    const observer = {
      longitude: degToRad(passState.lon),
      latitude: degToRad(passState.lat),
      height: 0
    };
    const passes = [];
    candidates.forEach(record => {
      const satrec = satellite.twoline2satrec(record.tle1, record.tle2);
      const samples = [];
      for (let t = start.getTime(); t <= end.getTime(); t += 2 * 60 * 1000) {
        const date = new Date(t);
        const posVel = satellite.propagate(satrec, date);
        if (!posVel?.position) continue;
        const gmst = satellite.gstime(date);
        const ecf = satellite.eciToEcf(posVel.position, gmst);
        const look = satellite.ecfToLookAngles(observer, ecf);
        const elevation = satellite.radiansToDegrees(look.elevation);
        const azimuth = (satellite.radiansToDegrees(look.azimuth) + 360) % 360;
        samples.push({ date, elevation, azimuth });
      }
      collectPasses(record, samples).forEach(pass => passes.push(pass));
    });
    passState.passes = passes
      .filter(pass => pass.maxElevation >= 12)
      .sort((a, b) => b.score - a.score || a.startTime - b.startTime)
      .slice(0, 18);
    setSkyStatus(passState.passes.length
      ? `${passState.passes.length} estimated visible passes near ${passState.place}.`
      : `No strong visible passes found near ${passState.place} tonight.`);
    renderPasses();
  }

  function parseTles(raw) {
    const lines = String(raw || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const out = [];
    for (let i = 0; i < lines.length - 2; i++) {
      if (lines[i + 1]?.startsWith('1 ') && lines[i + 2]?.startsWith('2 ')) {
        const name = lines[i].replace(/^0 /, '');
        out.push({ name, tle1: lines[i + 1], tle2: lines[i + 2], noradId: lines[i + 2].slice(2, 7).trim() });
        i += 2;
      }
    }
    return out;
  }

  function isUsefulSkyCandidate(record) {
    const n = record.name.toUpperCase();
    return /ISS|HUBBLE|STARLINK|ONEWEB|NOAA|METOP|LANDSAT|SENTINEL|CARTOSAT|RESOURCESAT|RISAT|GSAT|INSAT|NAVIC|IRNSS|OCEANSAT|ASTROSAT|ADITYA|CHANDRAYAAN|MANGALYAAN|TERRA|AQUA|IRIDIUM/.test(n);
  }

  function collectPasses(record, samples) {
    const groups = [];
    let active = [];
    samples.forEach(sample => {
      if (sample.elevation >= 10) active.push(sample);
      else if (active.length) {
        if (active.length >= 2) groups.push(active);
        active = [];
      }
    });
    if (active.length >= 2) groups.push(active);
    return groups.map(group => {
      const peak = group.reduce((best, item) => item.elevation > best.elevation ? item : best, group[0]);
      const quality = qualityFor(record.name, peak.elevation);
      const estimate = brightnessEstimate(record.name, peak.elevation);
      return {
        satelliteId: matchSatelliteId(record),
        name: record.name,
        startTime: group[0].date,
        peakTime: peak.date,
        endTime: group[group.length - 1].date,
        directionStart: compass(group[0].azimuth),
        directionEnd: compass(group[group.length - 1].azimuth),
        maxElevation: Math.round(peak.elevation),
        brightnessEstimate: estimate,
        visibilityQuality: quality.label,
        score: quality.score,
        filterTags: tagsFor(record.name)
      };
    });
  }

  function matchSatelliteId(record) {
    const byNorad = data.satellites.find(sat => String(sat.noradId) === String(record.noradId));
    if (byNorad) return byNorad.id;
    const slug = record.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return slug || record.noradId || record.name;
  }

  function tagsFor(name) {
    const n = name.toUpperCase();
    const tags = ['all'];
    if (n.includes('ISS')) tags.push('iss');
    if (n.includes('STARLINK')) tags.push('starlink');
    if (/GSAT|INSAT|CARTOSAT|RISAT|NAVIC|IRNSS|IRS|OCEANSAT|ASTROSAT|ADITYA|CHANDRAYAAN|MANGALYAAN/.test(n)) tags.push('isro');
    if (/ISS|HUBBLE|STARLINK|IRIDIUM/.test(n)) tags.push('brightest');
    return tags;
  }

  function qualityFor(name, elevation) {
    const brightBonus = /ISS|HUBBLE|STARLINK|IRIDIUM/i.test(name) ? 10 : 0;
    const score = elevation + brightBonus;
    if (score >= 70) return { label: 'Excellent', score };
    if (score >= 45) return { label: 'Good', score };
    if (score >= 25) return { label: 'Fair', score };
    return { label: 'Poor', score };
  }

  function brightnessEstimate(name, elevation) {
    const bright = /ISS/i.test(name) ? 'very bright' : /STARLINK|IRIDIUM|HUBBLE/i.test(name) ? 'bright' : elevation > 55 ? 'moderate' : 'faint';
    return `${bright} estimate`;
  }

  function compass(deg) {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return dirs[Math.round(deg / 45) % 8];
  }

  function renderPasses() {
    const list = $('#skyPassList');
    if (!list) return;
    const filtered = passState.passes.filter(pass => pass.filterTags.includes(passState.filter));
    if (!filtered.length) {
      list.innerHTML = `<div class="sky-empty"><h3>No visible passes found</h3><p>Try another filter, refresh later, or enter a nearby location. Visibility estimates depend on orbital data and sky conditions.</p></div>`;
      return;
    }
    const bestId = `${filtered[0].satelliteId}-${filtered[0].peakTime.getTime()}`;
    list.innerHTML = filtered.map(pass => passCard(pass, `${pass.satelliteId}-${pass.peakTime.getTime()}` === bestId)).join('');
    updateCountdowns();
    if (passState.countdownTimer) clearInterval(passState.countdownTimer);
    passState.countdownTimer = setInterval(updateCountdowns, 1000);
  }

  function passCard(pass, best) {
    return `<article class="sky-pass-card ${best ? 'best' : ''}">
      <div class="sky-pass-top">
        <div>
          <span class="quality-pill ${pass.visibilityQuality.toLowerCase()}">${esc(pass.visibilityQuality)}</span>
          ${best ? '<span class="best-pill">Best pass</span>' : ''}
        </div>
        <button type="button" data-follow-id="${esc(pass.satelliteId)}">Notify me</button>
      </div>
      <h3>${esc(pass.name)}</h3>
      <div class="countdown" data-countdown="${pass.startTime.toISOString()}">Calculating countdown...</div>
      <div class="pass-times">
        <span><strong>Start</strong>${formatTime(pass.startTime)} ${esc(pass.directionStart)}</span>
        <span><strong>Peak</strong>${formatTime(pass.peakTime)} ${pass.maxElevation} deg</span>
        <span><strong>End</strong>${formatTime(pass.endTime)} ${esc(pass.directionEnd)}</span>
      </div>
      <p>${esc(pass.brightnessEstimate)}. Magnitude is not exact.</p>
    </article>`;
  }

  function formatTime(date) {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function updateCountdowns() {
    $$('[data-countdown]').forEach(el => {
      const target = new Date(el.dataset.countdown);
      const ms = target - Date.now();
      if (ms <= 0) {
        el.textContent = 'Happening now or already passed';
        return;
      }
      const minutes = Math.floor(ms / 60000);
      const hours = Math.floor(minutes / 60);
      const rest = minutes % 60;
      el.textContent = hours ? `${hours}h ${rest}m until pass` : `${Math.max(1, rest)}m until pass`;
    });
  }

  function renderDirectory() {
    const mount = $('#satelliteDirectory');
    if (!mount) return;
    mount.innerHTML = data.satellites.map(sat => {
      const model = data.models.find(item => item.id === sat.modelId || item.satelliteId === sat.id);
      return `<article class="directory-card">
        <span>${esc(sat.missionType)}</span>
        <h3>${esc(sat.name)}</h3>
        <p>${esc(sat.shortDescription)}</p>
        <div class="directory-meta">
          <span>${esc(sat.orbitType)}</span>
          <span>${esc(sat.country)}</span>
        </div>
        <div class="directory-actions">
          <a href="/satellite/${esc(sat.slug)}">Open page</a>
          <button type="button" data-follow-id="${esc(sat.id)}">Follow</button>
        </div>
        <small>${model?.embedUid ? 'Real model available' : 'Procedural fallback'}</small>
      </article>`;
    }).join('');
  }

  function getAlerts() {
    try { return JSON.parse(localStorage.getItem(STORE_ALERTS) || '[]'); } catch (_) { return []; }
  }

  function setAlerts(alerts) {
    localStorage.setItem(STORE_ALERTS, JSON.stringify(alerts));
  }

  function openAlertModal(satelliteId) {
    const sat = data.satellites.find(item => item.id === satelliteId || item.slug === satelliteId) || { id: satelliteId, name: satelliteId };
    data.selectedAlert = sat.id;
    $('#alertModalTitle').textContent = `Notify me about ${sat.name}`;
    $('#alertModal')?.removeAttribute('hidden');
    $('#alertReminderMinutes')?.focus();
  }

  function closeAlertModal() {
    $('#alertModal')?.setAttribute('hidden', '');
  }

  function saveAlertFromModal() {
    if (!data.selectedAlert) return;
    const reminderMinutes = Number($('#alertReminderMinutes')?.value || 10);
    const alerts = getAlerts().filter(alert => alert.satelliteId !== data.selectedAlert);
    alerts.push({ satelliteId: data.selectedAlert, alertType: 'browser', reminderMinutes, enabled: true });
    setAlerts(alerts);
    scheduleBrowserReminder(data.selectedAlert, reminderMinutes);
    closeAlertModal();
    renderAlerts();
  }

  async function requestNotificationPermission() {
    if (!('Notification' in window)) {
      alert('Browser notifications are not supported here.');
      return;
    }
    const permission = await Notification.requestPermission();
    $('#requestNotifyPermission').textContent = permission === 'granted' ? 'Notifications enabled' : 'Notifications blocked';
  }

  function scheduleBrowserReminder(satelliteId, reminderMinutes) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const pass = passState.passes.find(item => item.satelliteId === satelliteId);
    if (!pass) return;
    const delay = pass.startTime.getTime() - Date.now() - reminderMinutes * 60000;
    if (delay < 0 || delay > 24 * 60 * 60 * 1000) return;
    window.setTimeout(() => {
      new Notification('Satellite pass soon', { body: `${pass.name} starts near ${formatTime(pass.startTime)}.` });
    }, delay);
  }

  function renderAlerts() {
    const mount = $('#alertsList');
    if (!mount) return;
    const alerts = getAlerts();
    if (!alerts.length) {
      mount.innerHTML = '<div class="alerts-empty"><h3>No alerts yet</h3><p>Follow a satellite from Sky Tonight or the satellite directory. Alerts stay local on this device.</p></div>';
      return;
    }
    mount.innerHTML = alerts.map(alert => {
      const sat = data.satellites.find(item => item.id === alert.satelliteId) || { name: alert.satelliteId, missionType: 'Satellite' };
      return `<article class="alert-card">
        <div>
          <span>${esc(sat.missionType)}</span>
          <h3>${esc(sat.name)}</h3>
          <p>${alert.reminderMinutes} minutes before visible pass</p>
        </div>
        <div class="alert-card-actions">
          <button type="button" data-alert-ics="${esc(alert.satelliteId)}">.ics</button>
          <button type="button" data-alert-remove="${esc(alert.satelliteId)}">Remove</button>
        </div>
      </article>`;
    }).join('');
  }

  function removeAlert(satelliteId) {
    setAlerts(getAlerts().filter(alert => alert.satelliteId !== satelliteId));
    renderAlerts();
  }

  function downloadIcsForSatellite(satelliteId) {
    const sat = data.satellites.find(item => item.id === satelliteId || item.slug === satelliteId) || { name: satelliteId };
    const pass = passState.passes.find(item => item.satelliteId === satelliteId);
    const start = pass?.startTime || new Date(Date.now() + 60 * 60 * 1000);
    const end = pass?.endTime || new Date(start.getTime() + 10 * 60000);
    const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//ORBITAL//Satellite Alert//EN\r\nBEGIN:VEVENT\r\nUID:${satelliteId}-${start.getTime()}@orbital\r\nDTSTAMP:${icsDate(new Date())}\r\nDTSTART:${icsDate(start)}\r\nDTEND:${icsDate(end)}\r\nSUMMARY:${sat.name} visible pass\r\nDESCRIPTION:Estimated ORBITAL satellite pass reminder. Verify weather and sky conditions.\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
    const blob = new Blob([ics], { type: 'text/calendar' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${satelliteId}-pass.ics`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function icsDate(date) {
    return new Date(date).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  }

  function renderEducationMode() {
    renderTimelines();
  }

  function renderTimelines() {
    const mount = $('#timelineMount');
    if (!mount || !data.education?.timelines) return;
    mount.innerHTML = data.education.timelines.map(timeline => `<details class="timeline-card">
      <summary>${esc(timeline.title)}</summary>
      <ol>${timeline.events.map(event => `<li><span>${esc(event.date)}</span><strong>${esc(event.title)}</strong><p>${esc(event.description)}</p></li>`).join('')}</ol>
    </details>`).join('');
  }

  function updateActiveNav() {
    const sections = ['sky-tonight', 'satellites', 'education'];
    let active = location.hash?.replace('#', '') || 'tracker';
    const alertsEl = document.getElementById('alerts');
    if (alertsEl) {
      const alertsRect = alertsEl.getBoundingClientRect();
      if (alertsRect.top < window.innerHeight * 0.5 && alertsRect.bottom > window.innerHeight * 0.2) active = 'alerts';
    }
    for (const id of sections) {
      const el = document.getElementById(id);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.46 && rect.bottom > window.innerHeight * 0.25) {
        if (active !== 'alerts') active = id;
        break;
      }
    }
    if (window.scrollY < window.innerHeight * 0.45) active = 'tracker';
    $$('[data-product-nav]').forEach(link => link.classList.toggle('active', link.dataset.productNav === active || (active === 'globeStage' && link.dataset.productNav === 'tracker')));
    $$('.platform-hub').forEach(section => section.classList.toggle('section-active', section.id === active));
  }
})();
