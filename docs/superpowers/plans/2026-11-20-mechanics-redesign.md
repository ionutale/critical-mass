# Critical Mass Mechanics Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Critical Mass's 20–30 minute roguelike with a 3–8 minute turn-based valence-fusion arcade score-chase, driven by drag gestures and continuous motion.

**Architecture:** A pure, deterministic headless engine in `src/lib/game/` (elements → fusion/chain → turn/heat → drafts → meta) sits under a Svelte 5 runes UI. Input is pointer-drag-first with a full keyboard path; a choreography layer moves objects continuously and collapses to instant changes under reduced motion. Old contracts/sectors/recipes are deleted.

**Tech Stack:** SvelteKit 3, Svelte 5.57 (runes), TypeScript, Vitest + Testing Library, Playwright, CSS + Web Animations API. No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-11-20-mechanics-redesign-design.md`
**Glossary:** `GLOSSARY.md`

## Global Constraints

- Full mechanical redesign in place; keep the name, neon-reactor theme, app shell, sound, motion store, PWA/offline, and accessibility patterns.
- SvelteKit 3 + Svelte 5; client-rendered SPA (`ssr = false`); no `$lib` (relative imports in `src/`, relative in tests).
- Bundle budget 250 KB gzip client JS (`pnpm check:bundle`); no new runtime dependencies.
- Engine is pure and deterministic: same seed + same choices → same run. `preview === commit`.
- 8-way adjacency (orthogonal + diagonal). Fusion when valence sum ≤ 4; result = element at (sum valence, higher mass tier); Rarity = valence × mass.
- Heat cap 100; +3/turn; fusion adds valence sum plus +1 per chain step after the first; Heat never below `3 × turn`; chain resolves fully, then Overload, then end-of-turn +3, then Overload again.
- Stabilize discards one card, cools up to 15 (to the floor), applies +3, ends the turn without drawing. Scrap is free once per turn and does not end the turn.
- Milestones at 25/50/75 queue one 1-of-3 Upgrade draft each, in order.
- Every Element and every Rarity is reachable on a fresh save; meta unlocks add options, not stats.
- Gestures are accelerators, never the only path: full keyboard placement (arrows + Enter/Space, Escape cancels); swipe up opens the Stabilize picker, dragging a tile off Scraps, swipe down cancels.
- Reduced motion (user setting OR OS preference) replaces every flight/slide/merge/shake/loop with an instant, non-moving change everywhere.
- 44 px targets, focus traps, axe-clean, offline intact.
- Commands: `pnpm validate`, `pnpm check`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm check:bundle`, `pnpm test:e2e`.

## Review Focus

- **Preview ≠ commit under branching / 8-way:** a multi-step chain with non-default choices must commit exactly the previewed grid, score, and heat.
- **Stabilize-only never overloads:** the rising floor (`3 × turn`) must force eventual Overload even if the player only cools.
- **Kill order at the cap:** a lethal chain resolves fully and scores; the +3 end-of-turn is applied and checked last; no wasted steps or truncated preview.
- **Gesture without a keyboard path:** every drag placement must have a working arrow-key + Enter equivalent, and swipe shortcuts must not trap or scroll the page.
- **Old save on load:** a v1 save must not crash; it resets the run, preserves settings, and never loses the install.

---

### Task 1: Types and the 12-element table

**Files:**
- Modify: `src/lib/types.ts` (replace game types; keep shared settings types)
- Rewrite: `src/lib/data/elements.ts`
- Test: `src/lib/data/elements.test.ts`

**Interfaces:**
- Produces: `ElementSymbol`, `ElementRecord { symbol; name; valence: 1|2|3|4; mass: 1|2|3 }`, `ELEMENTS`, `ELEMENT_BY_SYMBOL`, `elementAt(valence, mass): ElementRecord | undefined`, `rarityOf(element): number`.

