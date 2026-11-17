# Critical Mass — Motion & Gameplay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a cohesive motion layer and make gameplay deeper (player-directed chains), more varied (content + random-seed starts), and correctly balanced.

**Architecture:** Pure-function engine gains a branch-choice parameter that the preview and commit share, preserving `preview === commit`. The run screen drives staggered CSS/Svelte motion from the chosen chain. Content grows within updated validators; a two-policy balance harness tunes constants to a difficulty band.

**Tech Stack:** SvelteKit 3, Svelte 5.57 (runes, `transition:`, `animate:flip`), TypeScript, Vitest + Testing Library, Playwright, CSS keyframes. No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-11-17-motion-and-gameplay-design.md`

## Global Constraints

- SvelteKit 3 + Svelte 5; client-rendered SPA (`ssr = false`). No `$lib`; use relative imports in `src/`, relative in tests.
- Bundle budget: 250 KB gzip client JS (`pnpm check:bundle`). No new runtime dependencies.
- All motion routes through `reducedMotion` (`src/lib/stores/motion.ts`): user setting OR `prefers-reduced-motion`. CSS gated by `.reduce-motion` and the media query; Svelte transitions get `duration: $reducedMotion ? 0 : <base>`.
- `preview === commit`: `placeCard` must commit via a fresh `previewPlacement` with identical arguments. Seeded determinism: same seed + same choices → same run.
- Save key stays `critical-mass:save:v1`; existing contract/module/unlock ids must remain valid. Choices are transient UI state, never saved.
- 44 px minimum touch targets, visible focus rings, axe audits stay green.
- Commands: `pnpm validate`, `pnpm check`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm check:bundle`, `pnpm e2e`.

## Review Focus

- **Long chains (up to 24 steps):** staggered playback must not truncate; capped stagger fits a fixed budget and a new placement cancels the previous playback without locking input.
- **Invalid / stale branch choices:** an out-of-range or stale `choices` entry must fall back to the first option, never crash or diverge preview from commit.
- **Reduced motion:** no ghost layer, flashes, ambient loops, or transition durations when `reducedMotion` is true (user setting or system preference).
- **Old saves:** loading a save written before this change must still parse and resume (ids intact, no schema bump).
- **Random seed reproducibility:** same explicit seed yields the identical start variant, deck, and first contract; the displayed seed matches `run.seed`.

---

### Task 1: Branch-aware fusion engine

**Files:**

- Modify: `src/lib/game/fusion.ts`
- Test: `src/lib/game/fusion.test.ts`

**Interfaces:**

- Consumes: existing `RunState`, `ElementRecord`, `RecipeRecord`, `neighbors`, `findRecipe`.
- Produces: `FusionOption`, extended `FusionStep`, `previewPlacement(run, handIndex, cell, elements, recipes, choices?: readonly number[])`, `placeCard(run, handIndex, cell, elements, recipes, choices?: readonly number[])`.

- [ ] **Step 1: Write failing tests** in `fusion.test.ts`:

```ts
// Build a run whose placed tile has >=2 fusable neighbors with different results.
// e.g. active He at cell 12 with Be at 7 (N) and C at 13 (E): Be+He->C, C+He->O.
it('lists all candidate neighbors per step', () => {
	const preview = previewPlacement(run, 0, 12, ELEMENTS, RECIPES)!;
	expect(preview.steps[0].options.length).toBeGreaterThanOrEqual(2);
});
it('uses the chosen option index', () => {
	const a = previewPlacement(run, 0, 12, ELEMENTS, RECIPES, [0])!;
	const b = previewPlacement(run, 0, 12, ELEMENTS, RECIPES, [1])!;
	expect(a.steps[0].result).not.toBe(b.steps[0].result);
});
it('falls back to first option for out-of-range choice', () => {
	const a = previewPlacement(run, 0, 12, ELEMENTS, RECIPES, [99])!;
	const b = previewPlacement(run, 0, 12, ELEMENTS, RECIPES, [])!;
	expect(a.grid).toEqual(b.grid);
});
it('commit equals preview with non-default choices', () => {
	const choices = [1];
	const preview = previewPlacement(run, 0, 12, ELEMENTS, RECIPES, choices)!;
	const next = placeCard(run, 0, 12, ELEMENTS, RECIPES, choices);
	expect(next.grid).toEqual(preview.grid);
	expect(next.pressure).toBe(preview.pressureAfter);
});
```

