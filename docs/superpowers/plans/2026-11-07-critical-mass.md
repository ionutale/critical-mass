# Critical Mass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first SvelteKit PWA where the player runs a 5×5 fusion reactor, climbs the alpha ladder to iron, and completes fifteen contracts across three sectors without melting down.

**Architecture:** A pure deterministic engine (seeded RNG, fusion preview/commit, pressure, deck, contracts, drafts, meta) behind a Svelte writable store. Svelte components render the grid, hand, contract, and neon UI; a canvas overlay adds particles. Content is data, validated by tests. Static PWA, local saves.

**Tech Stack:** SvelteKit 2 + Svelte 5 + TypeScript, `@sveltejs/adapter-static`, `@vite-pwa/sveltekit`, Fontsource, Vitest + Testing Library for Svelte, Playwright, pnpm.

**Spec:** `docs/superpowers/specs/2026-11-07-critical-mass-design.md`

## Global Constraints

- Work in `/Users/ionutale/developer-playground/critical-mass`. Use `pnpm`; Node ≥ 20.
- SvelteKit SPA: `ssr = false`, `adapter-static` with `fallback: '200.html'`.
- 5×5 grid; 24 elements; 30 contract templates; 24 modules; 12 meta unlocks.
- Three sectors × five contracts. Win after the sector 3 boss; meltdown at the current pressure cap.
- Only the placed tile fuses; order is N→E→S→W; preview must equal commit exactly.
- Cards are actions and go to discard; tiles are board state. The deck cannot starve.
- Venting costs one discarded card and stops at the sector floor (0/20/40).
- Scrap is free once per turn; a full board is never a soft-lock.
- Catalyst is auto-granted at the start of sector 3 if missing.
- Mobile-first at 360 px; tap-only completes every flow.
- All-ages clever sci-fi; no gore, no grimdark.
- Self-hosted fonts; procedural WebAudio; no audio files.
- Save key: `critical-mass:save:v1`; offline after first load.
- Initial JS ≤ 250 KB gzip.
- Commit after every task.

## Review Focus

1. **Preview equals commit** — chain steps, results, and pressure match exactly. _Task 5._
2. **Card/tile lifecycle and deck starvation** — placing discards the card; fusing/delivering removes tiles only; deck reshuffles. _Task 6._
3. **Pressure cap, vent cost, and floor** — meltdown at the current cap; vent discards one card and respects the floor. _Task 6._
4. **Catalyst solvability** — sector 3 auto-grants Catalyst if missing; its contracts stay reachable. _Task 7._
5. **Full-board soft-lock** — scrap always frees one cell per turn. _Task 6._
6. **Seeded resume** — reload restores the run without rerolling. _Task 8._
7. **Rapid double-submit** — one placement, one attempt, one chain. _Task 10._

## File Map

| Path                          | Responsibility                       |
| ----------------------------- | ------------------------------------ |
| `src/lib/types.ts`            | Shared types and save shape          |
| `src/lib/data/elements.ts`    | 24 elements, tiers, heavy flags      |
| `src/lib/data/recipes.ts`     | Fusion recipes                       |
| `src/lib/data/contracts.ts`   | 30 contract templates                |
| `src/lib/data/modules.ts`     | 24 modules                           |
| `src/lib/data/unlocks.ts`     | 12 meta unlocks                      |
| `src/lib/game/rng.ts`         | Seeded Mulberry32                    |
| `src/lib/game/fusion.ts`      | Chain preview and resolution         |
| `src/lib/game/turn.ts`        | Deck, hand, place, vent, scrap, turn |
| `src/lib/game/contracts.ts`   | Delivery, drafts, sectors, win/loss  |
| `src/lib/game/validate.ts`    | Content validator                    |
| `src/lib/game/storage.ts`     | Save/load/recovery                   |
| `src/lib/stores/game.ts`      | Svelte writable store and actions    |
| `src/lib/components/*.svelte` | Screens and UI                       |
| `src/lib/styles/*`            | Neon tokens, grid, cards             |
| `src/routes/+layout.ts`       | `ssr = false`                        |
| `src/routes/+page.svelte`     | Client-rendered game entry           |
| `src/lib/test/fixtures.ts`    | Test fixtures                        |
| `src/test/setup.ts`           | Jest-dom setup                       |
| `scripts/*`                   | validate, balance, bundle check      |
| `e2e/*.spec.ts`               | Playwright flows                     |

