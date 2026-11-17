# Critical Mass — Motion & Gameplay Expansion — Design

Date: 2026-11-17
Status: awaiting human approval
Scope: Two interlocking efforts in the existing game — (A) a motion layer across the run screen, and (B) gameplay improvements: player-directed chains, focused content expansion with variable starts, and balance repair. No new game systems.

## 1. Intent

Critical Mass currently has a correct, previewable fusion engine and a complete PWA, but it reads as static and its decisions are narrower than they could be. Two changes address that:

1. **Motion.** The game already has a gauge pulse, a meltdown shake, and a canvas particle burst, but tiles appear and vanish instantly, overlays pop in without transitions, and the board is still at rest between turns. Add a cohesive motion layer so a fusion chain reads as a sequence, screens feel responsive, and the reactor feels alive — while keeping the existing reduced-motion guarantees and bundle budget.
2. **Gameplay.** Today the player chooses a card and an empty cell, then the chain resolves automatically in a fixed N→E→S→W order: the chain is not a decision. Make the player choose which branch the chain takes at every step, planned in the preview before commit. Expand content moderately and vary run starts. Repair the balance instrument, which currently cannot finish a run.

The two connect: the staggered chain animation in Part A follows the player's chosen path from Part B.

## 2. Goals, non-goals, anti-goals

### Goals

- Make a fusion chain legible: each step, its cell, and its result animate in sequence along the player's chosen path.
- Add motion to overlays, screens, cards, and ambient board life without a new dependency.
- Make branch selection a real, previewable decision available by mouse, touch, and keyboard.
- Increase content roughly 25–40% and add variable run starts for replayability.
- Repair the balance sim so it measures the game, then tune constants toward the documented targets (10–20% wins with no unlocks, 30–50% with all unlocks).

### Non-goals

- No new major systems (bosses, random events, sector map, enemy AI, online features).
- No redesign of the procedural sound system; it stays as-is.
- No backend, accounts, multiplayer, or monetization.
- No new animation library; no save-schema version bump unless truly unavoidable.

### Anti-goals

- Motion must not obscure information, shift layout, shrink 44 px touch targets, or break focus/keyboard flow.
- Gameplay changes must not make chain outcomes hidden or non-deterministic: `preview === commit` and seeded reproducibility are hard constraints.
- Content growth must not break existing saves (contract ids, module ids, and unlock ids already in a save must remain valid).

## 3. Constraints and current state

