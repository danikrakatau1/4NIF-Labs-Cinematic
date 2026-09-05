(() => {
  const nativeFetch = window.fetch.bind(window);

  async function r2PreviewSource(previewId) {
    const response = await nativeFetch(`/api/r2-preview-source?preview_id=${encodeURIComponent(previewId)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) return null;
    const data = await response.json().catch(() => null);
    return data?.success ? data : null;
  }

  async function generateR2Session(packageKey) {
    const response = await nativeFetch('/api/r2-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ package_key: packageKey })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) throw new Error(data?.message || `R2 session gagal (${response.status})`);
    return data;
  }

  async function publishR2Package(payload, publisherKey) {
    const response = await nativeFetch('/api/r2-publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-4n1f-publisher-key': publisherKey
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) throw new Error(data?.message || `R2 publish gagal (${response.status})`);
    return data;
  }

  window.FourNifR2Bridge = Object.freeze({
    storageEngine: 'r2',
    generateSession: generateR2Session,
    publishPackage: publishR2Package,
    loadPreviewSource: r2PreviewSource
  });

  // Non-breaking compatibility bridge:
  // The historical editor calls Supabase RPC get_lab_preview_source directly.
  // R2 Preview IDs are resolved locally first. If not found/configured, the
  // original Supabase request continues untouched, preserving legacy previews.
  window.fetch = async function fourNifDualStorageFetch(input, init = {}) {
    const url = typeof input === 'string' ? input : input?.url || '';
    const isLegacyPreviewRpc = /\/rest\/v1\/rpc\/get_lab_preview_source(?:\?|$)/.test(url);
    if (!isLegacyPreviewRpc) return nativeFetch(input, init);

    try {
      const rawBody = typeof init?.body === 'string' ? init.body : '';
      const parsed = rawBody ? JSON.parse(rawBody) : null;
      const previewId = String(parsed?.input_preview_id || '').trim();
      if (previewId) {
        const r2 = await r2PreviewSource(previewId);
        if (r2) {
          const legacyCompatibleRow = {
            success: true,
            message: 'R2 preview resolved.',
            preview_id: r2.preview_id,
            package_key: r2.package_key,
            package_hash: r2.package_hash,
            html_code: r2.html_code,
            css_code: r2.css_code,
            js_code: r2.js_code,
            storage_engine: 'r2'
          };
          return new Response(JSON.stringify([legacyCompatibleRow]), {
            status: 200,
            headers: { 'Content-Type': 'application/json; charset=utf-8' }
          });
        }
      }
    } catch (error) {
      console.debug('[4N1F R2] preview fallback to Supabase:', error?.message || error);
    }

    return nativeFetch(input, init);
  };
})();
