import { publishR2Package } from '../server/r2-store.js';

function deny(res, status, message) {
  return res.status(status).json({ success: false, message });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return deny(res, 405, 'Method not allowed.');
  }

  const expected = String(process.env.LAB_PUBLISHER_KEY || '');
  const provided = String(req.headers['x-4n1f-publisher-key'] || '');
  if (!expected || !provided || provided !== expected) {
    return deny(res, 401, 'Publisher access key tidak valid.');
  }

  try {
    const body = req.body || {};
    const result = await publishR2Package({
      project_name: body.project_name || '4NIF-Labs-Cinematic',
      version: body.version || 'draft',
      html_code: body.html_code,
      css_code: body.css_code,
      js_code: body.js_code,
      pinned: body.pinned === true
    });
    return res.status(200).json(result);
  } catch (error) {
    return deny(res, 500, error?.message || 'R2 publisher error.');
  }
}
