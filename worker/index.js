const DEFAULT_PROJECT = '4n1f-labs-cinematic';
const DEFAULT_RETENTION = 500;
const MAX_PACKAGE_BYTES = 20 * 1024 * 1024;
const PREVIEW_TTL_SECONDS = 60 * 60 * 24 * 7;

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
};

export default {
  async fetch(request, env) {
    try {
      if (!env.PACKAGES) {
        return reply({ success: false, message: 'KV binding PACKAGES belum terpasang.' }, 503, request, env);
      }

      const url = new URL(request.url);
      const method = request.method.toUpperCase();

      if (method === 'OPTIONS') return preflight(request, env);

      if (method === 'GET' && url.pathname === '/health') {
        return reply({
          success: true,
          service: '4n1f-kv-api',
          storage_engine: 'cloudflare-kv',
          schema: '4n1f-kv-v1'
        }, 200, request, env);
      }

      if (method === 'POST' && url.pathname === '/publish') {
        requirePublisher(request, env);
        const body = await readJson(request);
        const result = await publishPackage(env, body);
        return reply(result, 200, request, env);
      }

      if (method === 'POST' && url.pathname === '/session') {
        requireAllowedOrigin(request, env);
        const body = await readJson(request);
        const result = await createPreviewSession(env, body?.package_key);
        return reply(result, 200, request, env);
      }

      const previewMatch = url.pathname.match(/^\/preview\/(p_[a-f0-9]{32})$/i);
      if (method === 'GET' && previewMatch) {
        const result = await resolvePreview(env, previewMatch[1]);
        if (!result) return reply({ success: false, message: 'Preview tidak ditemukan atau sudah kedaluwarsa.' }, 404, request, env);
        return reply({ success: true, ...result }, 200, request, env);
      }

      const packageMatch = url.pathname.match(/^\/package\/(4N1F_[A-F0-9]{12})$/i);
      if (method === 'GET' && packageMatch) {
        const pkg = await getPackage(env, packageMatch[1]);
        if (!pkg) return reply({ success: false, message: 'Package tidak ditemukan.' }, 404, request, env);
        return reply({ success: true, ...publicPackage(pkg) }, 200, request, env);
      }

      if (method === 'POST' && url.pathname === '/pin') {
        requirePublisher(request, env);
        const body = await readJson(request);
        const result = await setPinned(env, body?.package_key, Boolean(body?.pinned));
        if (!result) return reply({ success: false, message: 'Package tidak ditemukan.' }, 404, request, env);
        return reply({ success: true, ...result }, 200, request, env);
      }

      if (method === 'GET' && url.pathname === '/stats') {
        requirePublisher(request, env);
        const project = safeProject(url.searchParams.get('project') || DEFAULT_PROJECT);
        const index = await getProjectIndex(env, project);
        return reply({ success: true, storage_engine: 'cloudflare-kv', ...projectStats(index) }, 200, request, env);
      }

      if (method === 'POST' && url.pathname === '/cleanup') {
        requirePublisher(request, env);
        const body = await readJson(request);
        const project = safeProject(body?.project_name || DEFAULT_PROJECT);
        const limit = normalizeRetention(body?.limit ?? env.RETENTION_LIMIT);
        const result = await enforceRetention(env, project, limit);
        return reply({ success: true, ...result }, 200, request, env);
      }

      return reply({
        success: false,
        message: 'Route tidak ditemukan.',
        routes: ['GET /health', 'POST /publish', 'POST /session', 'GET /preview/:id', 'GET /package/:key', 'POST /pin', 'GET /stats', 'POST /cleanup']
      }, 404, request, env);
    } catch (error) {
      const status = Number(error?.status || 500);
      return reply({ success: false, message: error?.message || 'Internal Worker error.' }, status, request, env);
    }
  }
};