---

### Task 1: Scaffold, SvelteKit SPA, neon shell

**Files:**

- Create: `package.json`, `vite.config.ts`, `src/routes/+layout.ts`, `src/routes/+layout.svelte`, `src/routes/+page.svelte`, `src/routes/page.test.ts`, `src/test/setup.ts`, `src/lib/styles/base.css`, `playwright.config.ts`
- Keep: existing `docs/` folder

**Interfaces:**

- Consumes: nothing
- Produces: running SvelteKit SPA; `pnpm test`, `pnpm check`, `pnpm e2e`

- [ ] **Step 1: Scaffold**

```bash
cd /Users/ionutale/developer-playground/critical-mass
git init
pnpm dlx sv create . --template minimal --types ts \
  --add vitest="usages:unit,component" playwright="demo:no" \
  sveltekit-adapter="adapter:static" prettier eslint \
  --install pnpm --no-dir-check
pnpm add @fontsource-variable/space-grotesk @fontsource-variable/jetbrains-mono
pnpm add -D vite-node @testing-library/svelte @testing-library/jest-dom jsdom
pnpm exec playwright install chromium
```

- [ ] **Step 2: Configure**

`src/routes/+layout.ts`: `export const ssr = false`; `export const prerender = false`.

`vite.config.ts`:

```ts
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit({ adapter: adapter({ fallback: '200.html' }) }), svelteTesting()],
	test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], include: ['src/**/*.test.ts'] }
});
```

`src/test/setup.ts`: `import '@testing-library/jest-dom/vitest'` plus a Map-backed `localStorage` fallback when jsdom does not expose one.

`playwright.config.ts`: 390×844 touch; `webServer` builds and previews on 4173.

- [ ] **Step 3: Failing smoke test**

`src/routes/page.test.ts` renders `Page` and expects a heading matching `/critical mass/i`.

- [ ] **Step 4: Run and confirm failure**

Run: `pnpm vitest run src/routes/page.test.ts`
Expected: FAIL.

- [ ] **Step 5: Minimal shell**

`+page.svelte` returns `<h1>Critical Mass</h1>`. `+layout.svelte` imports Fontsource and `base.css`; near-black `#070B14`, cyan accent, Space Grotesk/JetBrains Mono.

- [ ] **Step 6: Verify and commit**

Run: `pnpm vitest run src/routes/page.test.ts && pnpm check`
Expected: pass.

```bash
git add -A
git commit -m "chore: scaffold SvelteKit SPA with test harness"
```

---

### Task 2: Types, RNG, validator, fixtures

**Files:**

- Create: `src/lib/types.ts`, `src/lib/game/rng.ts`, `src/lib/game/validate.ts`, `src/lib/game/validate.test.ts`, `src/lib/test/fixtures.ts`

**Interfaces:**

- Produces: types; `nextRandom`, `pickIndex`, `shuffleWithState`; `validateContent`; fixtures

- [ ] **Step 1: Types**

`src/lib/types.ts`:

