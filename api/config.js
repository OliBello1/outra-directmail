// GET /api/config
// Returns publicly-safe configuration values for the frontend.
// The Stripe PUBLISHABLE key is safe to expose to the browser — it can only
// create tokens, not charge or read data. The SECRET key never goes through
// this route.

module.exports = (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return res.status(200).json({
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    // Whether real Stripe Elements should mount (vs the placeholder preview).
    stripeReady: Boolean(process.env.STRIPE_PUBLISHABLE_KEY && process.env.STRIPE_SECRET_KEY)
  });
};
