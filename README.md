# Critical Mass

[![CI](https://github.com/ionutale/critical-mass/actions/workflows/ci.yml/badge.svg)](https://github.com/ionutale/critical-mass/actions/workflows/ci.yml)

A neon reactor arcade puzzle: fuse the light elements, chain the reactor, and climb the score before the heat cap melts the run. Mobile-first SvelteKit PWA with seeded runs, local saves, and lifetime unlocks.

## Run it

```bash
pnpm install
pnpm exec playwright install   # once, for the e2e suite
pnpm dev                       # http://localhost:5173
```

The app is client-rendered (`ssr = false`) and builds to a static site with `200.html` as the SPA fallback.

## Rules

The reactor is a 5×5 grid. A normal run lasts about **25 turns**: the heat floor alone reaches the cap by then.

### Valence, mass, and fusion

Every element has a **valence** (1–4, its column) and a **mass tier** (1–3, its row). The table holds one real light element for each pair:

| Valence | Mass 1 | Mass 2 | Mass 3 |
| ------- | ------ | ------ | ------ |
| 1       | H      | Li     | Na     |
| 2       | He     | Be     | Mg     |
| 3       | C      | N      | O      |
| 4       | Ne     | Si     | Fe     |

Two tiles fuse when their **valence sum is 4 or less**. The result sits at that valence sum and at the **higher** of the two mass tiers, so `H + H → He` and `Be + H → N`.

- Fusion checks all **8 neighbours**, not just the four compass directions.
- Only the **placed tile** fuses. Each step consumes one neighbour; the chain repeats from the placed cell until no recipe matches.
- When several neighbours are fusable, the preview offers every branch (default order N, E, S, W, then diagonals). The preview must equal the commit: same steps, same result tile, same heat.

### Heat

- A fusion adds Heat equal to the result's valence, plus 1 for each chain step after the first.
- Every turn ends with **4 passive Heat**.
- Heat cannot be cooled below a rising **floor of 4 × the turn number**.
- Reaching the **cap (100)** ends the run in **Overload**. There is no win state: every run eventually overloads, and the score is what survives.

### Stabilize and Scrap

- **Stabilize** discards one card to remove 15 Heat (30 with Coolant), never below the floor. It ends the turn and draws nothing, so it buys time at the cost of a card. With an empty hand it becomes a pure pass; the passive Heat still ends the run.
- **Scrap** removes one placed tile for free, once per turn (twice with Salvage). It does **not** end the turn, so a full board is never a soft lock.

### Score

Each fusion step scores `step × rarity`, where **rarity = valence × mass** (1–12). Later steps in a chain are worth more. Chain Reaction and Rarity Bonus multiply their matching steps; all multipliers round once so Preview and commit agree.

## Controls

- **Drag:** drag a card from the hand onto an empty cell. Release over the cell to place it; drag it off the board or swipe down to cancel.
- **Tap:** tap a card, then tap an empty cell to open the placement preview. Confirm to commit exactly the path shown.
- **Keyboard:** focus a card, move the targeting ghost with the arrow keys (it skips occupied cells), press Enter or Space to commit, and Escape to cancel.
- **Swipe up** on the reactor to open the Stabilize picker; **swipe down** to cancel the current selection.
- **Drag a placed tile off its cell** to Scrap it. A downward swipe cancels instead of scrapping.

Every pointer path commits the same live preview, and every target is at least 44 px.

## Upgrades and unlocks

Crossing **25, 50, and 75 Heat** each queues one Upgrade draft. The run pauses and offers **1 of 3**:

- **Card upgrades** add cards to the discard pile (for example two Hydrogen or one Carbon).
- **Modifiers** change the rest of the run: Coolant, Efficient Fusion, Chain Reaction, Salvage, Deep Hand, Heat Sink, Rarity Bonus, and Echo.

Milestone progress is a high-water mark: cooling down and crossing the same threshold again never refunds a draft. Owned modifiers leave the pool; card upgrades can be drafted repeatedly.

Lifetime progress lives in **Unlocks**. Eight nodes unlock automatically from total score, best chain, or completed runs. Starter unlocks replace one Hydrogen in the starter deck (the deck stays ten cards); pool unlocks add new card upgrades to the draft; nothing raises a base stat or gates an element.

## Saving

Progress lives in `localStorage` under `critical-mass:save:v1` with **schema version 2**. Runs autosave after every action and restore the board, hand, deck, score, heat, turn, pending drafts, upgrades, RNG state, and lifetime meta. Settings and unlocks survive starting or resetting a run. Legacy saves (the retired roguelike schema) are migrated by keeping settings and dropping the incompatible run.

## Verify it

```bash
pnpm check         # svelte-check
pnpm lint          # prettier + eslint
pnpm test          # unit, engine, and component tests
pnpm build         # static build in build/
pnpm check:bundle  # 250 KB gzip budget for client JS
pnpm test:e2e      # build, then Playwright
pnpm e2e           # Playwright against an existing build
pnpm preview       # serve the production build
```

The full gate:

```bash
pnpm check && pnpm lint && pnpm test && pnpm build && pnpm check:bundle && pnpm test:e2e
```

The Playwright suite runs at 390×844 and covers cold start and first placement, a run through Overload, an upgrade draft, reload/resume, offline PWA startup, keyboard-only placement, touch drag, a reduced-motion run with no motion layer, axe audits on the title, run, draft, and end screens, and 44 px touch targets.

### Balance

```bash
pnpm balance            # report
pnpm balance --check    # exit 1 when a band misses
```

The harness plays 20 seeds with three reference policies: a one-step greedy `casual` player, a branch-searching `planner`, and a `stabilize-only` floor control. `--check` enforces the design bands: planner median **20–30 turns** (hard window 15–40), no stalls, at least two distinct upgrade paths, planner median score above 1.25× casual, and a stabilize-only control that overloads by turn 40. Balance changes must keep every band green.

## Content

All content is typed data under `src/lib/data/`:

- `elements.ts` — the 12 light elements, one for every valence/mass pair.
- `upgrades.ts` — the run upgrade pool.
- `arcade/unlocks.ts` — the lifetime unlock tree.

The engine and data tests enforce the element table, upgrade ids, and unlock costs.

## PWA and offline

The manifest, service worker, and icons are generated during `pnpm build`. After one online load the reactor opens offline. A new build shows a refresh prompt instead of reloading mid-placement. Regenerate icons after changing `static/favicon.svg`:

```bash
pnpm exec pwa-assets-generator
```

The icon config (near-black maskable/apple backgrounds) is in `pwa-assets.config.ts`.

## CI and deploy

GitHub Actions runs `check`, `lint`, `test`, `build`, `check:bundle`, and the Playwright suite on every push and pull request. The `master` deploy job runs when `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets exist.

The game runs on Cloudflare Workers static assets:

- https://critical-mass.alexionutale.workers.dev
- https://critical-mass.aiu-media.com

`pnpm deploy` builds, mirrors `200.html` to `index.html` for the Workers root, and runs `wrangler deploy`. Any static host works the same way: serve `build/` and rewrite `/` to `200.html`.
