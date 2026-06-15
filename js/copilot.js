/*
 * ORBITAL Space Copilot
 * Works without a paid API by using local satellite/orbit knowledge.
 * If the optional backend is running, it will use /api/copilot first.
 */
(function () {
  'use strict';

  const state = {
    hooks: {},
    busy: false
  };

  function $(id) {
    return document.getElementById(id);
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

  function formatMessage(text) {
    return escapeHtml(text)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n{2,}/g, '</p><p>')
      .replace(/\n/g, '<br>');
  }

  function targetIds(target) {
    const mobile = target === 'mobile';
    return {
      messages: mobile ? 'mobAIMessages' : 'copilotMessages',
      input: mobile ? 'mobAIInput' : 'copilotInput',
      send: mobile ? 'mobAISend' : 'copilotSend'
    };
  }

  function getTargetFromElement(el) {
    return el?.closest?.('#mobAISheet') ? 'mobile' : 'desktop';
  }

  function appendMessage(target, role, text) {
    const ids = targetIds(target);
    const box = $(ids.messages);
    if (!box) return null;

    const welcome = box.querySelector('.copilot-welcome');
    if (welcome && role === 'user') welcome.remove();

    const wrap = document.createElement('div');
    wrap.className = `copilot-msg ${role === 'user' ? 'user' : 'ai'}`;
    wrap.innerHTML = `
      <div class="copilot-bubble"><p>${formatMessage(text)}</p></div>
      <div class="copilot-msg-meta">${role === 'user' ? 'You' : 'Space Copilot'} · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>`;
    box.appendChild(wrap);
    box.scrollTop = box.scrollHeight;
    return wrap;
  }

  function appendTyping(target) {
    const ids = targetIds(target);
    const box = $(ids.messages);
    if (!box) return null;
    const typing = document.createElement('div');
    typing.className = 'copilot-msg ai';
    typing.innerHTML = '<div class="copilot-bubble"><div class="copilot-typing"><span></span><span></span><span></span></div></div>';
    box.appendChild(typing);
    box.scrollTop = box.scrollHeight;
    return typing;
  }

  function setBusy(target, busy) {
    state.busy = busy;
    const ids = targetIds(target);
    const btn = $(ids.send);
    if (btn) btn.disabled = busy;
    const status = $('copilotStatus');
    if (status) status.textContent = busy ? 'Thinking...' : 'Satellite Intelligence AI';
  }

  function selectedLabel() {
    try {
      return state.hooks.getSelectedLabel?.() || null;
    } catch (_) {
      return null;
    }
  }

  function liveContext() {
    try {
      return state.hooks.getContext?.() || '';
    } catch (_) {
      return '';
    }
  }

  function updateContextBadge() {
    const label = selectedLabel();
    const text = label ? `Selected: ${label}` : 'No satellite selected';
    const badge = $('copilotContextBadge');
    if (badge) badge.textContent = text;
  }

  function parseContext(context) {
    const out = {};
    String(context).split('|').forEach(part => {
      const idx = part.indexOf(':');
      if (idx > -1) {
        const key = part.slice(0, idx).replace(/\[LIVE CONTEXT\]/g, '').trim().toLowerCase();
        const value = part.slice(idx + 1).trim();
        if (key) out[key] = value;
      }
    });
    return out;
  }

  async function askBackend(question, context) {
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          context,
          system: state.hooks.getSystemPrompt?.() || ''
        }),
        signal: ctrl.signal
      });
      clearTimeout(timer);
      if (!res.ok) return null;
      const data = await res.json();
      return data?.answer || null;
    } catch (_) {
      clearTimeout(timer);
      return null;
    }
  }

  function localAnswer(question, context) {
    const q = question.toLowerCase();
    const ctx = parseContext(context);
    const hasSelected = Boolean(ctx.selected);
    const selected = ctx.selected || selectedLabel();
    const orbit = ctx.orbit || 'unknown';
    const alt = ctx.alt || 'unknown altitude';
    const speed = ctx.speed || 'unknown speed';
    const type = ctx.type || 'satellite';
    const countMatch = context.match(/Tracking\s+([\d,]+)\s+satellites/i);
    const count = countMatch ? countMatch[1] : null;

    if (hasSelected && /(this|selected|current|altitude|height|where|position|speed|velocity|orbit)/.test(q)) {
      return `Based on currently loaded data, **${selected}** is a **${type}** object in a **${orbit}** orbit. Its current altitude is about **${alt}**, moving at about **${speed}**. ${ctx.lat && ctx.lon ? `The sub-satellite point is near **${ctx.lat}, ${ctx.lon}**.` : ''}\n\nThese numbers come from the loaded TLE propagation and will drift as time passes.`;
    }

    if (q.includes('iss')) {
      return 'The **ISS** is a crewed space station in **low Earth orbit (LEO)**. It usually flies roughly 400 km above Earth and circles the planet about every 90 minutes. In ORBITAL, select the ISS entry to see its live propagated altitude, latitude, longitude, speed, and orbit path.';
    }

    if (q.includes('leo') || q.includes('geo') || q.includes('meo')) {
      return '**LEO** is close to Earth, usually under 2,000 km, so satellites move quickly and complete orbits in about 90-130 minutes. **MEO** sits higher and is common for navigation systems like GPS. **GEO** is near 35,786 km altitude, where a satellite appears fixed over one longitude because it matches Earth\'s rotation.';
    }

    if (q.includes('starlink')) {
      return '**Starlink** is a large LEO communications constellation. Many small satellites work together so user terminals can connect to whichever satellite is currently overhead, then traffic routes through ground gateways or laser links depending on the satellite generation.';
    }

    if (q.includes('tle')) {
      return 'A **TLE** is a two-line orbital data format used to estimate a satellite\'s position. ORBITAL loads TLE data, converts it with satellite.js, and propagates each object forward to draw current positions and orbit paths. TLEs are estimates, so they are best for tracking and visualization rather than precision navigation.';
    }

    if (q.includes('decay')) {
      return '**Orbital decay** happens when drag, mostly from the upper atmosphere, slowly removes orbital energy. Low satellites feel more drag, especially during solar activity, so their altitude drops unless they boost themselves. If they drop too low, they re-enter and burn up or fall into a controlled disposal path.';
    }

    if (q.includes('how many') || q.includes('count') || q.includes('satellites in orbit')) {
      return count
        ? `ORBITAL has **${count} satellites** loaded in the current catalog view. That is based on currently loaded data, not a permanent global total. Use Refresh to update the live catalog when the network is available.`
        : 'The exact number changes often as new satellites launch and old objects decay. In ORBITAL, the top bar shows how many objects are loaded from the current catalog.';
    }

    if (q.includes('isro') || q.includes('india') || q.includes('chandrayaan') || q.includes('gaganyaan')) {
      return 'The **ISRO India** panel highlights Indian missions, launch plans, and tracked Indian satellites. Open the ISRO tab to browse missions like Chandrayaan, Aditya-L1, XPoSat, NavIC, Cartosat, RISAT, and GSAT, then track matching satellites when they exist in the loaded TLE catalog.';
    }

    return `I can help with **satellite tracking, orbit types, TLE data, ISRO missions, Starlink, ISS, GPS, and orbital mechanics**. ${hasSelected ? `You currently have **${selected}** selected, so you can ask about its altitude, speed, position, or orbit.` : 'Select a satellite on the globe if you want live context in the answer.'}`;
  }

  async function sendMessage(target, presetText) {
    if (state.busy) return;
    const ids = targetIds(target);
    const input = $(ids.input);
    const question = (presetText || input?.value || '').trim();
    if (!question) return;

    if (input) {
      input.value = '';
      input.style.height = 'auto';
    }

    appendMessage(target, 'user', question);
    const typing = appendTyping(target);
    setBusy(target, true);

    const context = liveContext();
    let answer = await askBackend(question, context);
    if (!answer) answer = localAnswer(question, context);

    typing?.remove();
    appendMessage(target, 'ai', answer);
    setBusy(target, false);
  }

  function toggleCopilot(force) {
    const panel = $('copilotPanel');
    const fab = $('copilotFab');
    if (!panel) return;
    const open = typeof force === 'boolean' ? force : !panel.classList.contains('open');
    panel.classList.toggle('open', open);
    panel.setAttribute('aria-hidden', String(!open));
    fab?.classList.toggle('open', open);
    fab?.setAttribute('aria-expanded', String(open));
    updateContextBadge();
    if (open) requestAnimationFrame(() => $('copilotInput')?.focus({ preventScroll: true }));
  }

  function clearChat() {
    ['copilotMessages', 'mobAIMessages'].forEach(id => {
      const box = $(id);
      if (!box) return;
      const title = id === 'mobAIMessages' ? 'ORBITAL AI' : 'ORBITAL AI Copilot';
      const text = id === 'mobAIMessages'
        ? 'Ask me anything about satellites, orbital mechanics or space.'
        : 'Ask me anything about satellites, orbital mechanics, space debris, or the objects currently being tracked.';
      box.innerHTML = `
        <div class="copilot-welcome">
          <div class="copilot-welcome-icon">AI</div>
          <div class="copilot-welcome-title">${title}</div>
          <div class="copilot-welcome-text">${text}</div>
          <div class="copilot-chips">
            <button type="button" class="copilot-chip" data-q="What is the ISS current orbit altitude?">ISS altitude?</button>
            <button type="button" class="copilot-chip" data-q="Explain LEO vs GEO orbits">LEO vs GEO?</button>
            <button type="button" class="copilot-chip" data-q="How does Starlink work?">Starlink?</button>
            <button type="button" class="copilot-chip" data-q="What is orbital decay?">Orbital decay?</button>
          </div>
        </div>`;
    });
    bindChips();
  }

  function bindChips() {
    document.querySelectorAll('.copilot-chip').forEach(btn => {
      if (btn.dataset.bound === '1') return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => sendMessage(getTargetFromElement(btn), btn.dataset.q || btn.textContent));
    });
  }

  function bindInput(target) {
    const ids = targetIds(target);
    const input = $(ids.input);
    const send = $(ids.send);
    send?.addEventListener('click', () => sendMessage(target));
    input?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(target);
      }
    });
    input?.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
    });
  }

  function init(hooks) {
    state.hooks = hooks || {};
    if (window._orbitalCopilotBound) {
      updateContextBadge();
      return;
    }
    window._orbitalCopilotBound = true;

    $('copilotClose')?.addEventListener('click', () => toggleCopilot(false));
    $('copilotClear')?.addEventListener('click', clearChat);
    bindInput('desktop');
    bindInput('mobile');
    bindChips();
    updateContextBadge();
    setInterval(updateContextBadge, 4000);
  }

  window.OrbitalCopilot = {
    init,
    toggleCopilot,
    openCopilot: () => toggleCopilot(true),
    closeCopilot: () => toggleCopilot(false)
  };
})();
