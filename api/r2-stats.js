import { projectStats } from '../server/r2-store.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, message: 'Method not allowed.' });
  }

  const expected = String(process.env.LAB_PUBLISHER_KEY || '');
  const provided = String(req.headers['x-4n1f-publisher-key'] || '');
  if (!expected || !provided || provided !== expected) {
    return res.status(401).json({ success: false, message: 'Publisher access key tidak valid.' });
  }

  try {
    const stats = await projectStats(req.query?.project || '4NIF-Labs-Cinematic');
    return res.status(200).json({ success: true, retention_limit: Number(process.env.R2_RETENTION_LIMIT || 500), ...stats });
  } catch (error) {
    return res.status(500).json({ success: false, message: error?.message || 'Gagal membaca statistik R2.' });
  }
}
