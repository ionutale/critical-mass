# 02 — The full reactor

- **Type:** AFK
- **Labels:** `ready-for-agent`, `reactor`
- **User stories:** US1, US2, US9
- **Blocked by:** [Issue 01 — First fusion](01-first-fusion.md)
- **Spec:** [Critical Mass design](../docs/superpowers/specs/2026-11-07-critical-mass-design.md)
- **Plan:** [Implementation plan](../docs/superpowers/plans/2026-11-07-critical-mass.md) — Tasks 3, 5–6, 8, 10

## What to build

Make the reactor complete. Add all 24 elements and the real alpha ladder to iron, plus the catalyst-gated heavies. Implement the full deck: draw, hand cap, pending discards, place-or-vent, one scrap per turn, card-to-discard lifecycle, and deck reshuffle.

Pressure becomes the central system: the cap starts at 100, vents cost one discarded card, sector floors prevent full cooling, and a chain that reaches the cap melts down. The grid can always be freed with scrap.

## Acceptance criteria

- [ ] 24 elements and every recipe validate; the ladder reaches iron without Catalyst and uranium with it.
- [ ] Cards go to discard when placed; tiles are separate and never return cards.
- [ ] The deck never starves; discard reshuffles when a draw is required.
- [ ] Venting discards exactly one chosen card, respects the floor, and never goes below it.
- [ ] Scrap works once per turn and prevents a full-board soft-lock.
- [ ] Meltdown triggers at the current cap, not a fixed 100.
- [ ] Tests and svelte-check pass; the work is committed.

## Blocked by

[Issue 01 — First fusion](01-first-fusion.md)