```ts
export interface ElementRecord {
	symbol: string;
	name: string;
	number: number;
	tier: number;
	heavy: boolean;
}
export interface RecipeRecord {
	a: string;
	b: string;
	result: string;
	catalyst: boolean;
}

export type Modifier = 'one-chain' | 'no-vent' | 'pressure-50' | 'two-targets';
export interface ContractTemplate {
	id: string;
	sector: 1 | 2 | 3;
	slot: 1 | 2 | 3 | 4 | 5;
	target: string;
	count: number;
	modifier: Modifier | null;
	brief: string;
}

export type ModuleEffect =
	| 'vent+5'
	| 'cap+10'
	| 'fusion-10'
	| 'hand+1'
	| 'draw+1'
	| 'add-he-2'
	| 'duplicate-card'
	| 'catalyst'
	| 'neutron'
	| 'chain-bonus-2'
	| 'delivery+1'
	| 'reroll'
	| 'count-1'
	| 'draft+1'
	| 'meltdown-save'
	| 'sector-shield';

export interface ModuleRecord {
	id: string;
	name: string;
	description: string;
	effect: ModuleEffect;
}
export interface UnlockRecord {
	id: string;
	name: string;
	description: string;
	cost: number;
	kind: 'card' | 'module' | 'contract';
	ref: string;
}

export type DraftOption =
	| { kind: 'cards'; element: string; count: 2 }
	| { kind: 'module'; moduleId: string }
	| { kind: 'patch'; patchId: string };

export type RunStatus = 'active' | 'meltdown' | 'victory';

export interface RunState {
	seed: number;
	rngState: number;
	grid: (string | null)[];
	deck: string[];
	hand: string[];
	discard: string[];
	pressure: number;
	pressureCap: number;
	sectorFloor: number;
	sector: 1 | 2 | 3;
	contractId: string;
	delivered: number;
	contractsCompleted: number;
	turn: number;
	scrapsUsed: number;
	pendingDiscards: number;
	modules: string[];
	hasCatalyst: boolean;
	ventsThisContract: number;
	maxChain: number;
	deliveredTargets: string[];
	pendingDraft: DraftOption[] | null;
	pendingTransition: boolean;
	status: RunStatus;
}

export interface MetaState {
	research: number;
	unlocks: string[];
	stats: { runs: number; wins: number; bestSector: number; contracts: number };
}

export interface SaveState {
	version: 1;
	run: RunState | null;
	meta: MetaState;
	settings: { sound: boolean; reduceMotion: boolean };
	introSeen: boolean;
}

export interface ContentBundle {
	elements: readonly ElementRecord[];
	recipes: readonly RecipeRecord[];
	contracts: readonly ContractTemplate[];
	modules: readonly ModuleRecord[];
	unlocks: readonly UnlockRecord[];
}
```

- [ ] **Step 2: Failing RNG/validator tests**

`rng.test.ts`: deterministic seed, values in range, `shuffleWithState` permutation, `pickIndex` in range.

`fixtures.ts`: `element`, `recipe`, `emptyGrid`, `metaFixture`, `runFixture`, `tinyContent`.

`validate.test.ts`: accepts tiny content; rejects a recipe whose result is not heavier; rejects unknown elements; rejects unreachable contract targets.

- [ ] **Step 3: Implement**

Mulberry32; Fisher-Yates. Validator checks unique symbols/numbers, ladder order, heavier recipes, H→Fe without catalyst, catalyst→U, 30 contracts, 24 modules, 12 unlocks, two variants per sector slot.

- [ ] **Step 4: Verify and commit**

Run: `pnpm vitest run src/lib/game/rng.test.ts src/lib/game/validate.test.ts && pnpm check`
Expected: pass.

```bash
git add -A
git commit -m "feat: add types, seeded RNG, and content validator"
```

---

### Task 3: Elements and recipes

**Files:**

- Create: `src/lib/data/elements.ts`, `src/lib/data/recipes.ts`, `src/lib/data/elements.test.ts`

**Interfaces:**

- Produces: `ELEMENTS` (24), `RECIPES`

- [ ] **Step 1: Author elements**

15 ladder elements H, He, Be, C, N, O, Ne, Mg, Si, S, Ar, Ca, Ti, Cr, Fe; nine heavies Co, Ni, Cu, Zn, Ag, Au, Hg, Pb, U. Tier 1–24; heavy for the last nine.

- [ ] **Step 2: Author recipes**

Ladder: H+H→He; He+He→Be; Be+He→C; C+H→N; N+H→O; C+He→O; O+He→Ne; Ne+He→Mg; Mg+He→Si; Si+He→S; S+He→Ar; Ar+He→Ca; Ca+He→Ti; Ti+He→Cr; Cr+He→Fe.

