# 01 — First fusion

- **Type:** AFK
- **Labels:** `ready-for-agent`, `skeleton`
- **User stories:** US1, US9, US10
- **Blocked by:** None — can start immediately
- **Spec:** [Critical Mass design](../docs/superpowers/specs/2026-11-07-critical-mass-design.md)
- **Plan:** [Implementation plan](../docs/superpowers/plans/2026-11-07-critical-mass.md) — Tasks 1–3 (subsets), 5, 6 (subset), 8, 9, 10 (subset)

## What to build

Ship a walking skeleton through every layer. A phone-sized SvelteKit PWA opens on a 5×5 reactor with one Hydrogen tile at the center, a five-card hand, a pressure gauge, and a scripted "Deliver 1 Helium" contract. Place Hydrogen next to the center, preview the exact chain and pressure gain, confirm, and watch the tile become Helium. Deliver it to finish the contract. Reload and the reactor is exactly where it was.

The content set is deliberately small: a handful of elements and recipes. The next slice replaces it with the full ladder.

The rules are real from this slice: only the placed tile fuses, neighbors resolve N→E→S→W, pressure rises, and preview must equal commit.

## Acceptance criteria

- [ ] A cold start fuses helium by tap alone in under 30 seconds.
- [ ] The preview shows the exact chain, result, and pressure delta; cancel changes nothing.
- [ ] Confirming places the tile, consumes the card, and raises pressure exactly as previewed.
- [ ] Delivering the Helium tile completes the scripted contract.
- [ ] Reload restores the grid, hand, pressure, contract, and RNG state.
- [ ] Tests, svelte-check, and the build pass; the work is committed.

## Blocked by

None — can start immediately
