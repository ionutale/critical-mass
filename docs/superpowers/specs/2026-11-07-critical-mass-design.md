# Critical Mass — Design

Date: 2026-11-07
Status: awaiting human approval
Scope: Game B of three independent games. Mendeleev's Mess (A) and the alchemist game (C) are out of scope.

## 1. Intent

A neon reactor roguelike. The player runs a 5×5 fusion reactor, placing element cards to climb the real alpha ladder from hydrogen to iron, then switching to catalyst-gated heavy elements. Every fusion raises pressure; every turn is a choice between progress and cooling. Contracts pay the bills, drafts build the reactor, and a meltdown ends the run.

Runs last 20–30 minutes. Three sectors, five contracts each, one active contract at a time. The tone is all-ages clever sci-fi: the reactor AI is dry, the disasters are dramatic, and nobody dies.

Critical Mass is deliberately the opposite of Mendeleev's Mess: tense instead of relaxed, spatial instead of a list, run-based instead of a permanent collection, and grounded in real fusion pathways instead of absurd pairs.

## 2. Goals, non-goals, anti-goals

### Goals

- Deliver a complete 20–30 minute roguelike run with a clear win and loss.
- Make the fusion chain deterministic and previewable before commitment.
- Use a real alpha-process ladder to iron, then a sci-fi catalyst ladder for heavies.
- Make pressure the central tension: every fusion is progress and danger.
- Make contracts the run's pacing and draft engine.
- Ship a mobile-first installable PWA with offline runs and resume.
- Keep light meta-progression: unlocks widen options, never inflate stats.

### Non-goals

- No 118-element collection; 24 elements is the launch set.
- No real-time action; the game is turn-based.
- No multiplayer, accounts, backend, leaderboards, or monetization.
- No narrative campaign; the reactor AI speaks through briefs and events.
- No permanent stat upgrades between runs.
- No connection to Mendeleev's Mess or Game C.

### Anti-goals

- It must not become a spreadsheet of numbers.
- It must not punish the player with hidden chain outcomes.
- It must not require chemistry knowledge to win, though it should reward it.
- It must not become a clicker or an idle game.
- It must not reuse the notebook/paper visual language; it is neon and synthetic.

## 3. Decisions already made

- Name: **Critical Mass**. Project folder: `critical-mass`.
- Genre: run-based reactor roguelike.
- Board: 5×5 grid.
- Turn: draw, then place one card or vent; deliveries are free but consume tiles.
- Fusion: only the placed tile fuses; deterministic N→E→S→W chain; ghost preview before commit.
- Recipes: real alpha ladder to iron, then catalyst-gated heavies.
- Run: 3 sectors × 5 contracts, 30-template pool, one active contract.
- Win: complete the third sector boss. Loss: pressure reaches the current cap (100 at run start).
- Scope: 24 elements, ~24 modules, ~12 meta unlocks.
- Tone: all-ages clever sci-fi.
- Platform: mobile-first PWA.
- Stack: SvelteKit 2 + Svelte 5 + TypeScript + `@sveltejs/adapter-static` + `@vite-pwa/sveltekit`, DOM/SVG grid with a canvas particle overlay.

## 4. Approaches considered

### Loop shape

| Approach               | Trade-off                                                              | Verdict    |
| ---------------------- | ---------------------------------------------------------------------- | ---------- |
| Grid reactor roguelike | Spatial strategy, clear neon identity, deterministic chains to preview | **Chosen** |
| Card chamber           | Simpler, but close to Game A's forge with a heat track                 | Rejected   |
| Conveyor arcade        | Spectacle and timing, weaker strategy and more input complexity        | Rejected   |

### Chain control

| Approach              | Trade-off                                            | Verdict    |
| --------------------- | ---------------------------------------------------- | ---------- |
| Deterministic preview | Strategic, testable, accessible; extra UI            | **Chosen** |
| Hidden deterministic  | Faster turns, more surprises; feels unfair on mobile | Rejected   |
| Emergent simultaneous | Big combos, least control; hard to test and balance  | Rejected   |