- [ ] **Step 1: Write failing tests** in `elements.test.ts`: exactly 12 elements, one per (valence 1–4, mass 1–3) pair; `elementAt(2, 3)?.symbol === 'Mg'`; `elementAt(4, 3)?.symbol === 'Fe'`; `rarityOf(elementAt(4, 3)!) === 12`; every symbol unique; real light-element names.
- [ ] **Step 2: Run** `pnpm test -- elements`; expect FAIL.
- [ ] **Step 3: Implement** types + the table (H/Li/Na; He/Be/Mg; C/N/O; Ne/Si/Fe) and helpers. Keep `SaveState`/settings types minimal and updated.
- [ ] **Step 4: Run** `pnpm test -- elements && pnpm check`; expect PASS.
- [ ] **Step 5: Commit** `feat: valence element model and table`.

---

### Task 2: Fusion, chains, preview, and commit

**Files:**
- Rewrite: `src/lib/game/fusion.ts`
- Test: `src/lib/game/fusion.test.ts`

**Interfaces:**
- Consumes: Task 1 elements/helpers; `RunState` from types.
- Produces: `FusionOption`, `FusionStep`, `PlacementResult`, `PlacementPreview`; `resolvePlacement(run, handIndex, cell, choices?: readonly number[]): PlacementResult | null`; `previewPlacement(...same...): PlacementPreview | null`.
- Types: `FusionOption { cell; other; result; rarity; points; heat }`; `FusionStep { step; a; b; result; cell; options: FusionOption[]; choice; rarity; points; heat }`; `PlacementPreview { steps; grid; scoreGain; heatGain; heatAfter; overload }`.
- Base math only in this task; Task 5 layers upgrade modifiers on top.

- [ ] **Step 1: Write failing tests:** valence-sum fusion (H+H→He; Li+He→Be; C+H→Ne); diagonal adjacency fuses; valence sum 5 never fuses; result mass = max input mass (Mg+He→Fe); multi-candidate step lists all options; `choices` selects the branch (8-way order deterministic, N→E→S→W→NE→SE→SW→NW); out-of-range choice falls back to option 0; `resolvePlacement` grid/score/heat equals `previewPlacement` for the same arguments and non-default choices; a 3+ step chain scores `step × rarity`.
- [ ] **Step 2: Run** `pnpm test -- fusion`; expect FAIL.
- [ ] **Step 3: Implement** `resolvePlacement` (cluster neighbours 8-way; collect every fusable option; select `options[choices[i] ?? 0] ?? options[0]`; consume neighbour; place result at the origin cell; continue; cap 24 steps) and `previewPlacement` (same resolution + `heatAfter`, `overload`). Heat per step = `resultValence + (step>0 ? 1 : 0)`. `placeCard` (the full turn action) is added in Task 4.
- [ ] **Step 4: Run** `pnpm test -- fusion && pnpm check`; expect PASS.
- [ ] **Step 5: Commit** `feat: valence fusion, chains, and preview`.

---

### Task 3: Run creation, deck, hand, and seed tiles

**Files:**
- Rewrite: `src/lib/game/turn.ts` (creation only in this task)
- Rewrite: `src/lib/game/rng.ts` if signatures change
- Test: `src/lib/game/turn.test.ts`

**Interfaces:**
- Consumes: Task 1 elements; `RunState`.
- Produces: `createRun(seed: number, unlocked?: readonly string[]): RunState`; starter deck constant; deterministic seed tiles.
- `RunState` fields: `seed, rngState, turn, grid: (ElementSymbol|null)[25], deck, hand, discard, heat, heatCap: 100, score, bestChain, status: 'active'|'overload', pendingDrafts, upgrades, scrapUsed`.

- [ ] **Step 1: Write failing tests:** `createRun(7)` deep-equals itself; different seeds produce different shuffles; starter deck is H×5, Li×2, He×2, Be×1; hand of 5 drawn; grid has 1–2 seed tiles at seed-derived cells; same seed → same seed tiles; all seed tiles are placeable elements (valence ≤ 3).
- [ ] **Step 2: Run** `pnpm test -- turn`; expect FAIL.
- [ ] **Step 3: Implement** `createRun` with seeded shuffle (reuse `shuffleWithState`), seed-tile placement from the seed, and the starter deck. Do not implement actions yet.
- [ ] **Step 4: Run** `pnpm test -- turn && pnpm check`; expect PASS.
- [ ] **Step 5: Commit** `feat: arcade run creation and seeded start`.

---

### Task 4: Turn actions — place, stabilize, scrap, heat floor, overload order

**Files:**
- Modify: `src/lib/game/turn.ts`
- Test: `src/lib/game/turn.test.ts`

