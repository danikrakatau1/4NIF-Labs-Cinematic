const WORKER_URL = 'https://4n1f-kv-api.faqihanif12282000.workers.dev';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, message: 'Method not allowed.' });
  }

  try {
    const packageKey = String(req.body?.package_key || '').trim().toUpperCase();
    if (!/^4N1F_[A-F0-9]{12}$/.test(packageKey)) {
      return res.status(400).json({ success: false, message: 'Format Package Key tidak valid.' });
    }

    const upstream = await fetch(`${WORKER_URL}/session`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json'
      },
      body: JSON.stringify({ package_key: packageKey })
    });

    const data = await upstream.json().catch(() => null);
    if (!upstream.ok || !data?.success) {
      return res.status(upstream.status || 502).json({
        success: false,
        message: data?.message || `KV session gagal (${upstream.status}).`
      });
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(data);
  } catch (error) {
    return res.status(502).json({ success: false, message: error?.message || 'KV Worker tidak dapat dihubungi.' });
  }
}
