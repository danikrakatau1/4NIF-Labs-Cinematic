const WORKER_URL = 'https://4n1f-kv-api.faqihanif12282000.workers.dev';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, message: 'Method not allowed.' });
  }

  try {
    const previewId = String(req.query?.preview_id || '').trim().toLowerCase();
    if (!/^p_[a-f0-9]{32}$/.test(previewId)) {
      return res.status(400).json({ success: false, message: 'Format Preview ID tidak valid.' });
    }

    const upstream = await fetch(`${WORKER_URL}/preview/${encodeURIComponent(previewId)}`, {
      method: 'GET',
      headers: { accept: 'application/json' }
    });

    const data = await upstream.json().catch(() => null);
    if (!upstream.ok || !data?.success) {
      return res.status(upstream.status || 502).json({
        success: false,
        message: data?.message || `KV preview gagal (${upstream.status}).`
      });
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(data);
  } catch (error) {
    return res.status(502).json({ success: false, message: error?.message || 'KV Worker tidak dapat dihubungi.' });
  }
}