**Interfaces:**
- Consumes: Task 2 `resolvePlacement`/`previewPlacement`; Task 3 `createRun`.
- Produces: `placeCard(run, handIndex, cell, choices?: readonly number[]): RunState`; `endTurn(run): RunState`; `stabilize(run, handIndex): RunState`; `scrap(run, cell): RunState`; `drawToHandSize(run): RunState`; `applyHeat(run, amount): RunState`; `heatFloor(run): number`; `queueMilestones(run): RunState`.

- [ ] **Step 1: Write failing tests:** a Place turn adds +3 after the chain, draws to 5, and resets `scrapUsed`; `placeCard` commits exactly `previewPlacement`'s grid/score/heat for non-default choices; Stabilize discards a card, cools 15 but not below `3 × turn`, adds +3, and does **not** draw; Scrap removes one tile, is limited to once per turn, and does not end the turn; a chain that reaches 100 ends `overload` **after** awarding score; a turn whose +3 crosses 100 also overloads; a stabilize-only loop still overloads within 40 turns; crossing 25 and 50 in one turn queues two drafts.
- [ ] **Step 2: Run** `pnpm test -- turn`; expect FAIL.
- [ ] **Step 3: Implement** `placeCard` (resolve → apply score/heat → overload check → `endTurn` → overload check → milestones), `heatFloor = 3 * run.turn`, `applyHeat` clamping, `endTurn` draw/reshuffle/scrap reset, `stabilize` (discard → cool to floor → +3 → no draw → turn++), and `scrap` (once/turn, no turn end).
- [ ] **Step 4: Run** `pnpm test -- turn && pnpm check`; expect PASS.
- [ ] **Step 5: Commit** `feat: heat, stabilize, scrap, and overload resolution`.

---

### Task 5: Upgrades, drafts, and milestone queue

**Files:**
- Create: `src/lib/data/upgrades.ts`
- Create: `src/lib/game/draft.ts`
- Modify: `src/lib/game/fusion.ts` and `turn.ts` (effect hooks)
- Test: `src/lib/game/draft.test.ts`

**Interfaces:**
- Consumes: Task 4 `pendingDrafts`; Tasks 2–4 engine.
- Produces: `UpgradeId`, `UpgradeRecord { id; name; description; kind: 'card'|'modifier' }`, `UPGRADES`, `generateDraft(run): UpgradeId[]`, `chooseUpgrade(run, index): RunState`; modifiers read through `hasUpgrade(run, id)`.
- Concrete pool: `add-h-2`, `add-he-2`, `add-li`, `add-c`, `add-be`, `add-na`, `add-o`, `coolant`, `efficient`, `chain-reaction`, `salvage`, `deep-hand`, `heat-sink`, `rarity-bonus`, `echo`.

- [ ] **Step 1: Write failing tests:** a draft offers 3 distinct, valid upgrades and advances `rngState` deterministically; card upgrades enter the **discard** pile; `pendingDrafts` is consumed one at a time; while pending, placement/stabilize/scrap are blocked; `coolant` makes Stabilize remove 30; `efficient` reduces fusion heat by 1 (min 1); `chain-reaction` adds +50% to steps 3+; `salvage` allows two Scraps; `deep-hand` gives hand size 6; `heat-sink` makes the first fusion each turn 0 heat; `rarity-bonus` adds +25% to valence-4 points; `echo` makes the first Stabilize draw normally.
- [ ] **Step 2: Run** `pnpm test -- draft`; expect FAIL.
- [ ] **Step 3: Implement** the pool, deterministic `generateDraft` (1 of 3, seeded), `chooseUpgrade`, and the effect hooks in fusion/turn. Keep all effects data-driven.
- [ ] **Step 4: Run** `pnpm test -- draft && pnpm check`; expect PASS.
- [ ] **Step 5: Commit** `feat: upgrade drafts and run builds`.

---

### Task 6: Meta unlocks and best score

**Files:**
- Rewrite: `src/lib/data/unlocks.ts`
- Create: `src/lib/game/meta.ts`
- Test: `src/lib/game/meta.test.ts`