### Stack

| Approach      | Trade-off                                                                                                       | Verdict    |
| ------------- | --------------------------------------------------------------------------------------------------------------- | ---------- |
| SvelteKit PWA | Best for text, cards, accessibility, testing; particles via overlay; small runtime; one stack across the family | **Chosen** |
| Phaser 3      | Better particle tooling; weaker UI, text, accessibility                                                         | Rejected   |
| PixiJS hybrid | Best visuals; two rendering systems, more integration risk                                                      | Rejected   |

## 5. Core loop

### Run start

- 5×5 reactor grid with one Hydrogen tile seeded at the center.
- Starting deck: 8 Hydrogen and 2 Helium cards, shuffled with a run seed.
- Draw 5. Hand limit is 7.
- Pressure starts at 0/100.
- Sector 1, contract 1 is active. The first run's first contract is a scripted "Deliver 1 Helium" teaching contract; later runs draw from the pool.

### Turn structure

1. **Draw:** draw 1 card. If the hand exceeds 7, discard down to 7 (the player chooses). If the deck is empty, shuffle the discard pile into the deck.
2. **Action:** choose exactly one.
   - **Place** a card on an empty cell. Select card → select cell → preview → confirm or cancel. Cancel returns the card to hand. On confirm, the card leaves the hand and goes to the discard pile; the tile on the board is a separate entity.
   - **Vent:** pressure decreases by 15, but never below the sector's pressure floor. Discard one card of your choice; it goes to the discard pile.
3. **Free actions:** deliver any tile matching the active contract (consumes the tile), and **scrap** one tile per turn (removes it with no progress). Scrap exists so a full board can never soft-lock a run.
4. **End turn:** pressure checks happen immediately after a fusion chain, not at end of turn. If pressure is at or above the cap, the run ends in a meltdown.

Deliveries and scrap happen before or after the action; the player may deliver first, then place, or vice versa.

### Cards versus tiles

- A card is an action; a tile is board state. Placing a card moves it to the discard pile, and the tile is a new entity.
- Fusing or delivering a tile removes it permanently; the card that created it cycles back through the deck. Cards are never permanently consumed, so the deck cannot starve.
- Drafted element bundles and "duplicate a card" add cards to the discard pile, available on the next reshuffle.
- The board can shrink through fusion and delivery. The scrap action guarantees an empty cell can always be made on a future turn.

### Fusion resolution

- Only the newly placed tile is active. Placing a tile cannot create adjacency between two existing tiles, so no other pair can fuse.
- Check the active tile's neighbors in fixed order: north, east, south, west.
- The first neighbor that forms a valid recipe fuses. The active cell becomes the result; the neighbor cell empties. The neighbor is consumed.
- Repeat from the active cell. Each fusion adds pressure. A tile may fuse multiple times in one chain; recipes always increase atomic number, so chains terminate.
- If no neighbor is compatible, the tile simply stays.
- The preview computes the exact chain, result tiles, and pressure delta. Resolution must match the preview exactly.
- Chain pressure is `4 + ladderTier(result) + 2 × (chainStep − 1)` for ladder elements; catalyst heavies add +8. Starting values are tuning constants.
- `ladderTier`: He=1, Be=2, C=3, N=4, O=5, Ne=6, Mg=7, Si=8, S=9, Ar=10, Ca=11, Ti=12, Cr=13, Fe=14. Heavy ladder tier continues 15+.
- Meltdown at pressure ≥ the current cap. The cap starts at 100; modules can raise it.
- Each sector has a pressure floor: 0 in sector 1, 20 in sector 2, 40 in sector 3. Venting can never take pressure below the floor.

### Contracts and drafts