- SvelteKit 3 + Svelte 5.57 + TypeScript, client-rendered SPA (`ssr = false`, no `$lib`; use relative or `#lib` imports).
- Bundle budget: 250 KB gzip client JS, enforced by `pnpm check:bundle`. No new runtime dependencies.
- `src/lib/stores/motion.ts` derives `reducedMotion` from the user setting plus `prefers-reduced-motion`; `neon.css` has `.reduce-motion` and media-query overrides. All new motion must route through this.
- `src/lib/game/fusion.ts`: `previewPlacement` finds the first matching neighbor in N→E→S→W order via `findRecipe`; `FusionStep` records `step, a, b, result, cell, pressure`; `placeCard` calls `previewPlacement` and commits its grid/pressure. `PreviewOverlay.svelte` already staggers its step list with `animation-delay: index * 90ms`.
- `src/lib/components/ParticleField.svelte` already draws a canvas burst on each placement (`burst` counter) and a larger one on meltdown.
- `scripts/validate-content.ts` enforces content invariants (launch counts, recipe reachability, unique ids, contract sectors, module effects, unlock costs).
- `scripts/balance.ts` runs 40 seeds with a greedy policy and has a 4,000-action cap.
- **Measured baseline (this design's author, 2026-11-17):** `pnpm balance` reports 0 wins / 0 meltdowns in 80 runs. A trace of seed 1 shows the run stalls on contract `s2-1b` ("deliver 1 S") with a full 25/25 board and pressure pinned at the sector floor of 20. The policy repeatedly vents, scraps one tile, and places a basic card back — it never builds toward the target. The game's winnability is unproven because the instrument cannot play competently.

## 4. Decisions already made with the human partner

- Motion scope: all four areas — fusion/grid feedback, scene & overlay transitions, ambient aliveness, cards & input feel.
- Motion implementation: CSS keyframes + Svelte built-in transitions/`animate:flip`, driven by the existing `steps` array. No library, no central FX event channel.
- Gameplay focus: deeper strategy & combos, more content & replayability, balance & difficulty curve. No new systems.
- Depth lever: player-directed chains — expose all candidate neighbors at each step; the player picks the branch.
- Branch timing: plan the full path in the preview before commit; commit replays exactly that path. No live step-by-step resolution.
- Content scope: focused expansion (~25–40% more content) plus variable starting decks/boards. Not a doubling, not variety-only, not new systems.
- Run seeding: `newRun()` generates a fresh random seed per run so variable starts actually vary; the seed is shown in the UI so runs remain reproducible/shareable. Tests and the balance sim keep explicit seeds. "Seeded reproducibility" means same seed → same run.
- Balance targets: two reference players. A casual policy must land 10–20% wins with no unlocks; a competent policy must land 30–50% with all unlocks. Constants are tuned to this band, not to a single policy.

## 5. Approaches considered

### Motion

- **A. CSS + Svelte built-ins (chosen).** CSS keyframes for ambient/loop effects, Svelte `transition:`/`animate:flip` for overlays, screens and cards, and the ordered `steps` array for staggered per-cell flashes. Zero bundle cost, direct reuse of the reduced-motion store, and the chain animation naturally follows the chosen path. Tradeoff: exact orchestration is more manual than a timeline library.
- **B. Lightweight animation library (Motion One / anime.js).** Cleaner declarative timelines and spring easing, but ~10–20 KB gzip against the budget, its own reduced-motion integration, and a dependency in an intentionally dependency-light repo.
- **C. Central FX event channel.** A store emits typed motion events from game actions; components subscribe. Most testable and single-point reduced-motion enforcement, but the most architecture for a small game and risks over-engineering.

### Strategic depth

- **Player-directed chains (chosen).** Converts the automatic chain into the core decision while preserving deterministic preview and reproducibility. Requires changes to the preview API, `placeCard`, and the preview overlay.
- **Combo/synergy layers.** Keep the fixed chain and add effects that reward chain length, adjacency, and tiers. Lower risk but does not fix the "chain is not a decision" problem.
- **Variable runs / between-contract choices, or content-only.** Add variety but not depth. Variable starts are included in the content scope; content-only was rejected as the sole depth lever.

### Branch timing

- **Plan full path in preview (chosen).** Keeps `preview === commit`, keyboard focus trap, and the "no hidden outcomes" anti-goal. The motion layer then plays back the chosen path.
- **Auto-default with optional overrides.** Cheap and preserves casual play, but weaker as a depth change.
- **Live step-by-step resolution.** Most dramatic with motion, but breaks full-outcome preview and the deterministic guarantee.

### Balance

- **Repair the sim, then tune constants (chosen).** Make the policy target-aware, add stall reporting, then tune pressure/contract/vent constants to the targets. Measures the game rather than the policy's blindness.
- **Tune constants only.** Would chase a 0% baseline caused by the policy, not the rules.
- **Replace the sim with a solver.** More accurate win rates but a much larger, slower tool than this game needs.

## 6. The design

### Part A — Motion layer

**A1. Fusion & grid feedback.** Extend the run screen with transient visual state describing the committed chain. On confirm, capture the chosen steps from the preview before clearing it. Render a short-lived ghost grid over the reactor showing the pre-commit tiles at their cells, with a per-cell `merge` animation delayed by `step * stagger`, where `stagger = min(90ms, budget / steps.length)` so chains up to the engine's 24-step maximum always fit a fixed ~700 ms playback budget; the surviving cell gets a `pop` (scale 0.6 → 1.06 → 1) and a `flash` glow. The ghost layer lives `budget + per-cell duration` and is removed with timeout cleanup on effect teardown. A new placement cancels the previous playback immediately (no input lock — game pace is unchanged). Under `reducedMotion`, none of this renders. The existing `ParticleField` burst stays engine-untouched and is aligned in _time_ with the playback start; per-step particle origins along the path are explicitly out of scope (the per-cell flash conveys the path).

**A2. Scene & overlay transitions.** Add Svelte `transition:` directives (`fade`, `fly`, `scale`, ~150–250 ms) to overlays and dialogs (preview, draft, discard, vent, end, sector transition) and to screen swaps in `App.svelte`. Pass `duration: $reducedMotion ? 0 : <base>` explicitly so the user setting and system preference both take effect. Use `{#key}` blocks only where a state change must re-trigger an entrance.

**A3. Ambient aliveness.** Add slow CSS keyframes in `neon.css`: a breathing glow on the reactor, a scanning sweep pseudo-element over the grid (~6 s linear), and a subtle background drift. Give the pressure-gauge fill a size/color transition on value change in addition to its existing pulse. Gate all of it behind `.reduce-motion` and the media query.

**A4. Cards & input feel.** Use `animate:flip` on hand cards so refills and removals slide into place; add CSS hover lift and `:active` press feedback to cards and buttons, with a brief selected-card pop. Preserve 44 px targets, focus rings, and axe results.

### Part B — Gameplay

**B1. Player-directed chains.** Change `FusionStep`/`PlacementPreview` to carry, for each step, the list of candidate neighbors (`cell`, other tile, resulting tile, pressure) and which one was chosen. `previewPlacement(run, handIndex, cell, elements, recipes, choices = [])` considers every neighbor with a valid recipe at each step; when `choices[stepIndex]` is supplied and valid it uses that option, otherwise the first (N→E→S→W) for backward compatibility. `placeCard` accepts the same `choices` and commits via a fresh `previewPlacement` call with identical arguments, guaranteeing `preview === commit`. `RunScreen` holds the transient `choices` array; `PreviewOverlay` renders each step's options as real buttons (label: neighbor tile → result, pressure cost), and picking one updates `choices` and recomputes the preview. All option buttons participate in the existing focus trap, so Tab/Enter works. Choices are UI-only and are not saved.

**B2. Content & variable starts.** Grow content moderately: elements/recipes (24 → roughly 30–32), contract templates (30 → roughly 40), modules (24 → roughly 30), patches (6 → roughly 8), unlocks (12 → roughly 16), keeping the alpha-ladder progression plausible and every new target reachable. Add a small `START_VARIANTS` table (roughly 4 entries) selecting, from the run seed, the starting tile position and a slightly different H/He deck mix; the first contract stays a valid sector-1 slot-1 template. `newRun()` picks a fresh random seed (via `crypto.getRandomValues`, falling back to `Date.now()`), replacing the hard-coded seed 42; the seed is displayed in the run UI (small mono readout) so a run is reproducible and shareable. Keep all new ids unique and leave existing ids in place so old saves remain valid.

**B3. Balance repair.** Replace the single greedy policy with a two-player harness in `scripts/balance.ts`: a **casual** policy (limited planning, cheap-fusion preference, no multi-step branch search) targeting 10–20% wins with no unlocks, and a **competent** policy (target-aware; when the contract target is absent, prefers placements whose resulting grid contains it, using the new `choices` API to plan multi-step paths, otherwise raises tile tier toward the target; vents only when useful and scraps blocking cells) targeting 30–50% wins with all unlocks. Report stall count (runs hitting the action cap) alongside wins, meltdowns, contracts, peak pressure, and sector, for both policies and both unlock configurations. Then tune constants only — placement pressure formula, chain discount, vent amount, cap, sector floors, contract counts, module magnitudes — so both acceptance bands hold. Keep 40 seeds.

### Verification

- `pnpm validate`, `pnpm check`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm check:bundle`, `pnpm e2e` all pass.
- New unit tests: multi-candidate branching, invalid-choice fallback, `preview === commit` with non-default choices, deterministic playback; random-seed generation and seed display; content counts and reachability; balance harness terminates without stalls and hits both policy bands.
- New component tests: option buttons render and update the preview; flash/ghost elements are absent under `reducedMotion`.
- Visual verification in a real browser of a chained fusion, an overlay transition, and reduced-motion mode.

## 7. What is left to the builder

The following are deliberately the implementer's calls within the above boundaries: exact keyframe durations/easings and ghost-layer DOM structure; how to key `animate:flip` for a hand keyed by index; the concrete list of new elements, recipes, contracts, modules, patches, and unlock ids and their balance values; the exact `START_VARIANTS` data; the precise casual and competent policy heuristics; the final numeric constant values; and whether any content addition forces a save-schema change (avoid if possible).
