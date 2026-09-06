# 4N1F Labs Cinematic — Cloudflare KV Activation

Status: GitHub Builds connected for branch `kv-dual-storage`; first deployment trigger issued from GitHub.

## Goal
Keep the existing 4N1F flow while using Cloudflare Workers KV for new Cinematic packages:

`Editor -> Publish -> 4N1F KEY -> Preview Session -> Preview ID -> Renderer`

Legacy Supabase packages are intentionally not migrated or deleted.

## Cloudflare resources already expected
- Worker name: `4n1f-kv-api`
- KV binding variable: `PACKAGES`
- Preferred KV namespace: `4n1f-labs-cinematic`

The Wrangler configuration declares `PACKAGES`. If a repository build cannot reuse the existing dashboard binding, Wrangler automatic provisioning may create/link a KV namespace for that binding. Confirm the Worker Bindings screen after first deployment.

## One-time GitHub connection from Cloudflare dashboard
1. Open Workers & Pages.
2. Open `4n1f-kv-api`.
3. Settings -> Builds -> Connect.
4. Choose GitHub.
5. Select repository `danikrakatau1/4NIF-Labs-Cinematic`.
6. Production branch should eventually be `main`; while testing this feature, use `kv-dual-storage` or create a preview build from the PR.
7. Root directory: repository root (`/`).
8. Deploy command: default `npx wrangler deploy`.
9. Save and deploy.

The Worker name in `wrangler.jsonc` is intentionally `4n1f-kv-api` to match the existing Cloudflare Worker.

## Required secret before package publishing
Create one Worker secret named:

`PUBLISH_TOKEN`

Do not commit its value to GitHub. The Worker requires it for `/publish`, `/pin`, `/stats`, and `/cleanup`.

The browser-facing `/session` route does not require the publisher token but is restricted by CORS to the configured 4N1F preview origin.

## Non-secret variables already in wrangler.jsonc
- `RETENTION_LIMIT=500`
- `ALLOWED_ORIGINS=https://project-s9uok.vercel.app`

## API contract
### Health
`GET /health`

### Publish immutable package
`POST /publish`
Header: `x-4n1f-publisher-key: <PUBLISH_TOKEN>`

Body:
```json
{
  "project_name": "4n1f-labs-cinematic",
  "version": "v0.1",
  "html_code": "<main>...</main>",
  "css_code": "body {...}",
  "js_code": "console.log('...')",
  "pinned": false
}
```

Returns a key such as `4N1F_A1B2C3D4E5F6`.

### Generate preview session
`POST /session`
```json
{ "package_key": "4N1F_A1B2C3D4E5F6" }
```

Returns a random Preview ID such as `p_...` with a 7-day TTL.

### Resolve preview source
`GET /preview/<preview_id>`

Returns the standard renderer payload:
- `html_code`
- `css_code`
- `js_code`
- package metadata

### Pin / Keep
`POST /pin`
Header: publisher token.
```json
{ "package_key": "4N1F_A1B2C3D4E5F6", "pinned": true }
```

### Stats
`GET /stats?project=4n1f-labs-cinematic`
Header: publisher token.

### Cleanup
`POST /cleanup`
Header: publisher token.
```json
{ "project_name": "4n1f-labs-cinematic", "limit": 500 }
```

## Storage policy
- Maximum active unpinned history target: 500 snapshots per project.
- Pinned snapshots are never auto-deleted.
- If all old snapshots are pinned, total count may temporarily exceed 500.
- Source packages are deduplicated by SHA-256 within a project.
- Maximum package payload enforced by Worker: 20 MiB.
- Preview sessions expire after 7 days; immutable package keys remain until cleanup/deletion.

## Safety
- `PUBLISH_TOKEN` must remain a Cloudflare secret / server-side secret.
- Never put `PUBLISH_TOKEN` into browser JavaScript or a public GitHub file.
- Do not remove the legacy Supabase flow until known old package/preview IDs have passed regression tests.
