# 05 — Neon

- **Type:** AFK
- **Labels:** `ready-for-agent`, `art`
- **User stories:** US7
- **Blocked by:** [Issue 04 — The research lab](04-research-lab.md)
- **Spec:** [Critical Mass design](../docs/superpowers/specs/2026-11-07-critical-mass-design.md)
- **Plan:** [Implementation plan](../docs/superpowers/plans/2026-11-07-critical-mass.md) — Task 14

## What to build

Make it feel like a reactor. Add the near-black surface, cyan/magenta/amber/lime tokens, glass cards, tier rings, a pulsing pressure gauge, and a chain path that lights up before commit.

A canvas particle overlay adds fusion sparks and meltdown debris. Audio is procedural WebAudio only: pick, fusion, vent, contract, meltdown, and victory stings. Reduced motion removes travel, shake, and particles and honors both the setting and the OS.

## Acceptance criteria

- [ ] The grid, cards, and pressure read clearly at 360 px.
- [ ] The chain preview path pulses in N→E→S→W order and matches the engine steps.
- [ ] Particles are deterministic for a seed and absent under reduced motion.
- [ ] Sound is procedural, mutable, and never throws when disabled.
- [ ] Reduced motion removes shake, travel, and flashes.
- [ ] Tests and svelte-check pass; the work is committed.

## Blocked by

[Issue 04 — The research lab](04-research-lab.md)
