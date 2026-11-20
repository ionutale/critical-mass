# Critical Mass — Mechanics Redesign — Design

Date: 2026-11-20
Status: awaiting human approval
Scope: Full mechanical redesign, keeping only the Critical Mass name and neon-reactor theme. Replaces the 20–30 minute roguelike with a 3–8 minute turn-based arcade score-chase.

## 1. Intent

Critical Mass currently plays as a 20–30 minute roguelike whose chain resolves around the player. The human partner's verdict after playing the improved build: **not enough meaningful decisions**. The redesign keeps the name, the neon reactor, and the element-fusion fantasy, and replaces every mechanical system beneath them.

The new game is a **turn-based arcade puzzle**: place element cards on a persistent 5×5 reactor, fuse by valence, chase a high score, and survive escalating heat. A run is 3–8 minutes. Depth comes from trade-offs (heat vs score vs space), combinatorial builds (three drafted upgrades), spatial planning (where to place so chains sum correctly), risk calibration (push for rarity or stabilize), and adaptation (the board and hand change every turn). Interaction is **direct manipulation with continuous motion**: cards are dragged, fused tiles slide and merge, and objects move across the screen rather than disappearing and reappearing.

## 2. Goals, non-goals, anti-goals

### Goals

- Make most turns offer at least two genuinely viable plays.
- Support several viable build archetypes through upgrade drafting, not one dominant line.
- Deliver runs in the 3–8 minute band.
- Make every fusion a real trade-off between points, heat, and board space.
- Make interaction direct and continuous: gestures place and manipulate objects, and every state change reads as movement.
- Preserve the app's accessibility, reduced-motion, offline, sound, and installability guarantees.
- Keep a skill-expressive score spread: better play scores visibly higher without runaway luck.

### Non-goals

- No iconography or chemistry education; real element names are flavor, and the valence/mass values are game properties.
- No multiplayer, accounts, backend, leaderboards, or monetization.
- No contracts, sectors, or roguelike map.
- No permanent stat upgrades between runs.

### Anti-goals

- It must not become a 2048 clone where the only decision is which cell to drop into.
- It must not hide outcomes: the Preview must equal the commit.
- It must not punish the player with an unwinnable board; a free Scrap must always be available.
- It must not become a spreadsheet of valence arithmetic with no spatial or risk decision.

## 3. Constraints

- In-place rewrite of the existing repo and app at the same deploy URLs.
- SvelteKit 3 + Svelte 5 + TypeScript; client-rendered PWA; 250 KB gzip client-JS budget; no new runtime dependencies.
- Keep the existing shell, sound, motion, reduced-motion store, accessibility work, and offline behaviour.
- Determinism: a seed and the same inputs produce the same run; the Preview must equal the commit.
- Save schema bumps; existing runs reset; settings and meta unlocks persist.
- Mobile-first: 44 px targets, focus traps, keyboard play, axe-clean.
- Input parity: pointer/touch drag is primary, but every placement has a keyboard equivalent (arrow keys + Enter/Space); swipe gestures are optional accelerators.
- Reduced motion: the user setting or OS preference collapses all choreography to instant, non-moving state changes everywhere, not just the board.

## 4. Decisions already made with the human partner

- **Why:** not enough meaningful decisions.
- **Scope:** full mechanical redesign; keep only theme/name; fusion, grid, pressure, and run structure are all free.
- **Core activity:** spatial fusion puzzle, redesigned.
- **Tension:** escalating overload.
- **Run shape:** quick arcade runs.
- **Depth:** trade-offs, combinatorial builds, spatial planning, risk calibration, adaptation.
- **Time:** discrete turn-based moves.
- **Fusion family:** property-based emergent fusion; specifically valence-sum transmutation.
- **Pieces:** deck + hand.
- **Run goal:** score chase until overload.
- **Board:** compact 5×5 square grid, persistent tiles.
- **Overload:** heat track with a Stabilize action.
- **Scoring:** chain length + result rarity.
- **Builds:** starter deck + upgrades; three per run at heat quarters; draft 1 of 3.
- **Meta:** light unlocks — options, not stats.
- **Preview:** full chain, result, and heat cost before commit.
- **Cards:** each card is an element; placing it puts the element tile on the board.
- **Content:** real light elements with assigned game valences.
- **Definition of done:** ≥2 viable plays per turn, multiple viable builds, 3–8 minute runs, real trade-offs, skill-expressive score spread.
- **Gestures:** drag cards onto cells as the primary input; swipe up to Stabilize; drag a tile off its cell to Scrap; swipe down to cancel.
- **Motion:** continuous, full-app choreography — objects fly, slide, and merge; nothing teleports.
- **Preview timing:** live preview while dragging over cells, before release.
- **Access:** keyboard placement path retained alongside gestures; reduced motion honored everywhere.

