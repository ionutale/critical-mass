# 03 — The contract ladder

- **Type:** AFK
- **Labels:** `ready-for-agent`, `contracts`
- **User stories:** US3, US4
- **Blocked by:** [Issue 02 — The full reactor](02-full-reactor.md)
- **Spec:** [Critical Mass design](../docs/superpowers/specs/2026-11-07-critical-mass-design.md)
- **Plan:** [Implementation plan](../docs/superpowers/plans/2026-11-07-critical-mass.md) — Tasks 4, 7, 11

## What to build

Give the run a shape. Add 30 contract templates across three sectors, delivery by consuming matching tiles, three-option drafts after every contract, and sector transitions.

Sector 3 auto-grants Catalyst if missing, so the final sector is never unwinnable. Complete the third boss to win; reach the pressure cap to melt down. Both paths award research based on contracts completed. Modifiers are bonus objectives, never gates.

## Acceptance criteria

- [ ] 30 contracts validate; each sector has five slots with two variants.
- [ ] Delivery consumes only matching tiles and opens exactly one draft at the required count.
- [ ] Drafts are mandatory, three unique options, and resume the run on pick.
- [ ] Sector transitions vent to the next floor, grant Catalyst at sector 3, and open the free module draft.
- [ ] Victory fires after the sector 3 boss; meltdown fires at the cap.
- [ ] Research is awarded once per contract and boss, including after a meltdown.
- [ ] Tests and svelte-check pass; the work is committed.

## Blocked by

[Issue 02 — The full reactor](02-full-reactor.md)