**Interfaces:**
- Consumes: `MetaState`; Tasks 1/3/5 content.
- Produces: `UnlockRecord { id; name; description; threshold: number; metric: 'totalScore'|'bestChain'|'runs' }`, `UNLOCKS`, `evaluateUnlocks(meta): string[]` (newly unlocked), `runStats(run): { score; chain; turns }`.
- Unlocks add alternate starter cards, extra upgrade-pool entries, and challenge modifiers; none gate an Element or Rarity.

- [ ] **Step 1: Write failing tests:** crossing a threshold unlocks exactly once; unlocks never change base stats; a fresh save can reach Fe (rarity 12) using only base content; `evaluateUnlocks` is deterministic and idempotent.
- [ ] **Step 2: Run** `pnpm test -- meta`; expect FAIL.
- [ ] **Step 3: Implement** the 8-node threshold table, evaluation, and best-score updates. Document which starter cards/upgrades each node adds.
- [ ] **Step 4: Run** `pnpm test -- meta && pnpm check`; expect PASS.
- [ ] **Step 5: Commit** `feat: meta unlocks and best score`.

---

### Task 7: Save schema v2 and migration

**Files:**
- Modify: `src/lib/game/storage.ts`
- Test: `src/lib/game/storage.test.ts`

**Interfaces:**
- Consumes: `RunState`, `MetaState`, `createRun`.
- Produces: `SaveState version: 2`, `createInitialSave(seed?)`, `parseSave`, `loadSave`, `saveGame` with v1 migration.

- [ ] **Step 1: Write failing tests:** a v2 save round-trips; a v1 save resets `run` to `createRun(seed)` or null, preserves `settings`, and returns `recovered: false`; corrupt JSON recovers with a fresh save; a negative/NaN seed still loads; settings survive migration.
- [ ] **Step 2: Run** `pnpm test -- storage`; expect FAIL.
- [ ] **Step 3: Implement** v2 shape, v1→v2 migration (preserve settings, reset run/meta), and seed validation.
- [ ] **Step 4: Run** `pnpm test -- storage && pnpm check`; expect PASS.
- [ ] **Step 5: Commit** `feat: save schema v2 with v1 migration`.

---

### Task 8: Store wiring

**Files:**
- Rewrite: `src/lib/stores/game.ts`
- Test: `src/lib/stores/game.test.ts`

**Interfaces:**
- Consumes: Tasks 2–7.
- Produces: `save`, `run`, `recovered`, `initGame`, `newRun`, `place(handIndex, cell, choices?)`, `stabilize(handIndex)`, `scrap(cell)`, `chooseUpgrade(index)`, `setSetting`, `resetRun`, `resetAll`; derived `locked` (pending drafts or overload).

- [ ] **Step 1: Write failing tests:** each action commits the expected engine result and persists; actions are blocked while `pendingDrafts > 0` or `status === 'overload'`; `newRun` picks a random seed and preserves meta/settings; `chooseUpgrade` unlocks the next queued draft; best score and unlocks update on overload.
- [ ] **Step 2: Run** `pnpm test -- game`; expect FAIL.
- [ ] **Step 3: Implement** the store on the new engine; remove contract/sector calls.
- [ ] **Step 4: Run** `pnpm test -- game && pnpm check`; expect PASS.
- [ ] **Step 5: Commit** `feat: wire the arcade engine into the store`.

---

### Task 9: Board, hand, heat bar, score, and action controls

**Files:**
- Create: `src/lib/components/Board.svelte`, `Hand.svelte`, `HeatBar.svelte`, `ScoreDisplay.svelte`, `PreviewPanel.svelte`
- Rewrite: `src/lib/components/RunScreen.svelte`
- Test: `src/lib/components/run.test.ts`

**Interfaces:**
- Consumes: Task 8 store.
- Produces: presentational components driven by `run`; `Board` exposes cell callbacks; `Hand` exposes card selection; `HeatBar` shows milestones; `PreviewPanel` shows steps/score/heat.

- [ ] **Step 1: Write failing component tests:** the board renders 25 cells and seed tiles; the hand renders cards with valence/mass; the heat bar marks 25/50/75; score and best score render; Stabilize/Scrap buttons disable correctly; choosing a card and a cell shows the preview with score and heat.
- [ ] **Step 2: Run** `pnpm test -- run`; expect FAIL.
- [ ] **Step 3: Implement** the components and a click/tap-driven RunScreen (gestures come in Task 10).
- [ ] **Step 4: Run** `pnpm test -- run && pnpm check`; expect PASS.
- [ ] **Step 5: Commit** `feat: arcade run screen and board components`.