Heavy (catalyst): Fe+He→Co; Co+He→Ni; Ni+He→Cu; Cu+He→Zn; Zn+He→Ag; Ag+He→Au; Au+He→Hg; Hg+He→Pb; Pb+He→U.

- [ ] **Step 3: Failing tests**

24 unique elements; every recipe produces a heavier element; validator accepts the element/recipe bundle.

- [ ] **Step 4: Verify and commit**

```bash
git add -A
git commit -m "feat: add the 24-element fusion ladder"
```

---

### Task 4: Contracts, modules, unlocks

**Files:**

- Create: `src/lib/data/contracts.ts`, `modules.ts`, `unlocks.ts`, `src/lib/data/content.test.ts`, `scripts/validate-content.ts`
- Modify: `package.json` (`validate` script)

**Interfaces:**

- Produces: `CONTRACTS` (30), `MODULES` (24), `UNLOCKS` (12), `pnpm validate`

- [ ] **Step 1: Author content**

10 contracts per sector, two variants per slot; sector 1 H–Ne boss Mg, sector 2 Si–Fe boss Fe, sector 3 heavies boss U. Modifiers are bonus objectives. 24 modules across the 16 effects. 12 unlocks, costs 3–12 research, no permanent stat boosts.

- [ ] **Step 2: Failing tests**

30 contracts with 10 per sector; 24 modules; 12 unlocks; every target reachable by its sector; validator passes.

- [ ] **Step 3: CLI**

`scripts/validate-content.ts` prints counts and exits non-zero on errors. `"validate": "vite-node scripts/validate-content.ts"`.

- [ ] **Step 4: Verify and commit**

Run: `pnpm validate && pnpm vitest run src/lib/data/content.test.ts`.

```bash
git add -A
git commit -m "feat: add contracts, modules, and meta unlocks"
```

---

### Task 5: Fusion preview and resolution

**Files:**

- Create: `src/lib/game/fusion.ts`, `src/lib/game/fusion.test.ts`

**Interfaces:**

- Produces: `previewPlacement`, `placeCard`, `PlacementPreview`, `FusionStep`

- [ ] **Step 1: Failing tests**

Preview/commit equality; N→E→S→W order; a two-step chain; meltdown flag at the cap.

- [ ] **Step 2: Implement**

`neighbors(cell)` N/E/S/W. `findRecipeFor` unordered with catalyst. Resolver only moves from the active cell; consumes the first compatible neighbor; pressure `4 + tier + 2×(step−1) + heavy?8`; modules adjust. `previewPlacement` copies state; `placeCard` resolves the same function, discards the card, advances the turn.

- [ ] **Step 3: Verify and commit**

Run: `pnpm vitest run src/lib/game/fusion.test.ts`.

```bash
git add -A
git commit -m "feat: add deterministic fusion preview and resolution"
```

---

### Task 6: Turn, deck, vent, scrap, pressure

**Files:**

- Create: `src/lib/game/turn.ts`, `src/lib/game/turn.test.ts`

**Interfaces:**

- Produces: `createRun`, `endTurn`, `discardCard`, `vent`, `scrap`, `canPlace`

- [ ] **Step 1: Failing tests**

Start deck 8 H/2 He, center H, draw 5; placing discards the card and draws; vent clamps at floor and discards one; scrap once per turn prevents soft-lock; deck reshuffles.

- [ ] **Step 2: Implement**

`createRun`: grid empty with center H; shuffled deck; draw 5; pressure 0/cap 100/floor 0; sector 1; active contract. `endTurn`: turn++, scrapsUsed 0, draw 1, pendingDiscards. `vent`: discard chosen card, pressure floor clamp, end turn. `scrap`: once per turn, removes tile. Cards and tiles are separate.

- [ ] **Step 3: Verify and commit**

```bash
git add -A
git commit -m "feat: add turn, deck, vent, scrap, and pressure rules"
```

---

### Task 7: Contracts, drafts, sectors, completion

**Files:**

- Create: `src/lib/game/contracts.ts`, `src/lib/game/contracts.test.ts`

