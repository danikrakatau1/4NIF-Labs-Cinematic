import crypto from 'node:crypto';
import { resolveR2Package } from '../server/r2-store.js';
import { savePreviewSession } from '../server/r2-session-store.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, message: 'Method not allowed.' });
  }

  try {
    const packageKey = String(req.body?.package_key || '').trim().toUpperCase();
    const pkg = await resolveR2Package(packageKey);
    if (!pkg) return res.status(404).json({ success: false, message: 'Package R2 tidak ditemukan.' });

    const preview_id = `p_${crypto.randomBytes(16).toString('hex')}`;
    await savePreviewSession(preview_id, packageKey);
    return res.status(200).json({ success: true, storage_engine: 'r2', package_key: packageKey, preview_id });
  } catch (error) {
    return res.status(500).json({ success: false, message: error?.message || 'Preview session gagal dibuat.' });
  }
}