---

### Task 10: Drag gestures, live preview, keyboard parity, swipes

**Files:**
- Create: `src/lib/actions/dragPlacement.ts` (pointer drag + ghost)
- Modify: `RunScreen.svelte`, `Hand.svelte`, `Board.svelte`
- Test: `src/lib/components/run.test.ts`

**Interfaces:**
- Consumes: Task 9 components; Task 8 store.
- Produces: `dragPlacement` action/API: `begin(cardIndex)`, live `hoverCell`, `commit()`, `cancel()`; keyboard handler (arrows move ghost, Enter/Space commit, Escape cancel); swipe mapping (up → Stabilize picker, tile-off → Scrap, down → cancel).

- [ ] **Step 1: Write failing tests:** simulating pointer down on a card then up on a cell commits that placement; hovering a cell updates the live preview; cancel restores state; keyboard arrows move the ghost and Enter commits the same preview; swipe up opens the stabilize picker; dragging a tile off calls scrap; reduced motion does not change the commits.
- [ ] **Step 2: Run** `pnpm test -- run`; expect FAIL.
- [ ] **Step 3: Implement** pointer-drag with a floating card, live preview, commit/cancel, full keyboard path, and swipe handlers. Prevent page scroll only while dragging on the board.
- [ ] **Step 4: Run** `pnpm test -- run && pnpm check`; expect PASS.
- [ ] **Step 5: Commit** `feat: drag, keyboard, and swipe interaction`.

---

### Task 11: Continuous choreography

**Files:**
- Create: `src/lib/components/choreography.ts`
- Create: `src/lib/components/ChainPlayback.svelte` (or reuse/rewrite `FusionPlayback.svelte`)
- Modify: `RunScreen.svelte`, `neon.css`, `src/lib/stores/motion.ts`
- Test: `src/lib/components/run.test.ts`

**Interfaces:**
- Consumes: `$reducedMotion`; Task 10 interaction.
- Produces: `flight(from: Element, to: Element, opts)`, `mergeGhosts(...)`, `pulse(el)`, `tweenNumber(el, from, to)`; all no-op/instant when `reducedMotion` or WAAPI is absent.

- [ ] **Step 1: Write failing tests:** a committed placement creates a flight/ghost layer and per-step merge elements (DOM), score and heat animate via a `data-motion` marker; reduced motion adds **no** motion layer and commits instantly; a new placement cancels the previous playback; no layout shift (assert the board rect is stable).
- [ ] **Step 2: Run** `pnpm test -- run`; expect FAIL.
- [ ] **Step 3: Implement** the choreography helpers and wire them: card hand→cell, consumed tiles slide/merge into the result, result pops, score floats, heat bar tweens, milestones pulse, Overload shakes and transitions. Add app-wide transitions via the existing `transitionDuration($reducedMotion, ms)`.
- [ ] **Step 4: Run** `pnpm test -- run && pnpm check && pnpm build && pnpm check:bundle`; expect PASS and budget held.
- [ ] **Step 5: Commit** `feat: continuous placement and fusion choreography`.

---

### Task 12: Draft, end, title, unlocks, and how-to screens

**Files:**
- Rewrite: `DraftOverlay.svelte`, `EndScreen.svelte`, `TitleScreen.svelte`, `HowToPlay.svelte`, `App.svelte`
- Create: `UnlocksScreen.svelte`; remove `ResearchLab.svelte` references
- Test: `src/lib/components/meta.test.ts` (component cases)

**Interfaces:**
- Consumes: Tasks 5–8, 11.
- Produces: `DraftOverlay` 1-of-3 with keyboard; `EndScreen` (score, best, chain, unlocks, play again); `TitleScreen` (play, how-to, unlocks, settings, best score, seed); `UnlocksScreen` (locked/unlocked progress); `HowToPlay` (new rules + worked example).

