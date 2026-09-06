(() => {
  'use strict';

  const input = document.getElementById('previewIdInput');
  const button = document.getElementById('generatePreviewBtn');
  const toast = document.getElementById('toast');
  if (!input || !button) return;

  let toastTimer = 0;
  function notify(message, type = 'success') {
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = `show ${type}`;
    toastTimer = setTimeout(() => { toast.className = ''; }, 2600);
  }

  function openPreview(previewId, popup) {
    const url = `/${encodeURIComponent(previewId)}`;
    if (popup && !popup.closed) {
      popup.location.replace(url);
    } else {
      window.open(url, '_blank', 'noopener');
    }
  }

  async function generateFromPackage(packageKey, popup) {
    const response = await fetch('/api/kv-session', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json'
      },
      body: JSON.stringify({ package_key: packageKey })
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success || !data?.preview_id) {
      throw new Error(data?.message || `Generate Preview gagal (${response.status}).`);
    }

    input.value = data.preview_id;
    notify(`Preview dibuat: ${data.preview_id}`);
    openPreview(data.preview_id, popup);
  }

  button.addEventListener('click', async () => {
    const value = String(input.value || '').trim();

    if (/^p_[a-f0-9]{32}$/i.test(value)) {
      openPreview(value.toLowerCase());
      return;
    }

    if (!/^4N1F_[A-F0-9]{12}$/i.test(value)) {
      notify('Masukkan Package Key 4N1F_XXXXXXXXXXXX atau Preview ID p_…', 'error');
      input.focus();
      return;
    }

    const popup = window.open('about:blank', '_blank');
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'Generating…';

    try {
      await generateFromPackage(value.toUpperCase(), popup);
    } catch (error) {
      try { popup?.close(); } catch {}
      notify(error?.message || 'Generate Preview gagal.', 'error');
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  });
})();