## 5. Approaches considered

- **Fusion:** fixed recipe table (rejected: predictable but shallow), compound molecules / shell-clearing (rejected: harder to teach, scoring less direct), **valence-sum transmutation (chosen):** a single rule generates chains, combinations, and spatial decisions.
- **Loop:** keep the roguelike (rejected: wrong shape for arcade depth and mobile sessions), **quick arcade score-chase (chosen):** short runs, immediate replay, heat as the only clock.
- **Pieces:** next-piece queue / open pool / shop (rejected: less build variety), **deck + hand (chosen):** variance plus build-around within a run.
- **Board:** clear-on-fuse / hex / line / growing (rejected for speed, clarity, or scope), **persistent 5×5 (chosen):** space becomes a real resource and high-valence results become a deliberate clog trade-off.
- **Meta:** none / challenges-only / stat upgrades (rejected: flat or inflationary), **light option unlocks (chosen):** keeps future runs fresh without power creep.

## 6. The design

### 6.1 The reactor and the turn

- The Reactor is a **5×5 grid** of Cells. Tiles persist until consumed by a Fusion or removed by Scrap.
- The player holds a **Hand of 5 Cards**. A Card is an Element; placing it puts that Element Tile on an empty Cell.
- A **Turn** is exactly one action:
  - **Place** a Card on an empty Cell, resolving its Chain, then end the turn.
  - **Stabilize**: discard one Card, reduce Heat, then end the turn **without drawing** — the lost Card is the cost.
  - **Scrap**: remove one Tile for free, **once per turn**; Scrap does not end the turn and costs no Card. It prevents soft-locks.
- At the end of a **Place** turn: **Heat +3**, then draw back up to Hand size (reshuffling the discard pile when the Deck is empty). A **Stabilize** turn also adds +3 Heat but does not draw. A **Scrap** does not end the turn.
- The Reactor starts with one or two **deterministic seed Tiles** derived from the run's seed, so the first turn already offers a real choice.
- The game is fully deterministic given the seed and the same choices; a seed is displayed and reproducible.

### 6.2 Elements, valence, and fusion

Every Element has two game properties:

- **Valence** 1–4 — whether it fuses and what it produces.
- **Mass tier** 1–3 — inherited by the result, setting its Rarity and score.

The compact set is **12 real light elements**, one for each (valence, mass) pair. These are game properties, not chemical claims.

| Valence | Mass 1       | Mass 2         | Mass 3         |
| ------- | ------------ | -------------- | -------------- |
| 1       | Hydrogen (H) | Lithium (Li)   | Sodium (Na)    |
| 2       | Helium (He)  | Beryllium (Be) | Magnesium (Mg) |
| 3       | Carbon (C)   | Nitrogen (N)   | Oxygen (O)     |
| 4       | Neon (Ne)    | Silicon (Si)   | Iron (Fe)      |

**Fusion rule:** when a placed Tile has a neighbouring Tile — **orthogonal or diagonal** (8-way adjacency) — whose Valence sum is **≤ 4**, the pair fuses. Both Tiles are consumed and replaced by the Element at **(sum valence, higher mass tier)** on the same Cell as the placed Tile. The chain repeats from the result while a matching neighbour exists.

Examples: H(1,1)+H(1,1) → He(2,1); Li(1,2)+He(2,1) → N(3,2); C(3,1)+H(1,1) → Ne(4,1); Mg(2,3)+He(2,1) → Fe(4,3).

- **Rarity = valence × mass tier** (2–12).
- **Valence-4 results are terminal**: they cannot fuse further. They score the most per fusion but occupy a Cell permanently until Scrapped — the central space-versus-points trade-off.
- No recipe table exists. The result is a pure function of the two Tiles' (valence, mass), so it is fully Previewable.

### 6.3 The Chain and the Preview

- A **Chain** is the ordered sequence of Fusions caused by one placement. It continues while the current result has a fusable neighbour.
- The **Preview** shows, before commit: every Chain step (inputs → result, rarity, points), the total Heat cost, the resulting board, and any milestone that would trigger. The commit must reproduce the Preview exactly.
- When several neighbours can fuse, the player chooses the branch per step in the Preview (reusing the branch-selection model already built), and the chosen path is what commits.

