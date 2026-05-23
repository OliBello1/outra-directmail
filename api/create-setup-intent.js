// POST /api/create-setup-intent
// Creates a Stripe SetupIntent (no charge today — just captures the card
// for future off-session billing).
//
// Required env vars:
//   STRIPE_SECRET_KEY    sk_test_...

const { getStripe } = require('./lib/stripe-client');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripe = getStripe();
  if (!stripe) {
    return res.status(503).json({
      error: 'Stripe is not configured. Set STRIPE_SECRET_KEY on the Vercel project.'
    });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  const { email = '', postcodes = [], cap = {}, design = {} } = body;

  const safe = (v, max = 500) => {
    const s = typeof v === 'string' ? v : JSON.stringify(v ?? '');
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
  };

  try {
    // Create-or-find customer by email (lightweight; production would dedupe properly).
    let customer = null;
    if (email) {
      const existing = await stripe.customers.list({ email, limit: 1 });
      customer = existing.data[0] || await stripe.customers.create({
        email,
        metadata: { source: 'outra-directmail' }
      });
    }

    const intent = await stripe.setupIntents.create({
      payment_method_types: ['card'],
      customer: customer ? customer.id : undefined,
      usage: 'off_session',
      metadata: {
        postcodes:       safe(Array.isArray(postcodes) ? postcodes.join(',') : ''),
        postcode_count:  String(Array.isArray(postcodes) ? postcodes.length : 0),
        email:           safe(email, 120),
        cap_mode:        safe(cap.mode || 'dms', 16),
        cap_value:       String(cap.value ?? ''),
        template:        safe(design.template || '', 32),
        brief:           safe(design.brief || '', 480),
        headline:        safe(design.headline || '', 120)
      }
    });

    return res.status(200).json({
      clientSecret: intent.client_secret,
      customerId: customer ? customer.id : null
    });
  } catch (err) {
    console.error('[create-setup-intent]', err);
    return res.status(500).json({ error: err.message || 'Failed to create setup intent.' });
  }
};
