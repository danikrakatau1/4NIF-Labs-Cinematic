# 4N1F Labs Cinematic — R2 Dual Storage Activation

Status: **prepared / not yet activated on production**

## Goal
Keep the historical 4N1F workflow intact while adding Cloudflare R2 only for new Cinematic packages.

Legacy path remains available through Supabase. New R2 Preview IDs are resolved first by the additive bridge; when an ID is not found in R2, the historical Supabase RPC continues untouched.

## New R2 flow

1. Publish HTML/CSS/JS to `/api/r2-publish`.
2. Receive immutable `4N1F_XXXXXXXXXXXX` package key.
3. Create a Preview ID through `/api/r2-session`.
4. Receive `p_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`.
5. Editor loads the Preview ID.
6. `v1.3.0-r2-dual-storage.js` tries R2 first.
7. If R2 does not own the Preview ID, the original Supabase `get_lab_preview_source` request is used.

## Retention

- Default maximum active R2 snapshots per project: **500**.
- On snapshot 501, the oldest unpinned snapshot is removed.
- `pinned: true` / KEEP snapshots are skipped by automatic cleanup.
- `R2_RETENTION_LIMIT` can override the default later.

## Cloudflare R2

Create one private bucket:

`4n1f-labs-cinematic`

Create an R2 API token scoped only to this bucket with Object Read & Write permissions.

Never store the R2 secret in browser JavaScript, GitHub source, screenshots, or chat.

## Required server environment variables

```text
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=4n1f-labs-cinematic
R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
R2_RETENTION_LIMIT=500
LAB_PUBLISHER_KEY=<existing private publisher key or a new private value>
```

All variables above are server-side only.

## Files in this integration

- `server/r2-store.js` — private package store, key index, PIN/KEEP, retention, stats.
- `server/r2-session-store.js` — R2 Preview ID sessions.
- `api/r2-publish.js` — authenticated package publishing.
- `api/r2-session.js` — Package Key -> Preview ID.
- `api/r2-preview-source.js` — Preview ID -> normalized HTML/CSS/JS source.
- `api/r2-pin.js` — authenticated PIN/KEEP toggle.
- `api/r2-stats.js` — authenticated storage stats.
- `editor/addons/v1.3.0-r2-dual-storage.js` — non-breaking R2-first / Supabase-fallback bridge.

## Safety lock

Do not merge/deploy this branch to the historical live domain until:

1. R2 bucket exists.
2. R2 token exists and is scoped to the single bucket.
3. Server environment variables are configured.
4. A test package can be published to R2.
5. Its R2 Preview ID loads successfully.
6. A known historical Supabase Preview ID still loads successfully.

Only after both R2 and legacy smoke tests pass should the production domain be switched/updated.
