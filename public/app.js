/* ────────────────────────────────────────────────────────────
   Outra Direct Mail · funnel client
   State machine + tier math + uploads + AI design generation.
   ──────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  // ─── API origin ───────────────────────────────────────────
  // When proxied via outra.vip, relative API paths would 404.
  // Always call the project's canonical origin.
  const API_ORIGIN = 'https://outra-directmail.vercel.app';

  // ─── Pricing tiers ────────────────────────────────────────
  // First 10 free · 11–50 £1.50 · 51–100 £1.40 · 101–200 £1.30 · 201+ £1.00
  const TIERS = [
    { from:   1, to:  10, perDm: 0.00, label: 'Free trial' },
    { from:  11, to:  50, perDm: 1.50, label: '£1.50' },
    { from:  51, to: 100, perDm: 1.40, label: '£1.40' },
    { from: 101, to: 200, perDm: 1.30, label: '£1.30' },
    { from: 201, to: Infinity, perDm: 1.00, label: '£1.00' }
  ];

  function costForVolume(dms) {
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
    if (!isFinite(budget) || budget <= 0) return 0;
    let remaining = budget;
    let dms = 0;
    for (const t of TIERS) {
      if (remaining <= 0) break;
      const tierSize = t.to - t.from + 1;
      if (t.perDm === 0) { dms += tierSize; continue; }
      const affordable = Math.floor(remaining / t.perDm);
      const take = Math.min(affordable, tierSize);
      dms += take; remaining -= take * t.perDm;
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
    const idx = activeTierIndex(Math.max(11, dms));
    return TIERS[idx].perDm;
  }

  // ─── State ────────────────────────────────────────────────
  const state = {
    step: 1,
    designMode: 'designer',                  // 'designer' | 'upload'
    postcodes: [],
    phone: '',
    cap: { mode: 'dms', value: 100 },
    design: {
      template: 'bold',
      logoUrl: '',
      artworkUrl: '',
      brief: '',
      headline: 'Thinking of moving?',
      sub: 'A no-obligation valuation, delivered by your local Outra-vetted agent.',
      cta: 'Book your free valuation →'
    },
    upload: { frontUrl: '', backUrl: '' }
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
  $$('[data-back]').forEach(btn => btn.addEventListener('click', () => goToStep(parseInt(btn.dataset.back, 10))));
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
      .filter(p => !state.postcodes.some(s => s.code === p.code) && (p.code.startsWith(q) || p.area.toLowerCase().includes(tokens)))
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
        <span class="res-meta"><span class="res-code">${p.code}</span><span class="res-area">${p.area}</span></span>
        <span class="res-vol">${p.dmPerWeek} / wk</span>
      </li>
    `).join('');
    resultsList.hidden = false;
  }
  function addPostcode(code) {
    const p = POSTCODES.find(x => x.code === code);
    if (!p || state.postcodes.some(x => x.code === code)) return;
    state.postcodes.push(p);
    renderChips(); renderEstimate();
    searchInput.value = '';
    resultsList.hidden = true;
    searchInput.focus();
    $('#step1Next').disabled = false;
  }
  function removePostcode(code) {
    state.postcodes = state.postcodes.filter(p => p.code !== code);
    renderChips(); renderEstimate();
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
  document.addEventListener('click', e => { if (!e.target.closest('.search')) resultsList.hidden = true; });
  resultsList.addEventListener('click', e => { const li = e.target.closest('li[data-code]'); if (li) addPostcode(li.dataset.code); });
  chipsList.addEventListener('click', e => { const btn = e.target.closest('.chip__x'); if (btn) removePostcode(btn.dataset.remove); });

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

  // ─── STEP 2 · Email ───────────────────────────────────────
  const emailInput = $('#emailInput');
  const emailHint  = $('#emailHint');
  function isValidEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());
  }
  // Used by state + checkout step
  state.email = state.email || '';

  if (emailInput) {
    emailInput.addEventListener('input', e => {
      state.email = e.target.value.trim();
      const ok = isValidEmail(state.email);
      $('#step2Next').disabled = !ok;
      emailHint.classList.toggle('is-bad', !ok && state.email.length >= 4);
      emailHint.classList.toggle('is-ok', ok);
      emailHint.textContent = ok
        ? '✓ Looks good — we\u2019ll only email once to confirm your order.'
        : (state.email.length < 4
            ? 'We\u2019ll send a single confirmation email — make sure it\u2019s one you check.'
            : 'That doesn\u2019t look like a valid email. Double-check it?');
    });
  }
  // Re-bind Step 2 Next to email check
  $('#step2Next').onclick = () => isValidEmail(state.email) && goToStep(3);

  // ─── STEP 3 · Mode toggle ─────────────────────────────────
  $$('[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => setDesignMode(btn.dataset.mode));
  });
  function setDesignMode(mode) {
    state.designMode = mode;
    document.body.dataset.designMode = mode;
    $$('[data-mode]').forEach(b => b.classList.toggle('is-on', b.dataset.mode === mode));
    applyPreviewMode();
  }
  function applyPreviewMode() {
    const front = $('#cardFront');
    const back  = $('#cardBack');
    if (state.designMode === 'upload') {
      front.classList.add('card--upload');
      back.classList.add('card--upload');
      front.classList.toggle('has-img', !!state.upload.frontUrl);
      back.classList.toggle('has-img',  !!state.upload.backUrl);
      // Use the uploaded image as the card background
      $('#cardArtwork').src      = state.upload.frontUrl || '';
      $('#cardArtworkBack').src  = state.upload.backUrl  || '';
    } else {
      front.classList.remove('card--upload');
      back.classList.remove('card--upload');
      front.classList.remove('has-img');
      back.classList.remove('has-img');
      // Restore designer-mode artwork (the hero image upload)
      $('#cardArtwork').src     = state.design.artworkUrl || '';
      $('#cardArtworkBack').src = state.design.artworkUrl || '';
    }
  }

  // ─── STEP 4 · Cap controls (slider) ──────────────────────
  const capValueInput   = $('#capValue');
  const capValueDisplay = $('#capValueDisplay');
  const capPrefix       = $('#capPrefix');
  const capSuffix       = $('#capSuffix');
  const capOther        = $('#capOther');
  const capPerDm        = $('#capPerDm');
  const capScale        = $('#capScale');
  const tiersBody       = $('#tiersBody');

  // Slider ranges (step of 20 in both modes per spec)
  const CAP_RANGES = {
    dms:   { min: 20,  max: 400, step: 20,  default: 100, scale: [20, 100, 200, 300, 400] },
    spend: { min: 20,  max: 600, step: 20,  default: 140, scale: [20, 100, 200, 400, 600] }
  };

  function setCapMode(mode) {
    state.cap.mode = mode;
    $$('[data-cap-mode]').forEach(b => b.classList.toggle('is-on', b.dataset.capMode === mode));
    const r = CAP_RANGES[mode];
    if (!capValueInput) return;
    capValueInput.min  = r.min;
    capValueInput.max  = r.max;
    capValueInput.step = r.step;
    const stored = mode === 'dms' ? state.cap._lastDms : state.cap._lastSpend;
    const v = clampToStep(stored ?? r.default, r);
    capValueInput.value = v;
    if (capPrefix) capPrefix.textContent = mode === 'dms' ? '×' : '£';
    if (capSuffix) capSuffix.textContent = mode === 'dms' ? 'DMs / month' : '/ month';
    if (capScale) capScale.innerHTML = r.scale.map(n => `<span>${mode === 'spend' ? '£'+n : n}</span>`).join('');
    state.cap.value = v;
    renderCapReadout();
  }
  function clampToStep(v, r) {
    const n = Math.round((v - r.min) / r.step) * r.step + r.min;
    return Math.min(r.max, Math.max(r.min, n));
  }
  function renderCapReadout() {
    const v = parseFloat(capValueInput && capValueInput.value) || 0;
    state.cap.value = v;
    if (capValueDisplay) capValueDisplay.textContent = state.cap.mode === 'spend' ? '£' + fmt.int(v) : fmt.int(v);
    if (state.cap.mode === 'dms') {
      state.cap._lastDms = v;
      if (capOther) capOther.textContent = fmt.gbp(costForVolume(v));
      if (capPerDm) capPerDm.textContent = fmt.gbp(effectivePerDm(v));
    } else {
      state.cap._lastSpend = v;
      const dms = volumeForBudget(v);
      if (capOther) capOther.textContent = `${fmt.int(dms)} DMs`;
      if (capPerDm) capPerDm.textContent = fmt.gbp(effectivePerDm(dms));
    }
    renderTiersHighlight();
    renderBasket();
    // Visualise slider fill
    if (capValueInput) {
      const r = CAP_RANGES[state.cap.mode];
      const pct = ((v - r.min) / (r.max - r.min)) * 100;
      capValueInput.style.setProperty('--fill', pct + '%');
    }
  }
  function renderTiersHighlight() {
    const dms = state.cap.mode === 'dms' ? state.cap.value : volumeForBudget(state.cap.value);
    const idx = activeTierIndex(Math.max(11, dms));
    $$('tr', tiersBody).forEach((row, i) => row.classList.toggle('is-active', i === idx));
  }
  $$('[data-cap-mode]').forEach(b => b.addEventListener('click', () => setCapMode(b.dataset.capMode)));
  capValueInput.addEventListener('input', renderCapReadout);

  // ─── STEP 3 · Templates ───────────────────────────────────
  $$('.template').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.template').forEach(b => b.classList.toggle('is-on', b === btn));
      state.design.template = btn.dataset.template;
      $('#cardFront').dataset.template = btn.dataset.template;
    });
  });

  // ─── STEP 3 · Brief ───────────────────────────────────────
  const briefInput = $('#briefInput');
  const briefCount = $('#briefCount');
  briefInput.addEventListener('input', e => {
    state.design.brief = e.target.value;
    briefCount.textContent = String(e.target.value.length);
  });

  // ─── STEP 3 · AI Generate (real Claude call) ──────────────
  $('#aiGenerate').addEventListener('click', async () => {
    const btn = $('#aiGenerate');
    const label = $('#aiGenerateLabel');
    btn.classList.add('is-loading');
    btn.disabled = true;
    const originalLabel = label.textContent;
    label.textContent = 'Generating…';

    try {
      const res = await fetch(`${API_ORIGIN}/api/ai-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief: state.design.brief || '',
          template: state.design.template,
          postcodes: state.postcodes.map(p => p.area),
          industry: 'estate agency / direct mail'
        })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `AI service unavailable (${res.status})`);
      if (!body.headline) throw new Error('AI returned no headline');

      state.design.headline = body.headline;
      state.design.sub      = body.sub || state.design.sub;
      state.design.cta      = body.cta || state.design.cta;
      if (body.template && ['bold','image','minimal'].includes(body.template)) {
        $$('.template').forEach(b => b.classList.toggle('is-on', b.dataset.template === body.template));
        state.design.template = body.template;
        $('#cardFront').dataset.template = body.template;
      }
      $('#cardHeadline').textContent = state.design.headline;
      $('#cardSub').textContent      = state.design.sub;
      $('#cardCta').textContent      = state.design.cta;
    } catch (err) {
      console.error('[ai-generate]', err);
      alert(`Couldn't generate a design: ${err.message}\n\nFalling back to a sensible default.`);
      // Light fallback so the demo still feels alive
      state.design.headline = 'Your home, valued by experts.';
      state.design.sub = 'A free, no-obligation valuation from your local Outra-vetted agent.';
      $('#cardHeadline').textContent = state.design.headline;
      $('#cardSub').textContent      = state.design.sub;
    } finally {
      btn.classList.remove('is-loading');
      btn.disabled = false;
      label.textContent = originalLabel;
    }
  });

  // ─── STEP 3 · Uploads (local data-URL — no Blob roundtrip) ─
  async function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
  async function handleUpload(input, slot) {
    const file = input.files && input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('File over 5 MB. Pick a smaller one.'); return; }

    const cfg = {
      logo:        { wrap: '#logoInput',        status: '#logoStatus' },
      artwork:     { wrap: '#artworkInput',     status: '#artworkStatus' },
      uploadFront: { wrap: '#frontUploadInput', status: '#frontUploadStatus', preview: '#frontUploadPreview' },
      uploadBack:  { wrap: '#backUploadInput',  status: '#backUploadStatus',  preview: '#backUploadPreview' }
    }[slot];
    if (!cfg) return;

    const wrapEl   = $(cfg.wrap).closest('.upload');
    const statusEl = $(cfg.status);
    wrapEl.classList.add('is-loading');
    statusEl.textContent = 'Loading…';

    try {
      const dataUrl = await fileToDataUrl(file);
      wrapEl.classList.remove('is-loading');
      wrapEl.classList.add('is-ok');
      statusEl.textContent = '✓ ' + file.name;

      if (slot === 'logo') {
        state.design.logoUrl = dataUrl;
        $('#cardLogo').src = dataUrl;
      } else if (slot === 'artwork') {
        state.design.artworkUrl = dataUrl;
        applyPreviewMode();
      } else if (slot === 'uploadFront') {
        state.upload.frontUrl = dataUrl;
        if (cfg.preview) $(cfg.preview).innerHTML = `<img src="${dataUrl}" alt="Front" />`;
        applyPreviewMode();
      } else if (slot === 'uploadBack') {
        state.upload.backUrl = dataUrl;
        if (cfg.preview) $(cfg.preview).innerHTML = `<img src="${dataUrl}" alt="Back" />`;
        applyPreviewMode();
      }
    } catch (err) {
      console.error('[upload]', err);
      wrapEl.classList.remove('is-loading');
      statusEl.textContent = 'Upload failed — try another file.';
    }
  }
  $('#logoInput').addEventListener('change',        e => handleUpload(e.target, 'logo'));
  $('#artworkInput').addEventListener('change',     e => handleUpload(e.target, 'artwork'));
  $('#frontUploadInput').addEventListener('change', e => handleUpload(e.target, 'uploadFront'));
  $('#backUploadInput').addEventListener('change',  e => handleUpload(e.target, 'uploadBack'));

  // ─── STEP 4 · Summary + live basket ───────────────────────
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

    const tplLabel = state.designMode === 'upload'
      ? 'Custom artwork (you uploaded)'
      : { bold: 'Designer · Bold Headline', image: 'Designer · Image Led', minimal: 'Designer · Minimal Text' }[state.design.template];
    $('#sumTemplate').textContent = tplLabel;

    renderBasket();
  }
  function renderBasket() {
    const dms = state.cap.mode === 'dms' ? Math.max(0, Math.floor(state.cap.value)) : volumeForBudget(state.cap.value);
    const tbody = $('#basketTiersBody');
    if (!tbody) return;
    let remaining = dms;
    let total = 0;
    tbody.innerHTML = TIERS.map(t => {
      const tierSize = t.to - t.from + 1;
      const take = Math.max(0, Math.min(remaining, tierSize));
      remaining -= take;
      const subtotal = take * t.perDm;
      total += subtotal;
      const range = t.to === Infinity ? `${t.from}+` : `${t.from} – ${t.to}`;
      const rateLabel = t.perDm === 0 ? 'Free' : fmt.gbp(t.perDm);
      const isActive = take > 0;
      const isEmpty  = take === 0;
      return `
        <tr class="${isActive ? 'is-active' : ''} ${isEmpty ? 'is-empty' : ''}">
          <td>${range} DMs</td>
          <td>${fmt.int(take)}</td>
          <td>${rateLabel}</td>
          <td class="num">${fmt.gbp(subtotal)}</td>
        </tr>`;
    }).join('');
    $('#basketTrialCredit').textContent = `−${fmt.gbp(0)}`;
    $('#basketMonthly').textContent     = fmt.gbp(total);
    $('#basketDueToday').textContent    = fmt.gbp(0);
    // Mirror onto the visible Shopify-style summary
    const sumMonthly = $('#sumMonthly');
    if (sumMonthly) sumMonthly.textContent = fmt.gbp(total);
  }

  // ─── Checkout (MOCK MODE — no spinner, straight to success) ─
  $('#step4Pay').addEventListener('click', () => {
    $('#payError').hidden = true;
    const isUnderOutraVip = /\/signature-segments\/(DirectMail|directmail)/i.test(window.location.pathname);
    const target = isUnderOutraVip
      ? '/signature-segments/DirectMail/success?sid=mock_' + Date.now()
      : '/success.html?sid=mock_' + Date.now();
    window.location.assign(target);
  });

  // ─── Init ─────────────────────────────────────────────────
  setCapMode('dms');
  renderCapReadout();
  applyPreviewMode();
})();
