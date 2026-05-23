// Lazy Stripe client init. Returns null if the env var is missing or still
// holds the placeholder so the rest of the route can return a graceful 503
// rather than crashing the lambda.

let _stripe = null;

function getStripe() {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key === 'sk_test_REPLACE_ME' || !key.startsWith('sk_')) {
    return null;
  }
  // Require here so the SDK only loads when actually needed.
  const Stripe = require('stripe');
  _stripe = new Stripe(key, {
    apiVersion: '2024-06-20',
    appInfo: { name: 'outra-directmail', version: '0.1.0' }
  });
  return _stripe;
}

module.exports = { getStripe };
