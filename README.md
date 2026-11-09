# Critical Mass

[![CI](https://github.com/ionutale/critical-mass/actions/workflows/ci.yml/badge.svg)](https://github.com/ionutale/critical-mass/actions/workflows/ci.yml)

A neon reactor puzzle: place tiles, fuse the alpha ladder, deliver contracts, and keep pressure under the cap across three sectors. Mobile-first SvelteKit PWA with seeded runs, local saves, and a meta research tree.

## Run it

```bash
pnpm install
pnpm exec playwright install   # once, for the e2e suite
pnpm dev                       # http://localhost:5173
```

The app is client-rendered (`ssr = false`) and builds to a static site with `200.html` as the SPA fallback.

## Verify it

```bash
pnpm test          # unit, engine, and component tests
pnpm e2e           # Playwright against an existing build
pnpm check         # svelte-check
pnpm lint          # prettier + eslint
pnpm validate      # content invariants
pnpm balance       # seeded balance report (win rate, pressure, contracts)
pnpm build         # static build in build/
pnpm preview       # serve the production build
pnpm check:bundle  # 250 KB gzip budget for client JS
pnpm deploy        # build and deploy to Cloudflare Workers
```

`pnpm test:e2e` builds first and runs Playwright; `pnpm e2e` expects a recent build. The suite covers cold-start fusion and reload, mid-run resume, venting, PWA/offline, keyboard play, axe audits, 44 px targets, drafts, and finished runs.

## Fusion

- The reactor is a 5×5 grid. Placing a card on an empty cell adds the tile and discards the card.
- Only the **placed tile** fuses. Its neighbours resolve in **N → E → S → W** order, repeating until no more recipes match, so one placement can chain.
- Each recipe is an unordered pair (some need the Catalyst). The preview must equal the commit: same steps, same result tile, same pressure.
- Placing costs pressure `4 + tier + 2 × chain index` (heavy results add 8, reduced by modules). Meltdown happens when pressure reaches the current cap.
- The deck cannot starve: hand refills after each turn, discards reshuffle.

## Pressure and soft locks

- Caps, sector floors, and vent amounts live in the engine and module effects. Venting costs one card and stops at the sector floor (0 / 20 / 40).
- Scrap is free once per turn and always frees a cell, so a full board is never a soft-lock.
- Catalyst is auto-granted at the start of sector 3 if it is missing.
- A contract needs its target tile delivered; drafts follow every completed contract. The run wins after the sector 3 boss and ends in meltdown at the cap.

## Content authoring

All content is typed data under `src/lib/data/`:

- `elements.ts` — 24 elements with tiers and heavy flags.
- `recipes.ts` — fusion pairs, optionally Catalyst-only.
- `contracts.ts` — 30 templates across 3 sectors × 5 slots × 2 variants.
- `modules.ts` and `patches.ts` — reactor effects.
- `unlocks.ts` — 12 meta research nodes.

Run `pnpm validate` after editing. It enforces the launch counts, recipe reachability, unique ids, contract sectors, module effects, and unlock costs.

## Balance

`pnpm balance` plays 40 seeded runs with a simple policy twice: no unlocks and all unlocks. It reports wins, meltdowns, average contracts, peak pressure, and sector. It is a floor for tuning, not a solver.

## Saving

Progress lives in `localStorage` under `critical-mass:save:v1`. Runs autosave on every action and restore the grid, hand, pressure, contract, RNG state, drafts, and meta research. Settings and unlocks survive starting a new run.

## PWA and offline

The manifest, service worker, and icons are generated during `pnpm build`. After one online load the reactor opens offline. A new build shows a refresh prompt instead of reloading mid-fusion. Regenerate icons after changing `static/favicon.svg`:

```bash
pnpm exec pwa-assets-generator
```

The icon config (near-black maskable/apple backgrounds) is in `pwa-assets.config.ts`.

## CI and deploy

GitHub Actions runs `validate`, `check`, `lint`, `test`, `build`, `check:bundle`, and the Playwright suite on every push and pull request. The `master` deploy job runs when `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets exist.

The game runs on Cloudflare Workers static assets:

- https://critical-mass.alexionutale.workers.dev
- https://critical-mass.aiu-media.com

`pnpm deploy` builds, mirrors `200.html` to `index.html` for the Workers root, and runs `wrangler deploy`. Any static host works the same way: serve `build/` and rewrite `/` to `200.html`.
