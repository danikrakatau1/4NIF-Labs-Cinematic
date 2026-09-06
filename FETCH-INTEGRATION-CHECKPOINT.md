# 4N1F Labs Cinematic — Fetch Integration Checkpoint

Branch: `fetch-hub-integration`

## Locked existing flow
- Universal Preview Hub remains the main root workflow.
- Package Key → Generate Preview → Preview ID → clean Preview → Live Editor is not replaced.

## New integration
- Added `/fetch/` as an isolated Fetch workspace route.
- Next patch adds a visible `FETCH` navigation control on the root Preview Hub.
- Fetch/CodeHunt engine is integrated only inside `/fetch/`, not into the Preview ID core.

## Safety rule
Do not modify or remove existing Preview ID generation, clean preview routing, KV loading, or Live Editor navigation while wiring Fetch.
