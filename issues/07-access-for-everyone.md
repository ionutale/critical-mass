# 07 — Access for everyone

- **Type:** AFK
- **Labels:** `ready-for-agent`, `a11y`
- **User stories:** US8
- **Blocked by:** [Issue 06 — Installable and offline](06-offline-pwa.md)
- **Spec:** [Critical Mass design](../docs/superpowers/specs/2026-11-07-critical-mass-design.md)
- **Plan:** [Implementation plan](../docs/superpowers/plans/2026-11-07-critical-mass.md) — Task 15

## What to build

Make the reactor playable without a mouse or sight. Grid cells and cards are labeled buttons; arrow keys or tab move through the grid; Enter selects and confirms; Escape cancels a preview but never a mandatory draft. Focus is trapped in overlays and restored on close.

Live regions announce fusion results, pressure, contract progress, and meltdown once. Pressure is never color-only. Axe reports zero violations on Run, Draft, Research, Settings, and How-to.

## Acceptance criteria

- [ ] A keyboard-only player can place, preview, confirm, vent, deliver, and finish a draft.
- [ ] Focus is trapped in dialogs and restored to the invoking control.
- [ ] Live regions announce fusion, pressure, contract, and meltdown outcomes once.
- [ ] Axe reports zero violations on all five screens.
- [ ] No interaction is hover-only; 360 px targets are at least 44 px.
- [ ] Tests, svelte-check, and e2e pass.

## Blocked by

[Issue 06 — Installable and offline](06-offline-pwa.md)
