import crypto from 'node:crypto';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command
} from '@aws-sdk/client-s3';

const DEFAULT_RETENTION = 500;

function requireEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function config() {
  const accountId = requireEnv('R2_ACCOUNT_ID');
  return {
    accountId,
    accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
    secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
    bucket: requireEnv('R2_BUCKET_NAME'),
    endpoint: String(process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`).replace(/\/$/, '')
  };
}

let cachedClient = null;
let cachedConfig = null;

function getClient() {
  if (cachedClient) return { client: cachedClient, cfg: cachedConfig };
  const cfg = config();
  cachedConfig = cfg;
  cachedClient = new S3Client({
    region: 'auto',
    endpoint: cfg.endpoint,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey
    }
  });
  return { client: cachedClient, cfg };
}

function safeProjectName(value) {
  const slug = String(value || '4nif-labs-cinematic')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || '4nif-labs-cinematic';
}

function makePackageKey() {
  return `4N1F_${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
}

function sourceHash({ html_code, css_code, js_code }) {
  return crypto
    .createHash('sha256')
    .update(String(html_code || ''))
    .update('\u0000')
    .update(String(css_code || ''))
    .update('\u0000')
    .update(String(js_code || ''))
    .digest('hex');
}

async function bodyToText(body) {
  if (!body) return '';
  if (typeof body.transformToString === 'function') return body.transformToString();
  const chunks = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

async function putJson(key, value) {
  const { client, cfg } = getClient();
  const body = JSON.stringify(value);
  await client.send(new PutObjectCommand({
    Bucket: cfg.bucket,
    Key: key,
    Body: body,
    ContentType: 'application/json; charset=utf-8',
    CacheControl: 'private, no-store'
  }));
  return Buffer.byteLength(body);
}

async function getJson(key) {
  const { client, cfg } = getClient();
  try {
    const result = await client.send(new GetObjectCommand({ Bucket: cfg.bucket, Key: key }));
    return JSON.parse(await bodyToText(result.Body));
  } catch (error) {
    if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) return null;
    throw error;
  }
}

async function deleteObject(key) {
  const { client, cfg } = getClient();
  await client.send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }));
}

async function listObjects(prefix) {
  const { client, cfg } = getClient();
  const items = [];
  let token;
  do {
    const result = await client.send(new ListObjectsV2Command({
      Bucket: cfg.bucket,
      Prefix: prefix,
      ContinuationToken: token
    }));
    items.push(...(result.Contents || []));
    token = result.IsTruncated ? result.NextContinuationToken : undefined;
  } while (token);
  return items;
}

function packagePath(project, key) {
  return `packages/${project}/${key}.json`;
}

function indexPath(key) {
  return `key-index/${key}.json`;
}

export async function publishR2Package(input) {
  const project = safeProjectName(input.project_name);
  const version = String(input.version || '').trim() || 'draft';
  const html_code = String(input.html_code || '');
  const css_code = String(input.css_code || '');
  const js_code = String(input.js_code || '');
  if (!html_code.trim()) throw new Error('html_code is required');

  const package_key = makePackageKey();
  const created_at = new Date().toISOString();
  const package_hash = sourceHash({ html_code, css_code, js_code });
  const pinned = Boolean(input.pinned);
  const package_path = packagePath(project, package_key);

  const payload = {
    schema: '4n1f-r2-package-v1',
    storage_engine: 'r2',
    package_key,
    project,
    version,
    package_hash,
    created_at,
    pinned,
    html_code,
    css_code,
    js_code
  };

  const package_size_bytes = await putJson(package_path, payload);
  await putJson(indexPath(package_key), {
    schema: '4n1f-r2-key-index-v1',
    storage_engine: 'r2',
    package_key,
    project,
    package_path,
    version,
    package_hash,
    package_size_bytes,
    created_at,
    pinned
  });

  const cleanup = await enforceRetention(project, Number(process.env.R2_RETENTION_LIMIT || DEFAULT_RETENTION));
  return {
    success: true,
    storage_engine: 'r2',
    package_key,
    package_hash,
    package_size_bytes,
    project,
    version,
    pinned,
    cleanup
  };
}

export async function resolveR2Package(packageKey) {
  const key = String(packageKey || '').trim().toUpperCase();
  if (!/^4N1F_[A-F0-9]{12}$/.test(key)) return null;
  const index = await getJson(indexPath(key));
  if (!index?.package_path) return null;
  const payload = await getJson(index.package_path);
  if (!payload) return null;
  return {
    storage_engine: 'r2',
    package_key: payload.package_key,
    project: payload.project,
    version: payload.version,
    package_hash: payload.package_hash,
    created_at: payload.created_at,
    pinned: Boolean(payload.pinned),
    html_code: String(payload.html_code || ''),
    css_code: String(payload.css_code || ''),
    js_code: String(payload.js_code || '')
  };
}

export async function setPinned(packageKey, pinned) {
  const key = String(packageKey || '').trim().toUpperCase();
  const index = await getJson(indexPath(key));
  if (!index?.package_path) return null;
  const payload = await getJson(index.package_path);
  if (!payload) return null;
  payload.pinned = Boolean(pinned);
  index.pinned = Boolean(pinned);
  await putJson(index.package_path, payload);
  await putJson(indexPath(key), index);
  return { package_key: key, pinned: Boolean(pinned) };
}

export async function enforceRetention(projectName, limit = DEFAULT_RETENTION) {
  const project = safeProjectName(projectName);
  const safeLimit = Math.max(1, Math.min(5000, Number(limit) || DEFAULT_RETENTION));
  const objects = await listObjects(`packages/${project}/`);
  if (objects.length <= safeLimit) return { limit: safeLimit, before: objects.length, deleted: 0, after: objects.length };

  const records = [];
  for (const item of objects) {
    const record = await getJson(item.Key);
    if (record) records.push({ path: item.Key, ...record });
  }

  const removable = records
    .filter((item) => !item.pinned)
    .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));

  let current = records.length;
  let deleted = 0;
  for (const item of removable) {
    if (current <= safeLimit) break;
    await deleteObject(item.path);
    await deleteObject(indexPath(item.package_key));
    current -= 1;
    deleted += 1;
  }

  return { limit: safeLimit, before: records.length, deleted, after: current };
}

export async function projectStats(projectName) {
  const project = safeProjectName(projectName);
  const objects = await listObjects(`packages/${project}/`);
  let bytes = 0;
  let pinned = 0;
  for (const item of objects) {
    bytes += Number(item.Size || 0);
    const record = await getJson(item.Key);
    if (record?.pinned) pinned += 1;
  }
  return { project, snapshots: objects.length, pinned, bytes };
}
