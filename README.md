# 4N1F Labs Cinematic

Standalone revival of the historical 4N1F Labs visual web editor and universal live preview engine.

## Official home

- GitHub: `danikrakatau1/4NIF-Labs-Cinematic`
- Vercel project: `undangankuuuu/anif-labs-cinematic`
- Public host: `https://anif-labs-cinematic-undangankuuuu.vercel.app`

Legacy projects and old Vercel hosts are intentionally out of scope.

## Core model

4N1F Labs works on real website source, not design-only mockups:

`HTML + CSS + JS → immutable Package Key → Preview ID → live renderer`

One renderer deployment can serve many revisions through generated keys/sessions.

## Generated preview URL

When a Package Key is generated into a Preview ID, the editor opens a new page using the canonical form:

`https://anif-labs-cinematic-undangankuuuu.vercel.app/p_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

The clean preview route resolves Cloudflare KV first and keeps the historical Supabase Preview ID resolver as a compatibility fallback.

## Revived editor capabilities

- selection / inspection
- text, style, color editing
- device modes
- undo / redo
- Visual → Code
- patch JSON / cumulative patches
- local asset drafts
- Source Bundle JSON
- drag / resize / rotate / nudge
- deep selection
- guides / measurements
- layer navigation
- lock / delete / restore
- align / equal gap / reset
- responsive scope output
- experimental multi-select / grouping

## Cinematic UI

The workspace and generated-preview loading shell use a background-only WebGL fluid atmosphere with a dark scrim. No source-site navigation, forms, footer, or branding are included.

See `REVIVAL-CHECKPOINT.md` and `docs/` for implementation checkpoints and storage notes.
