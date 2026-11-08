# 08 — Ship hardening

- **Type:** AFK
- **Labels:** `ready-for-agent`, `qa`
- **User stories:** US1–US10
- **Blocked by:** [Issue 07 — Access for everyone](07-access-for-everyone.md)
- **Spec:** [Critical Mass design](../docs/superpowers/specs/2026-11-07-critical-mass-design.md)
- **Plan:** [Implementation plan](../docs/superpowers/plans/2026-11-07-critical-mass.md) — Task 16

## What to build

Close the loop. Add the balance simulator: seeded runs with a simple policy, reporting win rate, turns, peak pressure, and contract completion. Tune constants only, targeting 10–20% wins before unlocks and 30–50% after.

Add the regression e2e suite: first fusion, mid-run resume, vent preventing a meltdown, full-board scrap, victory, offline reload, and a keyboard-only run. Enforce the 250 KB gzip budget and write the README.

## Acceptance criteria

- [ ] The balance simulator runs and reports the four metrics; targets are documented.
- [ ] The full e2e suite passes, including resume, scrap, victory, offline, and keyboard.
- [ ] The bundle budget passes at or below 250 KB gzip.
- [ ] The README covers run, test, validate, balance, build, deploy, and content authoring.
- [ ] `pnpm validate && pnpm check && pnpm test && pnpm build && pnpm check:bundle && pnpm e2e` all pass.

## Blocked by

[Issue 07 — Access for everyone](07-access-for-everyone.md)