### 6.4 Heat, Overload, and Stabilize

- Heat starts at **0**, cap **100**. Reaching 100 is **Overload** and ends the Run.
- Heat rises by **+3 per turn**, plus each Fusion's **valence sum** (2–4), plus **+1 per Chain step after the first**.
- **Rising floor:** Heat can never be reduced below **3 × the current turn number** (the passive heat already accumulated). Stabilize removes **15 Heat**, but only down to that floor, so cooling forever cannot outrun the clock.
- **Resolution order:** a placed Chain resolves **fully** and scores; then Overload is checked; then the end-of-turn **+3** is applied and Overload is checked again. A lethal placement is a valid finisher, and the Preview can always show the exact commit.
- **Stabilize** discards one Card, removes up to 15 Heat (to the floor), applies the end-of-turn +3, and ends the turn **without drawing**.
- **Milestones** at **25 / 50 / 75 Heat**. Each milestone crossed queues one Upgrade draft; if a single turn crosses two, two drafts are queued in order.
- Heat never falls except through Stabilize and upgrade effects. This is the run clock.

### 6.5 Score

- Each Fusion scores **chain step index × Rarity** (step 1 = ×1, step 2 = ×2, …). Score is awarded immediately; the result Tile remains.
- Upgrade effects may multiply or add to specific fusions; no hidden multipliers.
- A run's **Score** is the sum. The best Score persists locally.
- The score curve rewards longer chains and higher mass, so the highest-value plays are also the hottest and the most space-hungry.

### 6.6 Deck, Hand, and Upgrades

- **Starter Deck (10):** H×5, Li×2, He×2, Be×1. Hand size 5; draw back to hand size at the end of a Place turn; the discard reshuffles when the Deck empties.
- Three **Upgrade drafts per run**, at 25/50/75 Heat, each offering **1 of 3**.
- Drafted cards enter the **discard pile**, so they surface within a deck cycle.
- The upgrade pool mixes cards and modifiers (concrete first-pass pool):
  - Cards: add 2× H; add 2× He; add 1× Li; add 1× C; add 1× Be; add 1× Na; add 1× O. (Na and O are mass-3, so every Rarity is reachable without unlocks.)
  - **Coolant:** Stabilize removes 15 more Heat.
  - **Efficient Fusion:** each Fusion adds 1 less Heat.
  - **Chain Reaction:** Fusions at Chain step 3+ score +50%.
  - **Salvage:** Scrap twice per turn instead of once.
  - **Deep Hand:** Hand size +1.
  - **Heat Sink:** once per turn, the first Fusion adds no Heat.
  - **Rarity Bonus:** Valence-4 results score +25%.
  - **Echo:** the first Stabilize each run draws as normal (no tempo loss).
- Upgrade effects stack and define the run's Build. Exact magnitudes are the builder's tuning call.

### 6.7 Meta progression

- Light unlocks earned from cumulative play (total score, best chain, runs completed). They add **options**, never stats; every Element and every Rarity is reachable on a fresh save, so unlocks widen variety rather than gate power:
  - Alternate starter cards and extra copies to vary the opening.
  - New upgrade-pool entries.
  - Challenge modifiers (e.g., begin hotter for a score bonus, or alternate adjacency).
- A small unlock tree (roughly 8 nodes) replaces the old Research Lab. Exact costs and triggers are the builder's call.

### 6.8 Screens

- **Title:** play, how to play, unlock tree, settings, best score, seed.
- **Run:** reactor, heat bar with milestones, hand, deck/discard counts, score, Stabilize/Scrap, Preview overlay, upgrade draft overlay.
- **End:** score, best, chain stats, unlock progress, play again.
- **How to play:** the valence rule, a worked example, heat, upgrades.
- Remove: contract board, sector transitions, research tree, elemental recipe browser.

### 6.9 Input, gestures, and motion

