# 4N1F Labs Cinematic — Revival Checkpoint V0.2

Status: **ACTIVE / official standalone engine**

Official source: `danikrakatau1/4NIF-Labs-Cinematic`
Official Vercel project: `undangankuuuu/anif-labs-cinematic`

Historical source checkpoint: `danikrakatau1/buatundangan@37a89d585477c5002c81116ab8a5f0ab97a3db25`

## Restored
- Root standalone visual editor shell (`index.html`)
- Historical editor styling (`editor/editor.css`)
- Historical core editor engine (`editor/editor.js`)
- Layer Engine V1.2.3
- Align + Responsive V1.2.4
- Multi Select + Group V1.2.5 experimental addon
- Blueprint checkpoint documentation

## Cinematic background
- Full-screen WebGL fluid atmosphere
- Dark scrim / fallback layer
- Reduced-motion handling
- Background-only adaptation; no source-site navigation, forms, footer, or branding

## Generated Preview flow
- Package Key can generate a Preview ID through the KV session proxy
- Generated Preview opens in a new browser tab/window
- Canonical preview URL shape: `https://anif-labs-cinematic-undangankuuuu.vercel.app/<preview_id>`
- `/<preview_id>` rewrites to the isolated `preview.html` renderer
- Renderer resolves Cloudflare KV first through Vercel server proxy
- Legacy Supabase Preview IDs remain readable as fallback
- Preview page uses the cinematic fluid background while resolving/loading the rendered package

## Safety boundary
Legacy Vercel projects, `project-s9uok.vercel.app`, `aniflabs`, `undanganku1`, and `buatundangan` are out of scope and must not be touched unless explicitly requested.

## Integrity
`editor/editor.js` remains byte-identical to the historical Git blob (`ef58677d1498d2913637011576a27e12bcc07995`).