- One contract is active at a time. Each contract names a target element and a count of 1–3; boss contracts may require 2–3 and a modifier.
- Completing a contract opens a **draft of 3** and pauses the run. The player picks one:
  - 2 copies of an element card valid for the current sector.
  - A reactor module (run-scoped).
  - A patch (one-run rule change, e.g., "next vent is free").
- After the draft, the next contract begins. The board, hand, pressure, deck, and modules persist.
- **Sectors:** 1) H through Ne, boss Mg; 2) Si through Fe, boss Fe; 3) catalyst heavies, boss U.
- **Pool:** 30 contract templates, 10 per sector (two variants per slot). Bosses are fixed per sector.
- **No contract deadlines:** progress is the only clock. The pressure floor and vent card cost provide the tension.
- **Sector transition:** pressure drops to the next sector's floor, the player gets one free module draft, then sector 2 or 3 begins. At the start of sector 3, if the player does not own Catalyst, it is granted automatically; sector 3 can never be unwinnable for lack of it. The "early Catalyst" meta unlock only makes it available sooner.
- **Win:** completing the sector 3 boss ends the run in victory.
- **Loss:** pressure reaches the cap. The run ends; research is awarded based on contracts completed.

### Pressure and venting

- Pressure is the only fail meter. It never decays on its own.
- Venting is the only way down: 15 per vent, improved by modules, and cannot go below the sector floor (0/20/40).
- Venting costs a turn and one discarded card. The card is not lost, but the tempo and the card choice are real costs, and the floor prevents erasing all heat in later sectors.
- There is no turn limit. The contract ladder and the pressure floor are the pacing; the card cost keeps venting from being a free reset.
- Modules can raise the pressure cap, improve venting, reduce fusion pressure, or make the first fusion of a turn cheaper.

### Deck and card economy

- Cards are actions, tiles are board state. Placing a card sends it to the discard pile; fusing or delivering removes the tile, not the card.
- The starting deck is intentionally thin. Drafts add cards and modules; modules can add cards, improve draw, or change rules.
- Cards above the player's current sector can appear only as late-sector rewards.
- Heavier elements are forged, not drawn. Cards exist for H, He, C, N, O, Ne, Mg, Si, S, Ar, Ca, Ti, Cr, Fe; heavies are catalyst products.
- The deck can never starve: every placed card goes to discard, drafted bundles go to discard, and the discard reshuffles whenever a draw is required.
- Space is not the fail state. Scrap guarantees an empty cell on a future turn, and delivering frees tiles as it progresses the contract.

## 6. Content

### Elements and recipes (24)

Ladder (15): H, He, Be, C, N, O, Ne, Mg, Si, S, Ar, Ca, Ti, Cr, Fe.

Real-alpha recipes:

- H + H → He
- He + He → Be
- Be + He → C
- C + H → N (CNO cycle nod)
- N + H → O
- C + He → O (alternate path)
- O + He → Ne
- Ne + He → Mg
- Mg + He → Si
- Si + He → S
- S + He → Ar
- Ar + He → Ca
- Ca + He → Ti
- Ti + He → Cr
- Cr + He → Fe

Heavy ladder (9, catalyst-gated): Co, Ni, Cu, Zn, Ag, Au, Hg, Pb, U.

- Fe + He → Co (requires Catalyst module)
- Co + He → Ni
- Ni + He → Cu
- Cu + He → Zn
- Zn + He → Ag
- Ag + He → Au
- Au + He → Hg
- Hg + He → Pb
- Pb + He → U

The heavy chain is sci-fi nuclear capture, not literal physics; it exists to give the third sector a fresh climb.

### Contracts (30 templates)

Each template:

- sector (1–3)
- target element
- count (1–3)
- modifier (optional): "in one chain", "without venting this sector", "deliver 2 different elements", "after pressure ≥ 50"
- Modifiers are bonus objectives. The base delivery count always completes the contract; meeting the modifier adds research and improves the draft weighting. A modifier never makes a contract impossible.
- brief: one or two dry lines from the reactor AI

Rules:

- Targets must be forgeable by the end of that sector's ladder.
- Boss contracts are fixed: Mg, Fe, U, with counts and modifiers.
- No contract may require an element that the current draft pool cannot produce.
- Modifiers are additive pressure, not hidden rules; the brief states them plainly.

### Modules (24)

Categories and examples; exact numbers are tuning constants:

- **Cooling:** vent +5; pressure cap +10; fusion pressure −10%; first fusion each turn −2.
- **Hand/deck:** hand limit +1; draw +1 on vent; add 2 He cards; duplicate a card; discard 1 draw 2.
- **Reactor:** Catalyst (unlocks heavies); Neutron Flux (+1 heavy chain step); chain bonus reduction; extra delivery progress.
- **Contract:** reroll the active contract once; count −1 on one contract; reward an extra draft choice.
- **Safety:** one free meltdown save per run at 95+ pressure; pressure shield after sector transition.

### Meta-progression (12 unlocks)

- Currency: research, earned per contract completed and per sector boss; persisted.
- Unlocks widen pools, never raise stats:
  - 4 starting cards (C, O, Ne, Mg available in the starting draft pool).
  - 4 modules added to the draft pool (including an early Catalyst, better vent, hand +1, pressure cap +10).
  - 4 contract templates or draft options (reroll, extra choice, a heavy contract, a lower-count variant).
- No permanent pressure cap or damage boosts. A fresh save has the same power ceiling as a fully unlocked one.
- Unlocks are purchased from the Research Lab screen between runs.

### Tone

- All-ages clever sci-fi. The reactor AI, CORE, writes contract briefs and event lines with deadpan confidence.
- Meltdowns are loud and dramatic, never gory. Failure lines tease the player's reactor, not the player.
- Element names and symbols are real; the heavy chain is honestly labeled as speculative.

## 7. Screens and interaction

### Run screen (primary)

- **Top:** sector and contract progress (1/5), pressure ring with numeric value and cap, research earned this run.
- **Center:** 5×5 reactor grid, neon cells, element tiles with symbol and tier glow.
- **Hand:** horizontal scroll of element cards, tap to select, tap a cell to preview.
- **Preview:** dashed chain path, ghost result tiles, exact pressure delta, confirm/cancel buttons.
- **Contract panel:** target element, count, modifier, brief, deliverable tiles highlighted.
- **Actions:** Place (implicit on confirm), Vent (shows its pressure reduction and asks which card to discard), Deliver, Scrap. Deliver is free for any matching tile; Scrap is free once per turn.
- **Pressure gauge:** shows current pressure, cap, and the sector floor; previews warn when a chain would reach the cap.
- **Meltdown:** full-screen flash, run summary, research award, "New run".
- **Victory:** sector 3 boss completion, run stats, research, unlock progress, "New run".

### Draft screen

- Three cards: element bundle, module, patch. Each shows name, effect, rarity, and a one-line flavor.
- Pick one; the run resumes.
- Keyboard: 1/2/3 selects; Escape does nothing (a pick is mandatory).

### Sector transition

- Pressure released animation; free module draft; next sector brief from CORE.

### Research Lab (meta)

- Research balance; 12 unlock nodes in three tracks; locked/unlocked states; purchase with confirmation.
- Stats: runs, wins, best sector, fastest win, contracts completed.

### Settings and help

- Sound, reduced motion, install guidance, reset run, reset all progress (two-step), about.
- A "How to play" sheet covering the turn, fusion, pressure, contracts, and preview.

### First run

- A one-screen briefing from CORE: "You have hydrogen, a grid, and no supervision."
- Scripted first contract: deliver 1 Helium. The seeded center hydrogen plus a placed hydrogen teaches the chain immediately.

## 8. Visual system