- **Primary input is direct manipulation.** The player picks up a Card from the Hand and drags it; the Card follows the pointer as a floating Tile. Hovering an empty Cell highlights it and shows the **live Preview** (chain steps, result, heat, milestone). Releasing over a valid Cell commits exactly the previewed play; releasing outside the board, or swiping down, cancels. Tap-to-pick-up then tap-a-cell is the fallback for users who do not drag.
- **Swipes:** swipe up on the reactor (not on a Tile) opens the Stabilize card picker (or uses the already-selected Card); dragging a placed Tile off its Cell and releasing Scraps it; swipe down cancels the current drag or selection.
- **Keyboard parity:** a full placement path exists — focus a Card, use arrow keys to move a ghost Tile across the 8-way board with the same live Preview, Enter/Space commits, Escape cancels. Stabilize, Scrap, and draft choices are ordinary buttons. Gestures are accelerators, never the only path.
- **Continuous choreography, app-wide.** Nothing teleports:
  - A placed Card flies from the Hand to its Cell; consumed Tiles slide into the result and visibly merge; the result scales/pops; the score floats up; the Heat bar animates to its new value.
  - Chain steps play in order, each one carrying the previous result forward.
  - Hand refills deal in; discards fly to the discard pile; upgrade drafts deal their cards.
  - Heat milestones pulse the bar; Overload surges it, shakes the reactor, and transitions to the End screen.
  - Screen and overlay changes keep the existing transition system.
- **Reduced motion:** the user setting or OS preference replaces every move with an immediate, non-moving state change (no flights, slides, merges, shakes, or looping ambient motion), while keeping the same information.
- **Performance:** motion uses transform/opacity and composited layers; the existing particle canvas stays; animations are short and never block input; the 250 KB gzip budget and no-new-dependency rule stand.

## 7. What is kept vs replaced

**Kept:** app shell and routing, SvelteKit/PWA setup, service worker/offline, sound system, motion layer (ambient, transitions, chain playback, card feel), reduced-motion store, accessibility patterns, storage plumbing, deploy configuration.

**Replaced:** fusion engine, turn engine, contracts/sectors, modules/patches, research unlocks, the 30-element recipe ladder, and the save schema (bumped; old runs discarded, settings preserved).

## 8. Verification and acceptance

- Unit tests: valence fusion and result mapping, chain resolution with branch choices, Preview === commit, heat and milestone resolution, score math, deck/hand/reshuffle, deterministic seeded runs, save migration/reset.
- Component tests: placement flow, Preview options, Stabilize/Scrap, upgrade draft, end screen, reduced-motion absence.
- Interaction tests: drag placement, tap placement, and keyboard placement all commit the same previewed play; swipe up Stabilizes; dragging a tile off Scraps; swipe down cancels; reduced motion removes every flight, slide, merge, and shake.
- E2E: cold start, full short run, upgrade draft, overload, reload/resume, PWA/offline, keyboard play, touch drag on a phone viewport, axe audits, 44 px targets, and a reduced-motion run.
- Balance harness: seeded runs with at least two reference policies; assert ~20–30 turns (mapped to 3–8 minutes with a fixed seconds-per-turn assumption), that a stabilize-only policy still eventually Overloads (rising floor), ≥2 viable plays on typical turns, multiple upgrade archetypes viable, and a skill-expressive score spread. The first pass reports distributions rather than a single win rate.
- Real-browser visual check of the new loop.

## 9. What is left to the builder

- Exact heat constants, deck/hand sizes, Stabilize amount, and milestone positions (tuned to the 3–8 minute band).
- Exact upgrade magnitudes and the final upgrade-pool expansion.
- The meta-unlock tree, costs, and triggers.
- The score curve's final constants.
- The precise implementation of branch selection within the new Preview.
- Migration mechanics for the save schema bump.
- Onboarding copy and the tutorial's worked example.

## 10. Risks and open questions

- **Depth vs simplicity:** valence arithmetic must generate interesting choices; the upgrade pool and board space carry much of the depth. Playtesting must confirm ≥2 viable plays.
- **Terminal clutter:** valence-4 Tiles clog the board; the Scrap economy must keep this tense, not tedious.
- **Heat tuning:** the +3/turn baseline and fusion costs must produce 3–8 minute runs across builds.
- **Loss of roguelike variety:** removing contracts/sectors trades long-arc variety for arcade replay; score chasing and meta unlocks must compensate.
- **Content identity:** elements of the same valence but different mass are meaningfully different only through rarity/score; playtesting should confirm that feels legible and worth building around.
- **Gesture discoverability and conflict:** drag must not fight page scroll or browser back-swipe; swipe shortcuts need visible affordances; the keyboard path must be documented and tested.
- **Motion performance:** full-app choreography must hold frame rate on mid-range phones; reduced motion is the escape hatch, not a fix for jank.
