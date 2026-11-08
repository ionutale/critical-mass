# 04 — The research lab

- **Type:** AFK
- **Labels:** `ready-for-agent`, `meta`
- **User stories:** US5, US7
- **Blocked by:** [Issue 03 — The contract ladder](03-contract-ladder.md)
- **Spec:** [Critical Mass design](../docs/superpowers/specs/2026-11-07-critical-mass-design.md)
- **Plan:** [Implementation plan](../docs/superpowers/plans/2026-11-07-critical-mass.md) — Tasks 4, 12

## What to build

Make the runs add up. Add 24 modules and 12 research unlocks that widen options without permanent stat boosts. The Research Lab purchases nodes, shows owned and locked states, and persists across runs.

Add the title/continue screen, settings for sound and reduced motion, install guidance, reset run, reset all progress, and a how-to sheet covering turns, fusion, pressure, contracts, and preview.

## Acceptance criteria

- [ ] 24 modules and 12 unlocks validate; no unlock grants a permanent stat boost.
- [ ] Research purchases spend the currency, mark ownership, and persist.
- [ ] The title offers Continue when a run exists and New run otherwise.
- [ ] Settings toggles persist; reset run and reset all are separate and two-step.
- [ ] The how-to sheet covers the full loop without a tutorial carousel.
- [ ] Tests and svelte-check pass; the work is committed.

## Blocked by

[Issue 03 — The contract ladder](03-contract-ladder.md)
