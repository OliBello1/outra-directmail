/* ────────────────────────────────────────────────────────────
   Outra Direct Mail · funnel client
   Single-file state machine for the 4-step subscription flow.
   ──────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  // ─── Pricing tier function ────────────────────────────────
  // Per-DM cost as a function of monthly volume (after the free-10 trial).
  // First 10 DMs: free  ·  11–50: £1.50  ·  51–100: £1.40  ·  101–200: £1.30  ·  201+: £1.00
  const TIERS = [
    { from:   1, to:  10, perDm: 0.00, label: 'Free trial' },
    { from:  11, to:  50, perDm: 1.50, label: '£1.50' },
    { from:  51, to: 100, perDm: 1.40, label: '£1.40' },
    { from: 101, to: 200, perDm: 1.30, label: '£1.30' },
    { from: 201, to: Infinity, perDm: 1.00, label: '£1.00' }
  ];

  function costForVolume(dms) {
    // Tiered (not bracketed) cost up to `dms` DMs in a month, including the free 10.
    let remaining = Math.max(0, Math.floor(dms));
    let total = 0;
    for (const t of TIERS) {
      if (remaining <= 0) break;
      const slice = Math.min(remaining, t.to - t.from + 1);
      total += slice * t.perDm;
      remaining -= slice;
    }
    return total;
  }

  function volumeForBudget(budget) {
    // Inverse: find the max DM count whose tiered cost ≤ budget.
    if (!isFinite(budget) || budget <= 0) return 0;
    let remaining = budget;
    let dms = 0;
    for (const t of TIERS) {
      if (remaining <= 0) break;
      const tierSize = t.to - t.from + 1;
      if (t.perDm === 0) {
        dms += tierSize; // free 10
        continue;
      }
      const affordable = Math.floor(remaining / t.perDm);
      const take = Math.min(affordable, tierSize);
      dms += take;
      remaining -= take * t.perDm;
      if (take < tierSize) break;
    }
    return dms;
  }

  function activeTierIndex(dms) {
    for (let i = TIERS.length - 1; i >= 0; i--) {
      if (dms >= TIERS[i].from) return i;
    }
    return 0;
  }

  function effectivePerDm(dms) {
    // Marginal price at this volume — useful to show "per DM at this volume".
    const idx = activeTierIndex(Math.max(11, dms)); // skip free trial for the readout
    return TIERS[idx].perDm;
  }

  // ─── State ────────────────────────────────────────────────
  const state = {
    step: 1,
    postcodes: [],              // [{code, area, dmPerWeek}]
    phone: '',
    cap: { mode: 'dms', value: 100 },
    design: {
      template: 'bold',
      logoUrl: '',
      artworkUrl: '',
      brief: '',
      side: 'front',
      headline: 'Thinking of moving?',
      sub: 'A no-obligation valuation, delivered by your local Outra-vetted agent.'
    }
  };

  // ─── DOM helpers ──────────────────────────────────────────
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const fmt = {
    int: n => new Intl.NumberFormat('en-GB').format(Math.round(n)),
    gbp: n => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n)
  };

  // ─── Step navigation ──────────────────────────────────────
  function goToStep(n) {
    state.step = n;
    document.body.dataset.step = String(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (n === 4) renderSummary();
  }

  // Bind back buttons
  $$('[data-back]').forEach(btn => {
    btn.addEventListener('click', () => goToStep(parseInt(btn.dataset.back, 10)));
  });

  $('#step1Next').addEventListener('click', () => state.postcodes.length && goToStep(2));
  $('#step2Next').addEventListener('click', () => isValidPhone(state.phone) && goToStep(3));
  $('#step3Next').addEventListener('click', () => goToStep(4));

  // ─── STEP 1 · Postcode search ─────────────────────────────
  const POSTCODES = window.POSTCODES || [];
  const searchInput   = $('#postcodeInput');
  const resultsList   = $('#postcodeResults');
  const chipsList     = $('#chips');
  const estimateBlock = $('#estimate');

  function searchPostcodes(query) {
    const q = query.trim().toUpperCase();
    if (q.length < 1) return [];
    const tokens = q.toLowerCase();
    return POSTCODES
      .filter(p => {
        if (state.postcodes.some(sel => sel.code === p.code)) return false;
        return p.code.startsWith(q) || p.area.toLowerCase().includes(tokens);
      })
      .slice(0, 8);
  }

  function renderResults(matches) {
    if (!matches.length) {
      resultsList.innerHTML = '<li class="res-empty">No matches — try another postcode prefix or area name.</li>';
      resultsList.hidden = false;
      return;
    }
    resultsList.innerHTML = matches.map((p, i) => `
      <li role="option" data-code="${p.code}" data-i="${i}">
        <span class="res-meta">
          <span class="res-code">${p.code}</span>
          <span class="res-area">${p.area}</span>
        </span>
        <span class="res-vol">${p.dmPerWeek} DMs/wk</span>
      </li>
    `).join('');
    resultsList.hidden = false;
  }

  function addPostcode(code) {
    const p = POSTCODES.find(x => x.code === code);
    if (!p || state.postcodes.some(x => x.code === code)) return;
    state.postcodes.push(p);
    renderChips();
    renderEstimate();
    searchInput.value = '';
    resultsList.hidden = true;
    searchInput.focus();
    $('#step1Next').disabled = false;
  }

  function removePostcode(code) {
    state.postcodes = state.postcodes.filter(p => p.code !== code);
    renderChips();
    renderEstimate();
    $('#step1Next').disabled = state.postcodes.length === 0;
  }

  function renderChips() {
    chipsList.innerHTML = state.postcodes.map(p => `
      <li class="chip">
        <span class="chip__code">${p.code}</span>
        <span class="chip__area">${p.area}</span>
        <span class="chip__vol">${p.dmPerWeek}/wk</span>
        <button class="chip__x" data-remove="${p.code}" aria-label="Remove ${p.code}">×</button>
      </li>
    `).join('');
  }

  function renderEstimate() {
    if (!state.postcodes.length) { estimateBlock.hidden = true; return; }
    const weekly = state.postcodes.reduce((s, p) => s + p.dmPerWeek, 0);
    $('#estDms').textContent     = fmt.int(weekly);
    $('#estCount').textContent   = fmt.int(state.postcodes.length);
    $('#estMonthly').textContent = fmt.int(weekly * 4.33);
    estimateBlock.hidden = false;
  }

  searchInput.addEventListener('input', e => renderResults(searchPostcodes(e.target.value)));
  searchInput.addEventListener('focus', e => { if (e.target.value) renderResults(searchPostcodes(e.target.value)); });
  document.addEventListener('click', e => {
    if (!e.target.closest('.search')) resultsList.hidden = true;
  });
  resultsList.addEventListener('click', e => {
    const li = e.target.closest('li[data-code]');
    if (li) addPostcode(li.dataset.code);
  });
  chipsList.addEventListener('click', e => {
    const btn = e.target.closest('.chip__x');
    if (btn) removePostcode(btn.dataset.remove);
  });

  // Keyboard nav on results
  let activeRes = -1;
  searchInput.addEventListener('keydown', e => {
    const items = $$('li[data-code]', resultsList);
    if (!items.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); activeRes = Math.min(activeRes + 1, items.length - 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); activeRes = Math.max(activeRes - 1, 0); }
    else if (e.key === 'Enter' && activeRes >= 0) { e.preventDefault(); addPostcode(items[activeRes].dataset.code); activeRes = -1; return; }
    else if (e.key === 'Escape') { resultsList.hidden = true; return; }
    else return;
    items.forEach((el, i) => el.classList.toggle('is-active', i === activeRes));
  });

  // ─── STEP 2 · Phone ───────────────────────────────────────
  const phoneInput = $('#phoneInput');
  const phoneHint  = $('#phoneHint');

  function normalisePhone(v) {
    return v.replace(/[^\d+]/g, '').replace(/^00/, '+');
  }
  function isValidPhone(v) {
    const n = normalisePhone(v);
    // UK mobile permissive — accept 07XXXXXXXXX or +447XXXXXXXXX
    return /^(\+44|0)7\d{9}$/.test(n);
  }

  phoneInput.addEventListener('input', e => {
    state.phone = e.target.value;
    const ok = isValidPhone(state.phone);
    $('#step2Next').disabled = !ok;
    phoneHint.classList.toggle('is-bad', !ok && state.phone.length >= 7);
    phoneHint.textContent = ok
      ? '✓ Looks good — we\u2019ll only text you once to confirm.'
      : (state.phone.length < 7
          ? 'Use a UK mobile number — we\u2019ll send a single confirmation text.'
          : 'That doesn\u2019t look like a UK mobile. Try 07… or +447…');
  });

  // ─── STEP 3 · Builder ─────────────────────────────────────
  const capValueInput = $('#capValue');
  const capPrefix     = $('#capPrefix');
  const capSuffix     = $('#capSuffix');
  const capOther      = $('#capOther');
  const capPerDm      = $('#capPerDm');
  const tiersBody     = $('#tiersBody');

  function setCapMode(mode) {
    state.cap.mode = mode;
    $$('[data-cap-mode]').forEach(b => b.classList.toggle('is-on', b.dataset.capMode === mode));
    if (mode === 'dms') {
      capPrefix.textContent = '×';
      capSuffix.textContent = 'DMs';
      capValueInput.min  = 10;
      capValueInput.step = 1;
      // If switching from spend, convert
      capValueInput.value = state.cap._lastDms || volumeForBudget(state.cap._lastSpend || 140) || 100;
    } else {
      capPrefix.textContent = '£';
      capSuffix.textContent = '/mo';
      capValueInput.min  = 15;
      capValueInput.step = 5;
      capValueInput.value = state.cap._lastSpend || costForVolume(state.cap._lastDms || 100) || 140;
    }
    state.cap.value = parseFloat(capValueInput.value);
    renderCapReadout();
    renderTiersHighlight();
  }

  function renderCapReadout() {
    const v = parseFloat(capValueInput.value) || 0;
    state.cap.value = v;
    if (state.cap.mode === 'dms') {
      state.cap._lastDms = v;
      capOther.textContent = fmt.gbp(costForVolume(v));
      capPerDm.textContent = fmt.gbp(effectivePerDm(v));
    } else {
      state.cap._lastSpend = v;
      const dms = volumeForBudget(v);
      capOther.textContent = `${fmt.int(dms)} DMs`;
      capPerDm.textContent = fmt.gbp(effectivePerDm(dms));
    }
    renderTiersHighlight();
  }

  function renderTiersHighlight() {
    const dms = state.cap.mode === 'dms' ? state.cap.value : volumeForBudget(state.cap.value);
    const idx = activeTierIndex(Math.max(11, dms));
    $$('tr', tiersBody).forEach((row, i) => row.classList.toggle('is-active', i === idx));
  }

  $$('[data-cap-mode]').forEach(b => b.addEventListener('click', () => setCapMode(b.dataset.capMode)));
  capValueInput.addEventListener('input', renderCapReadout);

  // Templates
  $$('.template').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.template').forEach(b => b.classList.toggle('is-on', b === btn));
      state.design.template = btn.dataset.template;
      $('#cardPreview').dataset.template = btn.dataset.template;
    });
  });

  // Card side
  $$('.sidebtn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.sidebtn').forEach(b => b.classList.toggle('is-on', b === btn));
      state.design.side = btn.dataset.side;
      $('#cardPreview').dataset.side = btn.dataset.side;
    });
  });

  // Brief
  const briefInput = $('#briefInput');
  const briefCount = $('#briefCount');
  briefInput.addEventListener('input', e => {
    state.design.brief = e.target.value;
    briefCount.textContent = String(e.target.value.length);
    // Light real-time headline inference: first sentence becomes the sub if non-empty
    if (e.target.value.trim()) {
      const first = e.target.value.split(/[.!?\n]/)[0].trim().slice(0, 90);
      if (first.length > 8) {
        $('#cardSub').textContent = first;
        state.design.sub = first;
      }
    }
  });

  // AI Generate stub — deterministic, no LLM call.
  $('#aiGenerate').addEventListener('click', () => {
    const builder = $('.builder');
    builder.classList.add('is-ai-loading');
    setTimeout(() => {
      const brief = state.design.brief.trim() || 'A premium, no-obligation home valuation';
      const headlines = [
        'Your home, valued by experts.',
        'Worth more than you think.',
        'A free, no-obligation valuation — on your terms.',
        'The market is shifting. Know your number.',
        'Sell smarter. Start with a free valuation.'
      ];
      // Pick a headline deterministically from the brief length
      const headline = headlines[brief.length % headlines.length];
      const sub = `${brief.charAt(0).toUpperCase()}${brief.slice(1)}${/[.!?]$/.test(brief) ? '' : '.'}`;
      $('#cardHeadline').textContent = headline;
      $('#cardSub').textContent = sub;
      state.design.headline = headline;
      state.design.sub = sub;
      // Auto-pick a template if user hasn't touched
      const templates = ['bold','image','minimal'];
      const pick = templates[brief.length % templates.length];
      $$('.template').forEach(b => b.classList.toggle('is-on', b.dataset.template === pick));
      state.design.template = pick;
      $('#cardPreview').dataset.template = pick;
      builder.classList.remove('is-ai-loading');
    }, 1100);
  });

  // ─── Uploads (Vercel Blob client) ─────────────────────────
  async function uploadAsset(file, slot) {
    if (!file) return null;
    if (file.size > 5 * 1024 * 1024) {
      alert('That file is over 5 MB. Please pick a smaller one.');
      return null;
    }
    const wrap = slot === 'logo' ? $('#logoInput').closest('.upload') : $('#artworkInput').closest('.upload');
    const statusEl = slot === 'logo' ? $('#logoStatus') : $('#artworkStatus');
    wrap.classList.add('is-loading');
    statusEl.textContent = 'Uploading…';
    try {
      // Use Vercel Blob's client upload — falls back to data URL if endpoint not available locally.
      const { upload } = await import('https://esm.sh/@vercel/blob@0.23.4/client');
      const blob = await upload(`directmail/${slot}/${Date.now()}-${file.name}`, file, {
        access: 'public',
        handleUploadUrl: '/api/upload'
      });
      wrap.classList.remove('is-loading');
      wrap.classList.add('is-ok');
      statusEl.textContent = '✓ ' + file.name;
      return blob.url;
    } catch (err) {
      console.warn('[upload] blob unavailable, falling back to local data URL:', err.message);
      // Fallback for local dev / missing BLOB_READ_WRITE_TOKEN
      const dataUrl = await new Promise(r => {
        const reader = new FileReader();
        reader.onload = () => r(reader.result);
        reader.readAsDataURL(file);
      });
      wrap.classList.remove('is-loading');
      wrap.classList.add('is-ok');
      statusEl.textContent = `✓ ${file.name} · local preview`;
      return dataUrl;
    }
  }

  $('#logoInput').addEventListener('change', async e => {
    const url = await uploadAsset(e.target.files[0], 'logo');
    if (url) {
      state.design.logoUrl = url;
      $('#cardLogo').src = url;
      $('#cardLogo').setAttribute('alt', 'Brand logo');
    }
  });
  $('#artworkInput').addEventListener('change', async e => {
    const url = await uploadAsset(e.target.files[0], 'artwork');
    if (url) {
      state.design.artworkUrl = url;
      $('#cardArtwork').src = url;
      $('#cardArtworkBack').src = url;
      $('#cardArtwork').setAttribute('alt', 'Hero artwork');
    }
  });

  // ─── STEP 4 · Summary ─────────────────────────────────────
  function renderSummary() {
    const weekly = state.postcodes.reduce((s, p) => s + p.dmPerWeek, 0);
    const monthly = Math.round(weekly * 4.33);
    const codes = state.postcodes.map(p => p.code).join(', ');
    $('#sumPostcodes').textContent = `${state.postcodes.length} selected · ${codes}`;
    $('#sumReach').textContent     = `${fmt.int(weekly)} DMs/wk · ~${fmt.int(monthly)}/mo`;

    const capLabel = state.cap.mode === 'dms'
      ? `${fmt.int(state.cap.value)} DMs / month (≈ ${fmt.gbp(costForVolume(state.cap.value))})`
      : `${fmt.gbp(state.cap.value)} / month (≈ ${fmt.int(volumeForBudget(state.cap.value))} DMs)`;
    $('#sumCap').textContent = capLabel;

    const tplLabel = { bold: 'Bold Headline', image: 'Image Led', minimal: 'Minimal Text' }[state.design.template];
    $('#sumTemplate').textContent = tplLabel;
  }

  // ─── Checkout ─────────────────────────────────────────────
  $('#step4Pay').addEventListener('click', async () => {
    $('#payError').hidden = true;
    showOverlay('Setting up your secure checkout…');
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postcodes: state.postcodes.map(p => p.code),
          postcodeDetails: state.postcodes,
          phone: state.phone,
          cap: state.cap,
          design: state.design,
          weeklyEst: state.postcodes.reduce((s, p) => s + p.dmPerWeek, 0)
        })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Checkout setup failed (${res.status})`);
      if (!body.url) throw new Error('Checkout response missing redirect URL.');
      window.location.assign(body.url);
    } catch (err) {
      hideOverlay();
      const e = $('#payError');
      e.textContent = `${err.message} — Check that STRIPE_SECRET_KEY is configured on the deployment.`;
      e.hidden = false;
    }
  });

  function showOverlay(text) {
    $('#overlayText').textContent = text || 'Loading…';
    $('#overlay').hidden = false;
  }
  function hideOverlay() { $('#overlay').hidden = true; }

  // ─── Init ─────────────────────────────────────────────────
  setCapMode('dms');
  renderCapReadout();
})();