- **Surface:** near-black blue `#070B14` with a subtle scanline and grid glow.
- **Neon:** cyan `#38E1FF` (safe), magenta `#FF4FD8` (pressure), amber `#FFB347` (contracts), lime `#B6FF5C` (heavies).
- **Grid:** 5×5 cells with inset glow, rounded corners, tier ring on tiles. Preview cells are dashed and semi-transparent.
- **Cards:** dark glass, neon border, element symbol, small number, tier color; selected state lifts and glows.
- **Pressure:** a circular gauge around the reactor core or a top bar; color shifts cyan → amber → magenta as it rises.
- **Typography:** self-hosted `Space Grotesk Variable` for UI and `JetBrains Mono Variable` for numbers/symbols (both OFL via Fontsource). No CDN.
- **Motion:** fusion pulses travel along the preview path; chain steps flash; meltdown shakes and floods magenta. Reduced motion removes shakes, travel, and flashes.
- **Audio:** procedural WebAudio only. Low reactor hum, fusion zap, vent whoosh, contract chime, meltdown alarm. No asset files, no music in v1. Sound on by default with a settings toggle.
- **Accessibility:** text contrast ≥ 4.5:1, 44 px targets, no color-only state, focus rings, live announcements for fusions, contract progress, and meltdown.

## 9. PWA, storage, offline

- Manifest: name, short name, neon theme, standalone, portrait, 192/512 icons, maskable icon.
- Service worker precaches shell, fonts, icons, and content; offline runs after first load.
- Update prompt rather than an automatic mid-run reload.
- Save key: `critical-mass:save:v1`.
- Save shape:
  - `meta`: research, unlocked node ids, aggregate stats.
  - `run`: nullable; seed, RNG state, grid, deck, hand, discard, pressure, pressure cap, sector floor, sector, contract index/template, delivered count, modules, patches, turn number, scrap-used-this-turn flag.
- Autosave after every action, draft, sector transition, and run end. Resume restores the exact run, including the RNG state.
- Corrupt save: discard the run, keep meta when it parses, and show a visible notice. Corrupt meta: fresh save with a notice.
- Reset current run and reset all progress are separate actions.

## 10. Architecture

- **Pure engine** in `src/lib/game/`, no framework:
  - `createRun(seed, meta)`, `previewPlacement(run, handIndex, cell, recipes)`, `placeCard(run, handIndex, cell, recipes)`, `vent(run, handIndex)`, `scrap(run, cell)`, `deliver(run, cell)`, `chooseDraft(run, meta, optionIndex)`, `nextSector(run)`, `researchFor(run)`, `isMeltdown(run)`.
  - Seeded PRNG (Mulberry32) with an explicit stored state for reproducible runs and tests.
  - Deterministic fusion resolver shared by preview and commit; the preview is the same function with a dry-run flag.
- **Data:** `src/lib/data/elements.ts`, `recipes.ts`, `contracts.ts`, `modules.ts`, `unlocks.ts`.
- **State:** Svelte writable stores in `src/lib/stores/` (`run.ts`, `meta.ts`, `save.ts`), pure actions, autosave through `storage.ts`.
- **UI:** `RunScreen.svelte`, `ReactorGrid.svelte`, `ElementCard.svelte`, `Hand.svelte`, `PressureGauge.svelte`, `ContractPanel.svelte`, `PreviewOverlay.svelte`, `DraftOverlay.svelte`, `MeltdownScreen.svelte`, `VictoryScreen.svelte`, `ResearchLab.svelte`, `Settings.svelte`, `HowToPlay.svelte`.
- **Routing:** one client-rendered SvelteKit route with `ssr = false`; no router beyond the screen union.
- **Rendering:** DOM for grid/cards/text; one canvas overlay for particles and chain travel. CSS custom properties for neon tokens.
- **No** state library, router, or physics engine.

## 11. Validation and testing

### Content validator

- 24 unique elements; every symbol/number/category valid.
- Every recipe references known elements and produces a heavier element.
- The ladder from H reaches Fe without catalyst; the catalyst module reaches U.
- Every contract target is reachable by the end of its sector; boss targets match sector ends.
- 30 contract templates, 5 per sector slot, 24 modules, 12 unlocks.