- [ ] **Step 2: Run tests, verify they fail.** Run: `pnpm test -- fusion`. Expected: FAIL (`options` undefined / signature mismatch).

- [ ] **Step 3: Implement.** Add `export interface FusionOption { cell: number; other: string; result: string; pressure: number }`. Extend `FusionStep` with `options: FusionOption[]` and `choice: number`. Add trailing `choices: readonly number[] = []` to both functions. In the step loop, collect **every** neighbor with a valid recipe into `options` (compute each option's pressure with the existing formula), then select `options[choices[index] ?? 0] ?? options[0]`; record `choice`. Keep the 24-step cap and pressure math unchanged. `placeCard` passes `choices` into its `previewPlacement` call.

- [ ] **Step 4: Run tests, verify pass.** Run: `pnpm test -- fusion`. Expected: PASS. Also `pnpm check`.

- [ ] **Step 5: Commit.** `git add src/lib/game/fusion.ts src/lib/game/fusion.test.ts && git commit -m "feat: player-directed fusion branches in preview and commit"`

---

### Task 2: Branch selection in the run screen and preview

**Files:**

- Modify: `src/lib/stores/game.ts` (`place`)
- Modify: `src/lib/components/RunScreen.svelte`
- Modify: `src/lib/components/PreviewOverlay.svelte`
- Test: `src/lib/components/run.test.ts`

**Interfaces:**

- Consumes: Task 1 `previewPlacement`/`placeCard` with `choices`.
- Produces: store `place(handIndex: number, cell: number, choices?: readonly number[]): void`; `PreviewOverlay` prop `onChoose: (step: number, option: number) => void`.

- [ ] **Step 1: Write failing component test** in `run.test.ts`: render a run with a multi-candidate placement, open the preview, assert option buttons exist per step, click the second option of step 1, and assert the displayed final tile / pressure changes. Assert all option buttons are focusable (tabindex not -1).

- [ ] **Step 2: Run test, verify fail.** Run: `pnpm test -- run`. Expected: FAIL (no option buttons).

- [ ] **Step 3: Implement.** Store `place` gains `choices: readonly number[] = []` and forwards to `placeCard`. `RunScreen`: add `let choices = $state<number[]>([])`; `chooseCell` calls `previewPlacement(..., choices)`; `confirm` calls `place(selected, targetCell, choices)` then resets `choices = []`; `cancel` resets `choices = []`. Pass `onChoose={(step, option) => { choices = choices.map((c, i) => (i === step ? option : c)); while (choices.length < preview!.steps.length) choices.push(0); preview = previewPlacement($run!, selected!, targetCell!, ELEMENTS, RECIPES, choices); }}` to `PreviewOverlay`. In `PreviewOverlay`, render each step's `options` as `<button>` rows (label: `other → result`, `+pressure`), `aria-pressed` for the chosen one, calling `onChoose(index, optionIndex)`; keep the existing focus trap.

- [ ] **Step 4: Run tests + typecheck.** Run: `pnpm test -- run && pnpm check`. Expected: PASS.

- [ ] **Step 5: Commit.** `git add src/lib/stores/game.ts src/lib/components/RunScreen.svelte src/lib/components/PreviewOverlay.svelte src/lib/components/run.test.ts && git commit -m "feat: choose fusion branches in the preview overlay"`

---

### Task 3: Random seed, start variants, seed readout

**Files:**

- Modify: `src/lib/game/storage.ts`
- Modify: `src/lib/game/turn.ts`
- Modify: `src/lib/stores/game.ts` (`newRun`)
- Modify: `src/lib/components/RunScreen.svelte` (seed readout)
- Test: `src/lib/game/turn.test.ts`, `src/lib/stores/game.test.ts`

**Interfaces:**

- Consumes: `createRun(seed)`.
- Produces: `randomSeed(): number`; `START_VARIANTS` table; `createRun` selects a variant by seed.

- [ ] **Step 1: Write failing tests.** `turn.test.ts`: `createRun(7)` and `createRun(7)` deep-equal; two seeds mapping to different variants produce different starting grid/deck; every variant's first contract is a valid sector-1 slot-1 template and the deck can reach it. `game.test.ts`: `newRun()` produces a run whose `seed` differs across calls (mock `randomSeed` or assert non-constant) and meta/settings preserved.

- [ ] **Step 2: Run tests, verify fail.** Run: `pnpm test -- turn game`. Expected: FAIL.

- [ ] **Step 3: Implement.** In `storage.ts` add `export function randomSeed(): number { const buf = new Uint32Array(1); if (typeof crypto !== 'undefined' && crypto.getRandomValues) { crypto.getRandomValues(buf); return buf[0]; } return Date.now() % 0xffffffff; }`. In `turn.ts` add `const START_VARIANTS: readonly { cell: number; deck: string[] }[]` (~4 entries, H/He mixes, e.g. center H with 8H+2He; off-center H with 7H+3He; etc.); `createRun` picks `START_VARIANTS[seed % START_VARIANTS.length]`, places the tile at `variant.cell`, shuffles `variant.deck`. Keep `createInitialSave(seed = 42)` default for save fallbacks. `newRun()` calls `createInitialSave(randomSeed())`. `RunScreen` header adds `<p class="seed mono">SEED {$run.seed}</p>`.

- [ ] **Step 4: Run tests + validate.** Run: `pnpm test -- turn game && pnpm validate && pnpm check`. Expected: PASS.

- [ ] **Step 5: Commit.** `git add src/lib/game/storage.ts src/lib/game/turn.ts src/lib/stores/game.ts src/lib/components/RunScreen.svelte src/lib/game/turn.test.ts src/lib/stores/game.test.ts && git commit -m "feat: random run seed, start variants, and seed readout"`

---

### Task 4: Content expansion and validator updates

**Files:**

- Modify: `src/lib/game/validate.ts`, `src/lib/game/validate.test.ts`
- Modify: `src/lib/data/elements.ts`, `recipes.ts`, `contracts.ts`, `modules.ts`, `patches.ts`, `unlocks.ts`
- Test: `src/lib/data/content.test.ts`

**Interfaces:**

- Consumes: existing data shapes (`ElementRecord`, `RecipeRecord`, `ContractTemplate`, `ModuleRecord`, `PatchRecord`, `UnlockRecord`).
- Produces: expanded datasets; validators accept the new counts.

- [ ] **Step 1: Update validators + failing tests.** In `validate.ts` change module count 24 → 30, unlock count 12 → 16, and contract structure to 3 variants per slot (15 per sector, 45 total). Update `validate.test.ts` expectations to match. Add content assertions in `content.test.ts`: every new element reachable (non-heavy without catalyst), every recipe produces a heavier element, sector tier limits and bosses (Mg/Fe/U) intact, ids unique, existing ids unchanged. Add an old-save regression test: a `SaveState` referencing pre-expansion contract/module/unlock ids still passes `parseSave` and resumes (no schema bump).

- [ ] **Step 2: Run validate/tests, verify fail.** Run: `pnpm validate && pnpm test -- validate content`. Expected: FAIL (counts/coverage).

- [ ] **Step 3: Add content.** Grow elements 24 → ~30 (fill alpha-ladder gaps and extend heavies past U), add recipes that create alternative branches (more multi-candidate neighbors), contracts 30 → 45 (third variant per slot), modules 24 → 30, patches 6 → 8, unlocks 12 → 16. Keep existing ids; new unlock refs must point at real cards/modules. Exact list is the implementer's call within validator rules.

- [ ] **Step 4: Run validate + tests.** Run: `pnpm validate && pnpm test && pnpm check`. Expected: PASS.

- [ ] **Step 5: Commit.** `git add src/lib/game/validate.ts src/lib/game/validate.test.ts src/lib/data src/lib/data/content.test.ts && git commit -m "feat: expand elements, recipes, contracts, modules, and unlocks"`

---

### Task 5: Two-policy balance harness and tuning

**Files:**

- Modify: `scripts/balance.ts`
- Modify (constants only): `src/lib/game/fusion.ts`, `effects.ts`, `turn.ts`, `contracts.ts`

**Interfaces:**

- Consumes: Task 1 `choices` API; `createRun`, `previewPlacement`, `placeCard`, `deliver`, `vent`, `scrap`, `chooseDraft`, `nextSector`.
- Produces: `casualPlay(seed, unlocked)` and `competentPlay(seed, unlocked)` returning `Result` with `stalled: boolean`.

- [ ] **Step 1: Implement the harness.** Replace the single greedy loop with two policies. Casual: current cheap-fusion preference, no branch search. Competent: target-aware — if the contract target is absent, search placements (using `choices` to plan multi-step paths) whose resulting grid contains the target, preferring lowest pressure gain; otherwise prefer raising tile tier toward the target; vent only when useful; scrap blocking cells. Add `stalled` (hit action cap) to `Result` and report it. Run both policies × both unlock configs × 40 seeds.

- [ ] **Step 2: Run baseline.** Run: `pnpm balance`. Expected: report shows stalls and win rates for both policies; record the numbers.

- [ ] **Step 3: Tune constants to the band.** Adjust only constants (placement pressure formula, chain discount, vent amount, cap, sector floors, contract counts, module magnitudes) until casual/no-unlocks lands 10–20% and competent/all-unlocks lands 30–50%, with stalls ≈ 0. Re-run `pnpm balance` after each change. Do not change rules.

- [ ] **Step 4: Verify.** Run: `pnpm balance && pnpm test`. Expected: both bands hold, no stalls, tests pass.

- [ ] **Step 5: Commit.** `git add scripts/balance.ts src/lib/game && git commit -m "feat: two-policy balance harness tuned to difficulty band"`

---

### Task 6: Ambient motion

**Files:**

- Modify: `src/lib/styles/neon.css`

**Interfaces:**

- Consumes: `.reduce-motion` class on `.app-root` (already applied in `App.svelte`).
- Produces: `reactor-breathe`, `scan-sweep`, `bg-drift` keyframes and classes.

- [ ] **Step 1: Add keyframes + classes** in `neon.css`: a slow breathing glow on `.reactor` (~5 s), a scanning sweep pseudo-element over the reactor (~6 s linear), and a subtle background drift on `.app-root`. Gate all behind `.reduce-motion` and `@media (prefers-reduced-motion: reduce)` (animation: none). The gauge fill already transitions width; leave it.

- [ ] **Step 2: Verify visually + reduced motion.** Run `pnpm dev`, confirm ambient motion at rest and that it disappears with the reduce-motion setting. Run `pnpm lint && pnpm check`.

- [ ] **Step 3: Commit.** `git add src/lib/styles/neon.css && git commit -m "feat: ambient reactor breathing, scan sweep, and drift"`

---

### Task 7: Overlay and screen transitions

**Files:**

- Modify: `src/lib/components/App.svelte`, `PreviewOverlay.svelte`, `DraftOverlay.svelte`, `CardPicker.svelte`, `EndScreen.svelte`, `SectorTransition.svelte`, `TitleScreen.svelte`, `ResearchLab.svelte`, `SettingsScreen.svelte`, `HowToPlay.svelte`

**Interfaces:**

- Consumes: `reducedMotion` store.
- Produces: entrance/exit transitions on overlays and screen swaps.

- [ ] **Step 1: Add transitions.** Import `fade`/`fly`/`scale` from `svelte/transition`. Wrap screen swaps in `App.svelte` with a keyed transition (`duration: $reducedMotion ? 0 : 200`). Add `transition:fade`/`fly` to overlay roots with `duration: $reducedMotion ? 0 : 180`. Keep focus traps and 44 px targets.

- [ ] **Step 2: Verify.** Run `pnpm test && pnpm check && pnpm lint`; open overlays in `pnpm dev` and confirm enter/exit motion and that reduced motion disables it.

- [ ] **Step 3: Commit.** `git add src/lib/components && git commit -m "feat: transitions for overlays and screen changes"`

---

### Task 8: Card and input feel

**Files:**

- Modify: `src/lib/components/RunScreen.svelte` (hand cards, buttons)

**Interfaces:**

- Consumes: `animate:flip` from `svelte/animate`, `reducedMotion`.
- Produces: card flip on refill/removal, hover lift, active press.

- [ ] **Step 1: Add motion.** Add `animate:flip={{ duration: $reducedMotion ? 0 : 200 }}` to hand cards (key by index as today). Add CSS hover `translateY(-3px)` and `:active` `scale(0.97)` to `.card` and action buttons, with a brief selected-card pop. Gate transforms under reduced motion.

- [ ] **Step 2: Verify.** Run `pnpm test && pnpm check && pnpm lint`; confirm cards slide on refill and press feedback works; axe/e2e still green (`pnpm e2e` after build).

- [ ] **Step 3: Commit.** `git add src/lib/components/RunScreen.svelte && git commit -m "feat: card flip, hover lift, and press feedback"`

---

### Task 9: Fusion chain playback

**Files:**

- Create: `src/lib/components/FusionPlayback.svelte`
- Modify: `src/lib/components/RunScreen.svelte`, `src/lib/styles/neon.css`
- Test: `src/lib/components/run.test.ts`

**Interfaces:**

- Consumes: Task 1 `PlacementPreview.steps` (chosen path), `reducedMotion`.
- Produces: `FusionPlayback` props `{ steps: FusionStep[]; grid: (string|null)[]; reducedMotion: boolean; onDone: () => void }`; `merge`/`pop`/`flash` keyframes.

- [ ] **Step 1: Write failing test.** In `run.test.ts`: after a confirmed multi-step placement with `reducedMotion` false, a ghost/playback layer renders with one element per involved cell; with `reducedMotion` true, no playback layer renders. Assert a new placement clears the previous playback (no input lock).

- [ ] **Step 2: Run test, verify fail.** Run: `pnpm test -- run`. Expected: FAIL.

- [ ] **Step 3: Implement.** `FusionPlayback` renders an absolutely-positioned 5×5 ghost grid matching `.reactor` geometry, showing pre-commit tiles; each involved cell gets a `merge` animation delayed by `step * min(90, 700 / steps.length)` ms; the surviving cell gets `pop` + `flash`. Lifetime = `700 + per-cell duration`; call `onDone` and clean up timeouts on destroy. `RunScreen` captures `preview.steps` + pre-commit grid on `confirm`, sets playback state, and clears it on the next confirm (cancel previous) or `onDone`. Add keyframes to `neon.css`, gated by reduced motion. ParticleField burst stays engine-untouched, aligned in time with playback start.

- [ ] **Step 4: Run tests + build.** Run: `pnpm test && pnpm check && pnpm build && pnpm check:bundle`. Expected: PASS, budget held.

- [ ] **Step 5: Commit.** `git add src/lib/components/FusionPlayback.svelte src/lib/components/RunScreen.svelte src/lib/styles/neon.css src/lib/components/run.test.ts && git commit -m "feat: staggered fusion chain playback along the chosen path"`

---

### Task 10: Full verification and visual check

**Files:** none (verification only)

- [ ] **Step 1: Run the full gate.** Run: `pnpm validate && pnpm check && pnpm lint && pnpm test && pnpm build && pnpm check:bundle && pnpm test:e2e`. Expected: all green.

- [ ] **Step 2: Visual check in a real browser.** Serve the build; verify a multi-branch fusion plays back along the chosen path, overlays transition, ambient motion runs at rest, and reduced-motion mode removes all of it. Confirm the seed readout and that a new run varies.

- [ ] **Step 3: Commit any fixes, then final commit.** `git commit -m "chore: motion and gameplay verification"` (only if changes were needed).