**Interfaces:**

- Produces: `activeContract`, `deliver`, `generateDraft`, `chooseDraft`, `nextSector`, `researchFor`, `isMeltdown`

- [ ] **Step 1: Failing tests**

Delivery consumes matching tiles and opens a three-option draft at the count; Catalyst auto-granted at sector 3 with floor 40; victory after the sector 3 boss draft; meltdown at the cap with research awarded.

- [ ] **Step 2: Implement**

Contract by sector/slot with seeded variant. Delivery target-only; count; pendingDraft. Drafts: element bundle, module, patch; three unique options. `chooseDraft` applies, increments contractsCompleted, adds research (1 per contract, +3 boss, +1 modifier), advances slot; sector boss sets `pendingTransition`; `nextSector` vents, grants Catalyst at sector 3, opens free module draft. Victory after sector 3 boss; meltdown at cap.

- [ ] **Step 3: Verify and commit**

```bash
git add -A
git commit -m "feat: add contracts, drafts, sectors, victory, and meltdown"
```

---

### Task 8: Save, load, corrupt recovery

**Files:**

- Create: `src/lib/game/storage.ts`, `src/lib/game/storage.test.ts`

**Interfaces:**

- Produces: `SAVE_KEY`, `createInitialSave`, `parseSave`, `loadSave`, `saveGame`

- [ ] **Step 1: Failing tests**

Run + RNG round-trip; corrupted run nulled while meta survives; invalid JSON/wrong version recovers.

- [ ] **Step 2: Implement**

Validate run shape; salvage meta; return `{ save, recovered }`; `saveGame` returns boolean.

- [ ] **Step 3: Verify and commit**

```bash
git add -A
git commit -m "feat: add versioned save with run and meta recovery"
```

---

### Task 9: Svelte store and app shell

**Files:**

- Create: `src/lib/stores/game.ts`, `src/lib/stores/game.test.ts`, `src/lib/components/App.svelte`, `AppBar.svelte`, `BottomNav.svelte`, `src/lib/components/app.test.ts`
- Modify: `src/routes/+page.svelte`

**Interfaces:**

- Produces:
  - `save: Writable<SaveState>`, `recovered: Writable<boolean>`, `run: Readable<RunState|null>`
  - `initGame(seed?, overrides?)`, actions `place`, `vent`, `scrap`, `deliver`, `chooseDraft`, `nextSector`, `unlock`, `setSettings`, `newRun`, `exportSave`, `importSave`

- [ ] **Step 1: Failing store tests**

Starts a run; placement changes pressure; autosaves; corrupt save reports recovered; import/export round-trip.

```ts
import { get } from 'svelte/store';
import { initGame, place, save } from './game';
import { emptyGrid, runFixture } from '../test/fixtures';
import { SAVE_KEY } from '../game/storage';

beforeEach(() => localStorage.clear());

it('places a card and autosaves', () => {
	const grid = emptyGrid();
	grid[12] = 'H';
	initGame(42, { run: runFixture({ grid, hand: ['H', 'H'] }) });
	place(0, 13);
	expect(get(save).run?.pressure).toBeGreaterThan(0);
	expect(JSON.parse(localStorage.getItem(SAVE_KEY)!).run).not.toBeNull();
});
```

- [ ] **Step 2: Implement**

`save` writable initialized from `loadSave`; `run` derived; autosave subscription. Actions call pure engine functions. `newRun` increments stats.runs. No component context.

- [ ] **Step 3: Shell**

`App.svelte` switches Title/Run/Research/Settings/How-to; `BottomNav` with `aria-current`; `AppBar` sector/contract/pressure.

- [ ] **Step 4: Verify and commit**

Run: `pnpm vitest run src/lib/stores/game.test.ts src/lib/components/app.test.ts && pnpm check`.

```bash
git add -A
git commit -m "feat: add Svelte game store, autosave, and app shell"
```

---

### Task 10: Run screen — grid, hand, pressure, preview

**Files:**

