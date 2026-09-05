import { setPinned } from '../server/r2-store.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, message: 'Method not allowed.' });
  }

  const expected = String(process.env.LAB_PUBLISHER_KEY || '');
  const provided = String(req.headers['x-4n1f-publisher-key'] || '');
  if (!expected || !provided || provided !== expected) {
    return res.status(401).json({ success: false, message: 'Publisher access key tidak valid.' });
  }

  try {
    const packageKey = String(req.body?.package_key || '').trim().toUpperCase();
    const result = await setPinned(packageKey, req.body?.pinned === true);
    if (!result) return res.status(404).json({ success: false, message: 'Package R2 tidak ditemukan.' });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error?.message || 'Gagal mengubah status PIN.' });
  }
}