async function publishPackage(env, input = {}) {
  const project = safeProject(input.project_name || DEFAULT_PROJECT);
  const version = String(input.version || 'draft').trim().slice(0, 100) || 'draft';
  const html_code = String(input.html_code || '');
  const css_code = String(input.css_code || '');
  const js_code = String(input.js_code || '');

  if (!html_code.trim()) throw httpError(400, 'html_code wajib diisi.');

  const package_size_bytes = byteLength(JSON.stringify({ html_code, css_code, js_code }));
  if (package_size_bytes > MAX_PACKAGE_BYTES) {
    throw httpError(413, `Package terlalu besar. Maksimal ${Math.floor(MAX_PACKAGE_BYTES / 1024 / 1024)} MiB untuk engine KV ini.`);
  }

  const package_hash = await sourceHash(html_code, css_code, js_code);
  const index = await getProjectIndex(env, project);
  const duplicate = index.items.find((item) => item.package_hash === package_hash);

  if (duplicate) {
    return {
      success: true,
      storage_engine: 'cloudflare-kv',
      deduplicated: true,
      package_key: duplicate.package_key,
      package_hash,
      package_size_bytes: duplicate.package_size_bytes,
      project,
      version: duplicate.version,
      pinned: Boolean(duplicate.pinned),
      cleanup: { limit: normalizeRetention(env.RETENTION_LIMIT), before: index.items.length, deleted: 0, after: index.items.length }
    };
  }

  const package_key = makePackageKey();
  const created_at = new Date().toISOString();
  const pinned = Boolean(input.pinned);

  const pkg = {
    schema: '4n1f-kv-package-v1',
    storage_engine: 'cloudflare-kv',
    package_key,
    project,
    version,
    package_hash,
    package_size_bytes,
    created_at,
    html_code,
    css_code,
    js_code
  };

  await env.PACKAGES.put(packageStorageKey(package_key), JSON.stringify(pkg));

  index.items.push({
    package_key,
    package_hash,
    package_size_bytes,
    version,
    created_at,
    pinned
  });
  index.updated_at = created_at;

  const limit = normalizeRetention(env.RETENTION_LIMIT);
  const cleanup = await trimIndexAndDelete(env, index, limit);
  await saveProjectIndex(env, index);

  return {
    success: true,
    storage_engine: 'cloudflare-kv',
    deduplicated: false,
    package_key,
    package_hash,
    package_size_bytes,
    project,
    version,
    pinned,
    cleanup
  };
}

async function createPreviewSession(env, packageKey) {
  const package_key = normalizePackageKey(packageKey);
  const pkg = await getPackage(env, package_key);
  if (!pkg) throw httpError(404, 'Package tidak ditemukan.');

  const preview_id = `p_${randomHex(16).toLowerCase()}`;
  const session = {
    schema: '4n1f-kv-preview-v1',
    preview_id,
    package_key,
    created_at: new Date().toISOString()
  };

  await env.PACKAGES.put(previewStorageKey(preview_id), JSON.stringify(session), {
    expirationTtl: PREVIEW_TTL_SECONDS
  });

  return {
    success: true,
    storage_engine: 'cloudflare-kv',
    package_key,
    preview_id,
    expires_in: PREVIEW_TTL_SECONDS
  };
}

async function resolvePreview(env, previewId) {
  const preview_id = String(previewId || '').trim().toLowerCase();
  const raw = await env.PACKAGES.get(previewStorageKey(preview_id));
  if (!raw) return null;

  let session;
  try { session = JSON.parse(raw); } catch { return null; }
  const pkg = await getPackage(env, session.package_key);
  if (!pkg) return null;

  return {
    storage_engine: 'cloudflare-kv',
    preview_id,
    package_key: pkg.package_key,
    project: pkg.project,
    version: pkg.version,
    package_hash: pkg.package_hash,
    created_at: pkg.created_at,
    html_code: pkg.html_code,
    css_code: pkg.css_code,
    js_code: pkg.js_code
  };
}

async function getPackage(env, packageKey) {
  let package_key;
  try { package_key = normalizePackageKey(packageKey); } catch { return null; }
  const raw = await env.PACKAGES.get(packageStorageKey(package_key));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function setPinned(env, packageKey, pinned) {
  const package_key = normalizePackageKey(packageKey);
  const pkg = await getPackage(env, package_key);
  if (!pkg) return null;

  const index = await getProjectIndex(env, pkg.project);
  const item = index.items.find((entry) => entry.package_key === package_key);
  if (!item) return null;

  item.pinned = Boolean(pinned);
  index.updated_at = new Date().toISOString();
  await saveProjectIndex(env, index);

  return { package_key, project: pkg.project, pinned: Boolean(pinned) };
}

async function enforceRetention(env, project, limit) {
  const index = await getProjectIndex(env, project);
  const cleanup = await trimIndexAndDelete(env, index, limit);
  index.updated_at = new Date().toISOString();
  await saveProjectIndex(env, index);
  return { project, ...cleanup };
}

async function trimIndexAndDelete(env, index, limit) {
  const before = index.items.length;
  if (before <= limit) return { limit, before, deleted: 0, after: before, pinned_preserved: true };

  index.items.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  let over = index.items.length - limit;
  const survivors = [];
  const deleteKeys = [];

  for (const item of index.items) {
    if (over > 0 && !item.pinned) {
      deleteKeys.push(item.package_key);
      over -= 1;
    } else {
      survivors.push(item);
    }
  }

  for (const package_key of deleteKeys) {
    await env.PACKAGES.delete(packageStorageKey(package_key));
  }

  index.items = survivors;
  return {
    limit,
    before,
    deleted: deleteKeys.length,
    after: survivors.length,
    pinned_preserved: true,
    overflow_due_to_pins: Math.max(0, survivors.length - limit)
  };
}

async function getProjectIndex(env, project) {
  const raw = await env.PACKAGES.get(projectIndexKey(project));
  if (!raw) {
    return {
      schema: '4n1f-kv-project-index-v1',
      project,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: []
    };
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.items)) parsed.items = [];
    parsed.project = project;
    return parsed;
  } catch {
    throw httpError(500, 'Project index KV rusak/tidak valid JSON.');
  }
}