- Create: `RunScreen.svelte`, `ReactorGrid.svelte`, `ElementTile.svelte`, `ElementCard.svelte`, `Hand.svelte`, `PressureGauge.svelte`, `ContractPanel.svelte`, `PreviewOverlay.svelte`, `src/lib/components/run.test.ts`
- Modify: `App.svelte`

**Interfaces:**

- Consumes: store, `previewPlacement`
- Produces: tap placement, preview, confirm/cancel, vent, scrap, delivery

- [ ] **Step 1: Failing tests**

```ts
import { fireEvent, render, screen } from '@testing-library/svelte';
import RunScreen from './RunScreen.svelte';
import { initGame } from '../stores/game';
import { emptyGrid, runFixture } from '../test/fixtures';

beforeEach(() => localStorage.clear());

it('previews and confirms a placement', async () => {
	const grid = emptyGrid();
	grid[12] = 'H';
	initGame(42, { run: runFixture({ grid, hand: ['H', 'H'] }) });
	render(RunScreen);
	await fireEvent.click(screen.getByRole('button', { name: /hydrogen card 1/i }));
	await fireEvent.click(screen.getByRole('button', { name: /cell 13/i }));
	expect(screen.getByRole('dialog', { name: /preview/i })).toHaveTextContent(/helium/i);
	await fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
	expect(screen.getByRole('button', { name: /cell 13/i })).toHaveTextContent(/he/i);
});
```

Also: cancel changes nothing; vent requires a card; scrap disables after one; double-confirm cannot double-place.

- [ ] **Step 2: Implement**

Grid buttons `cell N`; hand `hydrogen card N`; preview dialog with exact path/pressure; vent discard dialog; scrap once; contract highlight/deliver; pressure gauge numeric; disable while preview/draft/pendingDiscards.

- [ ] **Step 3: Verify and commit**

```bash
git add -A
git commit -m "feat: add reactor run screen with preview, vent, and scrap"
```

---

### Task 11: Draft, sector transition, meltdown, victory

**Files:**

- Create: `DraftOverlay.svelte`, `SectorTransition.svelte`, `MeltdownScreen.svelte`, `VictoryScreen.svelte`, `src/lib/components/endstates.test.ts`
- Modify: `App.svelte`

- [ ] **Step 1: Failing tests**

Contract completion opens a mandatory three-option draft; sector boss transition vents to floor and grants Catalyst at sector 3; meltdown/victory show stats, research, New run.

- [ ] **Step 2: Implement**

Draft keyboard 1/2/3 and no dismiss. Transition animation reduced-motion aware. Meltdown magenta flash. Victory summary.

- [ ] **Step 3: Verify and commit**

```bash
git add -A
git commit -m "feat: add drafts, sector transitions, meltdown, and victory"
```

---

### Task 12: Research Lab, settings, title, how-to

**Files:**

- Create: `ResearchLab.svelte`, `SettingsScreen.svelte`, `TitleScreen.svelte`, `HowToPlay.svelte`, `src/lib/components/meta.test.ts`
- Modify: `App.svelte`

- [ ] **Step 1: Failing tests**

Research purchase persists; insufficient research disabled; stats; settings toggles; two-step reset; title Continue/New; how-to content.

- [ ] **Step 2: Implement**

12 nodes grouped by card/module/contract; no stat boosts. Settings sound/motion, install guidance, reset run/all, about. Title Continue/New/Settings. How-to sheet.

- [ ] **Step 3: Verify and commit**

```bash
git add -A
git commit -m "feat: add research lab, settings, title, and help"
```

---

### Task 13: PWA, icons, offline

**Files:**

- Create: `static/favicon.svg`, `src/lib/components/PwaUpdate.svelte`, `e2e/pwa.spec.ts`
- Modify: `vite.config.ts`, `+layout.svelte`, `app.d.ts`

- [ ] **Step 1: Install**

```bash
pnpm add -D @vite-pwa/sveltekit @vite-pwa/assets-generator vite-plugin-pwa
```

- [ ] **Step 2: Failing e2e**

Manifest link + 192/512 icons; SW ready; reload; offline; title visible.

