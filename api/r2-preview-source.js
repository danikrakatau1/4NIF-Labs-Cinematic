import { resolveR2Package } from '../server/r2-store.js';
import { resolvePreviewSession } from '../server/r2-session-store.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, message: 'Method not allowed.' });
  }

  try {
    const previewId = String(req.query?.preview_id || '').trim();
    const session = await resolvePreviewSession(previewId);
    if (!session?.package_key) {
      return res.status(404).json({ success: false, message: 'Preview ID R2 tidak ditemukan.' });
    }

    const pkg = await resolveR2Package(session.package_key);
    if (!pkg) return res.status(404).json({ success: false, message: 'Source package R2 tidak ditemukan.' });

    return res.status(200).json({
      success: true,
      storage_engine: 'r2',
      preview_id: previewId,
      package_key: pkg.package_key,
      project: pkg.project,
      version: pkg.version,
      package_hash: pkg.package_hash,
      html_code: pkg.html_code,
      css_code: pkg.css_code,
      js_code: pkg.js_code
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error?.message || 'R2 preview resolver error.' });
  }
}