async function saveProjectIndex(env, index) {
  await env.PACKAGES.put(projectIndexKey(index.project), JSON.stringify(index));
}

function projectStats(index) {
  const bytes = index.items.reduce((total, item) => total + Number(item.package_size_bytes || 0), 0);
  const pinned = index.items.filter((item) => item.pinned).length;
  return {
    project: index.project,
    snapshots: index.items.length,
    pinned,
    bytes,
    retention_limit: DEFAULT_RETENTION,
    newest: index.items.length ? index.items[index.items.length - 1].created_at : null
  };
}

function publicPackage(pkg) {
  return {
    storage_engine: pkg.storage_engine,
    package_key: pkg.package_key,
    project: pkg.project,
    version: pkg.version,
    package_hash: pkg.package_hash,
    package_size_bytes: pkg.package_size_bytes,
    created_at: pkg.created_at,
    html_code: pkg.html_code,
    css_code: pkg.css_code,
    js_code: pkg.js_code
  };
}

async function sourceHash(html, css, js) {
  const bytes = new TextEncoder().encode(`${html}\u0000${css}\u0000${js}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function makePackageKey() {
  return `4N1F_${randomHex(6)}`;
}

function randomHex(byteCount) {
  const bytes = new Uint8Array(byteCount);
  crypto.getRandomValues(bytes);
  return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function normalizePackageKey(value) {
  const key = String(value || '').trim().toUpperCase();
  if (!/^4N1F_[A-F0-9]{12}$/.test(key)) throw httpError(400, 'Format package_key tidak valid.');
  return key;
}

function safeProject(value) {
  const slug = String(value || DEFAULT_PROJECT)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || DEFAULT_PROJECT;
}

function normalizeRetention(value) {
  const n = Number(value || DEFAULT_RETENTION);
  if (!Number.isFinite(n)) return DEFAULT_RETENTION;
  return Math.max(1, Math.min(500, Math.floor(n)));
}

function packageStorageKey(key) { return `pkg:${key}`; }
function previewStorageKey(id) { return `preview:${id.toLowerCase()}`; }
function projectIndexKey(project) { return `project:${project}:index`; }

async function readJson(request) {
  try { return await request.json(); }
  catch { throw httpError(400, 'Body harus berupa JSON valid.'); }
}

function requirePublisher(request, env) {
  const expected = String(env.PUBLISH_TOKEN || '').trim();
  if (!expected) throw httpError(503, 'PUBLISH_TOKEN belum dikonfigurasi sebagai Worker secret.');
  const supplied = String(request.headers.get('x-4n1f-publisher-key') || '').trim();
  if (!constantTimeishEqual(supplied, expected)) throw httpError(401, 'Publisher key tidak valid.');
}

function requireAllowedOrigin(request, env) {
  const origin = request.headers.get('origin');
  if (!origin) return;
  if (!allowedOrigins(env).has(origin)) throw httpError(403, 'Origin tidak diizinkan.');
}

function allowedOrigins(env) {
  const configured = String(env.ALLOWED_ORIGINS || 'https://project-s9uok.vercel.app')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return new Set(configured);
}

function constantTimeishEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function isPublicRead(request) {
  if (request.method.toUpperCase() !== 'GET') return false;
  const pathname = new URL(request.url).pathname;
  return pathname === '/health' || /^\/preview\/p_[a-f0-9]{32}$/i.test(pathname) || /^\/package\/4N1F_[A-F0-9]{12}$/i.test(pathname);
}

function corsHeaders(request, env) {
  const origin = request.headers.get('origin');
  const headers = {
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,x-4n1f-publisher-key',
    'access-control-max-age': '86400',
    vary: 'Origin'
  };
  if (isPublicRead(request)) headers['access-control-allow-origin'] = '*';
  else if (origin && allowedOrigins(env).has(origin)) headers['access-control-allow-origin'] = origin;
  return headers;
}

function preflight(request, env) {
  const origin = request.headers.get('origin');
  if (origin && !allowedOrigins(env).has(origin)) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

function reply(payload, status, request, env) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...jsonHeaders, ...corsHeaders(request, env) }
  });
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function byteLength(text) {
  return new TextEncoder().encode(text).byteLength;
}
