// POST /api/webhook
// Receives Stripe webhook events for this project.
//
// Configure in the Stripe dashboard:
//   1. Webhooks → Add endpoint
//   2. URL: https://<your-deployment>.vercel.app/api/webhook
//      (or https://outra.vip/signature-segments/DirectMail/api/webhook
//       if/when proxied via outra.vip — note this path is NOT currently
//       in the ecc-outra rewrites; webhooks should hit the .vercel.app
//       URL directly for reliability.)
//   3. Listen for: checkout.session.completed, setup_intent.succeeded
//   4. Copy the signing secret into STRIPE_WEBHOOK_SECRET on Vercel.
//
// Required env vars:
//   STRIPE_SECRET_KEY
//   STRIPE_WEBHOOK_SECRET

const { getStripe } = require('./lib/stripe-client');

// Stripe requires the raw request body for signature verification.
module.exports.config = {
  api: { bodyParser: false }
};

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method not allowed');
  }

  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    console.warn('[webhook] missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET');
    return res.status(503).send('Webhook not configured.');
  }

  let event;
  try {
    const raw = await readRawBody(req);
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    console.error('[webhook] signature verification failed', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        // Setup mode: we now have a SetupIntent → payment method attached to
        // a customer (if you opted to create one). For this prototype we just
        // log; production should:
        //   • Create the Stripe Customer if one wasn't created during checkout
        //   • Persist (customer, payment_method, session.metadata) to Airtable
        //   • Kick off the first DM batch
        console.log('[webhook] checkout.session.completed', {
          id: session.id,
          customer: session.customer,
          setup_intent: session.setup_intent,
          metadata: session.metadata
        });
        // TODO(production):
        //   await persistSubscriptionToAirtable({ session });
        //   await scheduleFirstBatch({ session });
        break;
      }
      case 'setup_intent.succeeded': {
        const intent = event.data.object;
        console.log('[webhook] setup_intent.succeeded', { id: intent.id, customer: intent.customer });
        break;
      }
      default:
        // Ignore other events but ack.
        break;
    }
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[webhook] handler error', err);
    return res.status(500).send('Webhook handler error');
  }
};