- [ ] **Step 1: Write failing component tests:** draft shows three cards and picks via click/keyboard; end screen shows score/best and restarts; title shows best score and starts a run; unlocks screen shows thresholds; how-to contains the valence rule and an example (H+H→He).
- [ ] **Step 2: Run** `pnpm test -- meta`; expect FAIL.
- [ ] **Step 3: Implement** the screens with the existing transition system and reduced-motion gating.
- [ ] **Step 4: Run** `pnpm test && pnpm check && pnpm lint`; expect PASS.
- [ ] **Step 5: Commit** `feat: arcade screens and onboarding`.

---

### Task 13: Remove the old game systems

**Files:**
- Delete: `src/lib/data/contracts.ts`, `modules.ts`, `patches.ts`, `recipes.ts`, `src/lib/game/contracts.ts`, `effects.ts`, `validate.ts` (and their tests), `ResearchLab.svelte`, `SectorTransition.svelte`, `PressureGauge.svelte`; delete `FusionPlayback.svelte` if replaced by `ChainPlayback`. Keep `CardPicker.svelte` as the Stabilize card picker.
- Modify: `src/lib/index.ts`, `src/lib/stores/*`, any imports.
- Test: build + full unit suite.

- [ ] **Step 1: Search** for imports of the deleted modules (`grep -rn 'contracts\|recipes\|modules\|patches\|effects\|validate\|ResearchLab\|SectorTransition\|PressureGauge' src e2e scripts`) and list them.
- [ ] **Step 2: Remove** the files and fix imports; delete obsolete tests. Keep `particles.ts`, `sound.ts`, `rng.ts`, `storage.ts`, motion/accessibility utilities.
- [ ] **Step 3: Run** `pnpm test && pnpm check && pnpm lint && pnpm build`; expect PASS with no dead references.
- [ ] **Step 4: Commit** `chore: remove the retired roguelike systems`.

---

### Task 14: Balance harness for the arcade loop

**Files:**
- Rewrite: `scripts/balance.ts` (or `src/lib/game/balance.ts` + thin script)
- Create: `src/lib/game/balance.test.ts`
- Modify: `package.json` scripts if needed

**Interfaces:**
- Consumes: Tasks 2–8.
- Produces: `casualPlay(seed, unlocked): Result`, `plannerPlay(seed, unlocked): Result`, `report(results)`; `Result { seed; status; score; turns; bestChain; upgrades; stalled }`.

- [ ] **Step 1: Write failing tests:** a planner policy terminates on seeds 1–5; a stabilize-only policy still overloads (rising floor); run turns fall in the ~20–30 target band; at least two distinct upgrade paths appear across seeds; `--check` exits non-zero when a band misses.
- [ ] **Step 2: Run** `pnpm test -- balance`; expect FAIL.
- [ ] **Step 3: Implement** two policies (casual: one-step greedy; planner: searches chains with branch choices and heat/score trade-offs), the report (turns, score, chains, upgrades, stalls), and a `--check` band. Tune only constants to reach ~20–30 turns and a skill-expressive score spread.
- [ ] **Step 4: Run** `pnpm balance --check` and `pnpm test -- balance`; expect the bands hold.
- [ ] **Step 5: Commit** `feat: arcade balance harness`.

---

### Task 15: E2E, full gate, and real-browser check

**Files:**
- Rewrite: `e2e/*.spec.ts` for the new game
- Modify: `README.md`, `HowToPlay` copy if needed

**Interfaces:**
- Consumes: all prior tasks.

- [ ] **Step 1: Rewrite e2e** for: cold start and first placement; a full short run to Overload; an upgrade draft; reload/resume; PWA/offline; keyboard-only placement; touch drag at 390×844; reduced-motion run (no motion layer); axe audits on title/run/draft/end; 44 px targets.
- [ ] **Step 2: Run** `pnpm validate && pnpm check && pnpm lint && pnpm test && pnpm build && pnpm check:bundle && pnpm test:e2e`; expect all green.
- [ ] **Step 3: Real-browser check:** drag a card, watch it fly and the chain merge; verify score/heat animate; verify reduced motion is instant; verify keyboard placement; confirm a run lands in 3–8 minutes.
- [ ] **Step 4: Update README** (rules, controls, run length, build) and commit `docs: document the arcade redesign`.
- [ ] **Step 5: Commit** any verification fixes; report exact results.
