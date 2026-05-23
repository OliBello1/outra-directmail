// POST /api/ai-generate
// Generates direct-mail card copy + template recommendation via Claude.
// Requires ANTHROPIC_API_KEY env var.
//
// Request body: { brief, template, postcodes, industry }
// Response:     { headline, sub, cta, template, rationale }

const ANTHROPIC_VERSION = '2023-06-01';
// Try in order — first available wins. Mix of generic family aliases
// (Anthropic guarantees these resolve to a current snapshot) and dated IDs
// as a backstop. If everything 404s here, the key is the problem.
const MODEL_FALLBACKS = [
  'claude-sonnet-4-5',
  'claude-opus-4-5',
  'claude-haiku-4-5',
  'claude-sonnet-4-20250514',
  'claude-opus-4-1-20250805',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
  'claude-3-haiku-20240307'
];

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'sk-ant-REPLACE_ME') {
    return res.status(503).json({
      error: 'AI service is not configured. Set ANTHROPIC_API_KEY on the Vercel project.'
    });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  const brief     = String(body.brief     || '').slice(0, 500);
  const template  = ['bold','image','minimal'].includes(body.template) ? body.template : 'bold';
  const postcodes = Array.isArray(body.postcodes) ? body.postcodes.slice(0, 12) : [];
  const industry  = String(body.industry || 'direct mail').slice(0, 80);

  const systemPrompt = `You are an expert direct-mail copywriter for Outra, a UK property-tech company. You write punchy, restrained, premium copy for postcards mailed to specific London neighbourhoods. Your output is always:
- A short headline (5–9 words, sentence case, ends with a period or question mark)
- A one-line subhead (12–20 words, single sentence)
- A short CTA (3–5 words, with → at the end)
- One of three template styles: "bold" (text-led, no image), "image" (full-bleed photo with text overlay), or "minimal" (lots of whitespace, restrained type)

Tone: confident, plain-spoken, never breathless or marketing-y. No exclamation marks. No emoji. No "amazing/incredible/perfect". You write for the recipient, not at them.

Output STRICT JSON with keys: headline, sub, cta, template, rationale. No prose outside the JSON object.`;

  const userPrompt = `Industry: ${industry}
Target postcodes/areas: ${postcodes.length ? postcodes.join(', ') : 'London (mixed)'}
Currently selected template: ${template}

Brief from the user:
${brief || '(no brief provided — write a flexible default that works for an estate-agency valuation pitch)'}

Generate one design concept. Pick the best template for the brief (you can override the user's selection if a different one fits better — explain why in rationale, one short sentence).

Return JSON only.`;

  let lastErrMsg = null;
  let json = null;
  let usedModel = null;

  for (const model of MODEL_FALLBACKS) {
    try {
      const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type':    'application/json',
          'x-api-key':       apiKey,
          'anthropic-version': ANTHROPIC_VERSION
        },
        body: JSON.stringify({
          model,
          max_tokens: 400,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }]
        })
      });
      if (!apiRes.ok) {
        const errText = await apiRes.text();
        let msg = `Anthropic ${apiRes.status}`;
        try {
          const errJson = JSON.parse(errText);
          if (errJson.error && errJson.error.message) msg = errJson.error.message;
        } catch { /* keep default */ }
        console.warn(`[ai-generate] model ${model} failed: ${msg}`);
        lastErrMsg = `${model}: ${msg}`;
        // Retry next model only for 404/400 (model not found / invalid). Bail on auth / quota.
        if ([401, 403, 429, 500, 503].includes(apiRes.status)) {
          return res.status(502).json({ error: msg });
        }
        continue; // try next model
      }
      json = await apiRes.json();
      usedModel = model;
      break;
    } catch (err) {
      console.error(`[ai-generate] network error for ${model}`, err);
      lastErrMsg = err.message;
    }
  }

  if (!json) {
    return res.status(502).json({ error: lastErrMsg || 'No model available' });
  }
  try {
    const text = (json.content && json.content[0] && json.content[0].text) || '';

    // Extract the JSON block (Claude usually returns clean JSON, but be defensive).
    let parsed;
    try {
      const match = text.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : null;
    } catch (e) {
      parsed = null;
    }
    if (!parsed || !parsed.headline) {
      console.error('[ai-generate] could not parse model output', text);
      return res.status(502).json({ error: 'AI returned unparseable output' });
    }

    // Light sanitisation
    const out = {
      headline:  String(parsed.headline || '').slice(0, 120),
      sub:       String(parsed.sub      || '').slice(0, 240),
      cta:       String(parsed.cta      || '').slice(0, 60),
      template:  ['bold','image','minimal'].includes(parsed.template) ? parsed.template : template,
      rationale: String(parsed.rationale || '').slice(0, 240),
      model:     usedModel
    };
    if (!out.cta.endsWith('→')) out.cta = out.cta.replace(/\s*[→>]+\s*$/, '').trim() + ' →';

    return res.status(200).json(out);
  } catch (err) {
    console.error('[ai-generate]', err);
    return res.status(500).json({ error: err.message || 'AI generation failed' });
  }
};
