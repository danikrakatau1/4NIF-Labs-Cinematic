import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

function requireEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

let client;
let bucket;

function r2() {
  if (client) return { client, bucket };
  const accountId = requireEnv('R2_ACCOUNT_ID');
  bucket = requireEnv('R2_BUCKET_NAME');
  client = new S3Client({
    region: 'auto',
    endpoint: String(process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`).replace(/\/$/, ''),
    credentials: {
      accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY')
    }
  });
  return { client, bucket };
}

function sessionPath(previewId) {
  return `preview-sessions/${previewId}.json`;
}

async function bodyToText(body) {
  if (!body) return '';
  if (typeof body.transformToString === 'function') return body.transformToString();
  const chunks = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

export async function savePreviewSession(previewId, packageKey) {
  if (!/^p_[a-f0-9]{32}$/.test(String(previewId || ''))) throw new Error('Preview ID tidak valid.');
  const { client: s3, bucket: name } = r2();
  const value = {
    schema: '4n1f-r2-preview-session-v1',
    storage_engine: 'r2',
    preview_id: previewId,
    package_key: String(packageKey || '').trim().toUpperCase(),
    created_at: new Date().toISOString()
  };
  await s3.send(new PutObjectCommand({
    Bucket: name,
    Key: sessionPath(previewId),
    Body: JSON.stringify(value),
    ContentType: 'application/json; charset=utf-8',
    CacheControl: 'private, no-store'
  }));
  return value;
}

export async function resolvePreviewSession(previewId) {
  const id = String(previewId || '').trim();
  if (!/^p_[a-f0-9]{32}$/.test(id)) return null;
  const { client: s3, bucket: name } = r2();
  try {
    const result = await s3.send(new GetObjectCommand({ Bucket: name, Key: sessionPath(id) }));
    return JSON.parse(await bodyToText(result.Body));
  } catch (error) {
    if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) return null;
    throw error;
  }
}
