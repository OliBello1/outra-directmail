// POST /api/create-checkout-session
// Creates a Stripe Checkout Session in `setup` mode — captures the customer's
// card without charging today. Postcodes, cap, design brief, etc. are stashed
// in session metadata so the post-checkout webhook (and any later usage-based
// invoicing) can reconstruct the subscription configuration.
//
// Required env vars:
//   STRIPE_SECRET_KEY   — sk_test_... or sk_live_...
//
// Optional:
//   PUBLIC_BASE_URL     — overrides the origin used in the success/cancel URLs
//                         (useful when this is proxied via outra.vip rewrites)

const { getStripe } = require('./lib/stripe-client');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripe = getStripe();
  if (!stripe) {
    return res.status(503).json({
      error: 'Stripe is not configured. Set STRIPE_SECRET_KEY on the Vercel project (use a sk_test_ key for testing).'
    });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const { postcodes = [], phone = '', cap = {}, design = {}, weeklyEst = 0 } = body;

  if (!Array.isArray(postcodes) || postcodes.length === 0) {
    return res.status(400).json({ error: 'At least one postcode must be selected.' });
  }
  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required.' });
  }

  // Resolve the base URL — prefer the env var (e.g. https://outra.vip), else the request origin.
  // The success/cancel URLs route through the outra.vip rewrites if available.
  const origin =
    process.env.PUBLIC_BASE_URL ||
    (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-host']
      ? `${req.headers['x-forwarded-proto']}://${req.headers['x-forwarded-host']}`
      : `https://${req.headers.host}`);

  // Detect whether we're being served under /signature-segments/DirectMail
  // so the redirect comes back to the same path the user came from.
  const referer = req.headers.referer || '';
  const isUnderOutraVip = referer.includes('/signature-segments/DirectMail') || referer.includes('/signature-segments/directmail');
  const successBase = isUnderOutraVip
    ? `${new URL(referer).origin}/signature-segments/DirectMail/success`
    : `${origin}/success.html`;
  const cancelBase = isUnderOutraVip
    ? `${new URL(referer).origin}/signature-segments/DirectMail`
    : `${origin}/`;

  // Stripe metadata values are capped at 500 chars per value and 50 keys per object.
  const safe = (v, max = 500) => {
    const s = typeof v === 'string' ? v : JSON.stringify(v ?? '');
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
  };

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'setup',
      payment_method_types: ['card'],
      success_url: `${successBase}?sid={CHECKOUT_SESSION_ID}`,
      cancel_url:  cancelBase,
      // We deliberately do NOT pre-fill customer_email — let Stripe ask in-flow.
      metadata: {
        postcodes:       safe(postcodes.join(',')),
        postcode_count:  String(postcodes.length),
        weekly_est:      String(weeklyEst),
        phone:           safe(phone, 32),
        cap_mode:        safe(cap.mode || 'dms', 16),
        cap_value:       String(cap.value ?? ''),
        template:        safe(design.template || '', 32),
        brief:           safe(design.brief || '', 480),
        logo_url:        safe(design.logoUrl || '', 480),
        artwork_url:     safe(design.artworkUrl || '', 480),
        headline:        safe(design.headline || '', 120),
        sub:             safe(design.sub || '', 240)
      }
    });

    return res.status(200).json({ id: session.id, url: session.url });
  } catch (err) {
    console.error('[create-checkout-session]', err);
    return res.status(500).json({
      error: err.message || 'Failed to create checkout session.'
    });
  }
};