### Engine unit tests (Vitest)

- Seeded runs reproduce identical decks and contracts.
- Preview equals commit for chains, results, and pressure.
- Chain order is N→E→S→W; chains terminate; only the placed tile is active.
- Cards and tiles are separate: placing discards the card; fusing or delivering removes only the tile; the deck reshuffles instead of starving.
- Pressure math, cap changes, vent floor, and meltdown at ≥ the current cap.
- Venting discards exactly one chosen card and never drops below the sector floor.
- Scrap removes one tile, works once per turn, and prevents a full-board soft-lock.
- Catalyst is auto-granted at the start of sector 3 when missing; sector 3 contracts remain reachable.
- Deck reshuffle, hand cap, and player-chosen discard.
- Delivery consumes the matching tile and advances the contract.
- Contract completion opens exactly one draft; draft choice persists.
- Sector transition moves pressure to the next floor and grants the free draft.
- Win at the sector 3 boss; loss at meltdown; research awards match contracts completed.
- Corrupt save recovery.

### UI tests (Testing Library for Svelte)

- Tap card → tap cell → preview shows exact pressure delta → confirm matches.
- Cancel returns the card and leaves the board unchanged.
- Vent discards the chosen card, updates pressure, and stops at the sector floor.
- Deliver highlights and consumes matching tiles; scrap removes one tile per turn.
- A known pair shows the quiet result and adds no duplicate.
- Draft is mandatory and resumes the run.
- Meltdown and victory screens; new run resets the run but keeps meta.
- Research purchase persists.

### E2E (Playwright, 390×844)

- First fusion H + H → He in under 30 seconds from a cold start.
- Resume after reload restores the board, hand, pressure, and contract.
- Venting prevents an otherwise certain meltdown and respects the sector floor.
- A full board can always free a cell with scrap and continue; no soft-lock.
- Complete a scripted short run with a seeded save; victory and research persist.
- Offline reload works after first load.
- Axe: zero violations on run, draft, research, settings.

### Balance harness

- A headless simulator plays N seeded runs with a simple policy and reports win rate, average turns, and average peak pressure. Target win rate after unlocks: 30–50%; before unlocks: 10–20%. Tune constants, not rules.

## 12. Success criteria

- A new player fuses helium in under 30 seconds and understands the pressure trade-off by the first contract.
- Preview and resolution never disagree.
- A run is completable in 20–30 minutes and a meltdown is a clear, fair consequence.
- Venting is a real trade: it costs a card and a turn, and later sectors cannot be fully cooled.
- A full board is never a soft-lock; scrap always restores an empty cell.
- Reload restores the exact run, including the RNG state.
- The app installs, runs offline, and resumes.
- No hidden rules: every contract modifier is stated.
- The game reads as neon and synthetic, never as paper or notebook.

## 13. Left to the builder

- Exact pressure constants, module numbers, and contract modifiers; keep them in one tuning file.
- Final module list and unlock costs.
- Contract briefs and CORE's voice (all-ages clever).
- Particle overlay approach and performance budget.
- Balance-target tuning via the simulator.
- Whether the first campaign run is always the scripted tutorial contract.
- Deployment host (static files).

## 14. Risks

- **Balance:** pressure, chain tiers, and contract counts interact. Mitigation: pure deterministic engine, seeded simulator, one constants file.
- **Preview complexity:** chain preview can diverge from resolution. Mitigation: one resolver used by both paths, plus property-style tests comparing preview and commit.
- **Content volume:** 30 contracts and 24 modules is a lot of tuning. Mitigation: templates with shared modifiers, not unique code.
- **Mobile density:** grid, hand, pressure, and contract brief on 360 px. Mitigation: stacked layout with the contract brief collapsible.
- **RNG and save:** resume must not reroll. Mitigation: store the PRNG state in the save and test resume against a fresh run.
