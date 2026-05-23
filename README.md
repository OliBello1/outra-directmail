# Outra Direct Mail — subscription funnel

A 4-step conversion-optimised signup flow for Outra's direct mail product.
Postcode picker → phone capture → DM design builder → Stripe-backed card capture.

**Live URL (target):** `https://outra.vip/signature-segments/DirectMail`

## What's in here

```
outra-directmail/
├── package.json
├── vercel.json                       # Function config + path rewrites
├── public/
│   ├── index.html                    # Single-page funnel
│   ├── success.html                  # Post-checkout confirmation
│   ├── styles.css                    # Dark/premium Outra theme
│   ├── app.js                        # Funnel state machine
│   └── data/postcodes.js             # 75 London postcodes + DM/wk
└── api/
    ├── create-checkout-session.js    # Stripe Checkout (setup mode)
    ├── upload.js                     # Vercel Blob client-upload token
    ├── webhook.js                    # Stripe webhook receiver
    └── lib/stripe-client.js          # Lazy SDK init w/ env-var gating
```

## Local development

```bash
# 1. Install deps
npm install

# 2. Pull env vars from Vercel (after the project is linked)
vercel link        # one-time
vercel env pull .env.local

# 3. Run the dev server
npm run dev        # → vercel dev (serves both static + serverless functions)
```

Without env vars, Stripe & Vercel Blob endpoints return graceful 503s and the
frontend falls back to local data-URL previews for uploads.

## Required env vars (set on the Vercel project)

| Variable | Where to get it | Used by |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys (sk_test_… / sk_live_…) | `api/create-checkout-session.js`, `api/webhook.js` |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Developers → Webhooks → endpoint → "Signing secret" (whsec_…) | `api/webhook.js` |
| `BLOB_READ_WRITE_TOKEN` | Auto-set when you enable Vercel Blob on the project (Storage → Blob → Connect) | `api/upload.js` |
| `PUBLIC_BASE_URL` *(optional)* | e.g. `https://outra.vip` — overrides redirect origin if you proxy via outra.vip | `api/create-checkout-session.js` |

**Where to paste keys for testing:** drop them into the Vercel project's
Environment Variables tab (Production / Preview / Development as needed) and
redeploy. For local dev, `vercel env pull .env.local` after setting them.

## Stripe model

This prototype uses **Checkout in `setup` mode**: the user adds a card but is
charged **£0 today**. Their selections (postcodes, cap, design brief, etc.)
are stashed in the Checkout Session's metadata. Production billing should:

1. Persist the captured `customer` + `payment_method` + metadata to your
   datastore (Airtable / DB).
2. Track actual DM sends per customer per month.
3. Above the free 10 DMs, generate invoices using the tiered pricing
   (£1.50 → £1.00 per DM) up to the user's monthly cap.
4. Refuse to ship beyond the cap; surface a notice in the dashboard.

The webhook handler at `api/webhook.js` has TODO comments marking exactly
where to wire those steps in.

## Pricing tiers (single source of truth: `public/app.js` `TIERS`)

| DMs / month | Per DM |
| --- | --- |
| 1 – 10 | **Free trial** |
| 11 – 50 | £1.50 |
| 51 – 100 | £1.40 |
| 101 – 200 | £1.30 |
| 201+ | £1.00 |

Costs are **tiered** (not bracketed) — sending 60 DMs costs
`(40 × £1.50) + (10 × £1.40) = £74.00` after the free 10.

## Deploy

```bash
# From this directory:
vercel --prod --yes
```

After first deploy:

1. Set the env vars above in the Vercel dashboard, then redeploy.
2. Enable Vercel Blob storage on the project (Storage → Blob → Connect).
3. Add the Stripe webhook in the Stripe dashboard pointing to:
   `https://<your-deployment>.vercel.app/api/webhook`
   Listen for `checkout.session.completed` and `setup_intent.succeeded`.
4. Copy the webhook signing secret back into `STRIPE_WEBHOOK_SECRET` and
   redeploy once more.

### Wiring up to `outra.vip/signature-segments/DirectMail`

The existing `ecc-outra-event-fresh` project owns `outra.vip` and currently
proxies `/signature-segments/*` to `outra-segments-site.vercel.app`. To make
this funnel reachable at `outra.vip/signature-segments/DirectMail` we need a
**more-specific** rewrite added **above** that wildcard. The diff is in
`../../ClaudeCode/ecc-outra-event-fresh/vercel.json`:

```jsonc
{
  "rewrites": [
    // NEW — must come before the existing wildcard
    { "source": "/signature-segments/DirectMail",          "destination": "https://outra-directmail.vercel.app/" },
    { "source": "/signature-segments/DirectMail/:path*",   "destination": "https://outra-directmail.vercel.app/:path*" },
    { "source": "/signature-segments/directmail",          "destination": "https://outra-directmail.vercel.app/" },
    { "source": "/signature-segments/directmail/:path*",   "destination": "https://outra-directmail.vercel.app/:path*" },
    // …existing wildcard rule that proxies the rest to outra-segments-site
  ]
}
```

After deploying both projects, verify:

```bash
curl -I https://outra-directmail.vercel.app/
curl -I https://outra.vip/signature-segments/DirectMail
```

Both should return `200 OK`. Don't say "live" until they do **and** a full
test-mode Checkout round-trip works end-to-end.

## Notes on data integrations

- **Postcode dataset** (`public/data/postcodes.js`) is a hand-picked mock of
  75 London postcodes with stable per-postcode DM/week estimates between
  100–200. Swap for a real lookup (postcodes.io or an internal Outra
  dataset) before launch.
- **AI Generate** button on Step 3 is a deterministic stub — no LLM call.
  Wire it to your preferred model (Anthropic, OpenAI) behind a new
  `api/ai-generate.js` route.
- **Webhook** currently just logs events. See TODO markers for production
  wiring (Airtable persistence, SMS confirmation, first-batch scheduling).