- [ ] **Step 3: Configure**

`SvelteKitPWA({ registerType: 'prompt', pwaAssets: { preset: 'minimal-2023', image: 'static/favicon.svg', overrideManifestIcons: true }, manifest: {...}, workbox: { globPatterns: ['client/**/*.{js,css,html,svg,png,ico,woff2}'] }, kit: { includeVersionFile: true } })`.

`PwaUpdate.svelte` uses `useRegisterSW` from `virtual:pwa-register/svelte`.

- [ ] **Step 4: Verify and commit**

Run: `pnpm build && pnpm e2e e2e/pwa.spec.ts`.

```bash
git add -A
git commit -m "feat: add installable PWA with offline cache and update prompt"
```

---

### Task 14: Neon visuals, particles, procedural audio

**Files:**

- Create: `src/lib/game/sound.ts`, `sound.test.ts`, `src/lib/components/ParticleField.svelte`, `particles.test.ts`, `src/lib/stores/motion.ts`, `src/lib/styles/neon.css`
- Modify: all screens

- [ ] **Step 1: Failing tests**

Disabled sound no context; enabled never throws; reduced motion true from setting/OS; particle field deterministic and absent under reduced motion.

- [ ] **Step 2: Implement**

Palette and grid glow; chain path pulses; fusion flashes; meltdown shake; reduced motion removes travel/shake/particles. WebAudio cues: pick, fusion, vent, contract, meltdown, victory. Canvas overlay paused when hidden.

- [ ] **Step 3: Verify and commit**

```bash
git add -A
git commit -m "feat: add neon visual system, particles, and procedural audio"
```

---

### Task 15: Accessibility and keyboard flows

**Files:** Modify components/styles; Create `e2e/a11y.spec.ts`; add `@axe-core/playwright`.

- [ ] **Step 1: Failing tests**

Axe on Run, Draft, Research, Settings, How-to; keyboard select/place/preview/confirm/vent/deliver/draft.

- [ ] **Step 2: Fix**

Focus rings, trapped overlays, live region, 44 px, contrast, pressure not color-only, reduced motion.

- [ ] **Step 3: Verify and commit**

```bash
git add -A
git commit -m "fix: complete keyboard, focus, and contrast accessibility"
```

---

### Task 16: Balance simulator, regression, budget, README

**Files:**

- Create: `scripts/balance.ts`, `scripts/check-bundle.mjs`, `e2e/game.spec.ts`, `README.md`
- Modify: `package.json`

- [ ] **Step 1: Balance**

Seeded runs with a simple policy; report win rate, turns, peak pressure, contracts. Targets 10–20% before unlocks, 30–50% after. Add `"balance"`.

- [ ] **Step 2: Regression e2e**

Cold-start fusion; mid-run resume; vent preventing meltdown; full-board scrap; victory; offline; keyboard.

- [ ] **Step 3: Budget**

Sum gzipped JS under `build/_app/`; fail above 250 KB. Add `"check:bundle"`.

- [ ] **Step 4: README**

Run/test/check/validate/balance/build/e2e, content authoring, fusion rules, pressure constants, deploy.

- [ ] **Step 5: Final verification**

```bash
pnpm validate && pnpm check && pnpm test && pnpm build && pnpm check:bundle && pnpm e2e
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test: add balance simulation, regression suite, budget, and README"
```

---

## Self-Review Notes

- **Spec coverage:** elements/recipes (3), contracts/modules/unlocks (4), fusion (5), turn/pressure/deck (6), contracts/drafts/sectors (7), save (8), store/shell (9), run UI (10), end states (11), meta/settings/title (12), PWA (13), visuals/audio (14), a11y (15), balance/regression (16).
- **Review Focus mapping:** preview=commit → 5; card/tile + deck → 6; cap/vent/floor → 6; catalyst → 7; soft-lock/scrap → 6; seeded resume → 8; double-submit → 10.
- **Type consistency:** `RunState`, `DraftOption`, `ModuleEffect`, `SaveState` defined once; store actions and components share names; engine functions are pure.
