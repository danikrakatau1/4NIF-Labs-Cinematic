# 4N1F Labs Cinematic — Revival Checkpoint V0.3

Status: **ACTIVE / official standalone engine**

Official source: `danikrakatau1/4NIF-Labs-Cinematic`
Official Vercel project: `undangankuuuu/anif-labs-cinematic`
Official public host: `https://anif-labs-cinematic-undangankuuuu.vercel.app`

Historical source checkpoint: `danikrakatau1/buatundangan@37a89d585477c5002c81116ab8a5f0ab97a3db25`

## Navigation architecture — LOCK
- `/` = Universal Preview Hub
- `/p_<32 hex>` = clean rendered Preview
- `/editor/p_<32 hex>` = Live Editor for the same Preview ID
- Preview exposes `Open Live Editor` and carries the Preview ID automatically
- Live Editor exposes `← Preview` and carries the same Preview ID back automatically
- Routed Live Editor auto-loads the Preview ID; no manual copy/paste is required

## Preview Hub flow
- Package Key format: `4N1F_XXXXXXXXXXXX`
- Generate creates a temporary Preview ID through the Cloudflare KV session proxy
- Generated Preview opens in a new browser tab/window
- Existing Preview IDs can also be opened directly from the Hub
- Canonical Preview URL: `https://anif-labs-cinematic-undangankuuuu.vercel.app/p_<preview-id>`

## Preview renderer
- `p_<preview-id>` rewrites to the isolated `preview.html` renderer
- Renderer resolves Cloudflare KV first through the Vercel same-origin proxy
- Legacy Supabase Preview IDs remain readable as fallback
- Preview renders the package as clean full-screen HTML/CSS/JS
- Preview navigation is kept outside the rendered iframe so it cannot alter the package source

## Live Editor
- Editor shell is now at `editor/index.html`
- `/editor/p_<preview-id>` rewrites to that shell
- Same-origin KV loader intercepts the historical preview RPC and falls back to legacy Supabase when needed
- Historical core editor engine is preserved
- Layer Engine V1.2.3, Align + Responsive V1.2.4, and Multi Select + Group V1.2.5 remain enabled

## Cinematic background
- Full-screen WebGL fluid atmosphere
- Dark scrim / fallback layer
- Reduced-motion handling
- Background-only adaptation; no source-site navigation, forms, footer, or branding

## Immutable revision principle
- Existing Package Keys are immutable
- Editing does not overwrite the source Package Key
- A saved revision must publish as a new package snapshot / new Package Key

## Safety boundary
Legacy Vercel projects, `project-s9uok.vercel.app`, `aniflabs`, `undanganku1`, and `buatundangan` are out of scope and must not be touched unless explicitly requested.

## Integrity
`editor/editor.js` remains byte-identical to the historical Git blob (`ef58677d1498d2913637011576a27e12bcc07995`).
