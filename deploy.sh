#!/usr/bin/env bash
# Deploy outra-directmail to Vercel.
# Run from the project root: ./deploy.sh
#
# First-time setup (run once):
#   1. vercel link            # link this folder to a new Vercel project
#   2. Set env vars in the Vercel dashboard:
#        STRIPE_SECRET_KEY        sk_test_...    (or sk_live_...)
#        STRIPE_WEBHOOK_SECRET    whsec_...
#        BLOB_READ_WRITE_TOKEN    auto-set by Storage → Blob → Connect
#   3. Enable Vercel Blob: Project → Storage → Blob → Connect Store
#   4. ./deploy.sh

set -euo pipefail

echo "→ Installing deps (Vercel will also install during build)…"
npm install --silent

echo "→ Deploying production…"
vercel --prod --yes

echo
echo "✓ Deployed. Now verify:"
echo "   curl -I https://outra-directmail.vercel.app/"
echo
echo "→ If wired into outra.vip via ecc-outra-event-fresh/vercel.json, also:"
echo "   curl -I https://outra.vip/signature-segments/DirectMail"
echo
echo "→ Don't forget to also redeploy ecc-outra-event-fresh after the routing edit:"
echo "   (cd ../../ClaudeCode/ecc-outra-event-fresh && vercel --prod --yes)"
