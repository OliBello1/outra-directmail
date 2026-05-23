// Vercel Blob client-upload token endpoint.
// The frontend uses @vercel/blob/client `upload(...)` which calls this route
// with a payload to mint a signed upload URL. The actual bytes never touch
// our serverless function — they go straight from the browser to Vercel Blob.
//
// Required env var:
//   BLOB_READ_WRITE_TOKEN  — auto-provisioned by Vercel when you enable Blob
//                            on the project. Locally, run `vercel env pull`.

let _handleUpload = null;
function getHandler() {
  if (_handleUpload) return _handleUpload;
  try {
    ({ handleUpload: _handleUpload } = require('@vercel/blob/client'));
  } catch (err) {
    _handleUpload = null;
  }
  return _handleUpload;
}

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const handleUpload = getHandler();
  if (!handleUpload) {
    return res.status(503).json({
      error: '@vercel/blob is not installed or BLOB_READ_WRITE_TOKEN is missing. The frontend will fall back to a local data-URL preview.'
    });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname /*, clientPayload */) => {
        // Validate the pathname is under our directmail/ namespace.
        if (!pathname.startsWith('directmail/')) {
          throw new Error('Uploads must live under directmail/');
        }
        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: 5 * 1024 * 1024,
          tokenPayload: JSON.stringify({ pathname })
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Hook for future Airtable writes or audit logging.
        console.log('[upload] blob completed', { url: blob.url, tokenPayload });
      }
    });
    return res.status(200).json(json);
  } catch (err) {
    console.error('[upload]', err);
    return res.status(400).json({ error: err.message || 'Upload failed.' });
  }
};
