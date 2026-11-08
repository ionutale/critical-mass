# Critical Mass — Issue Queue

Eight vertical-slice issues, published locally in dependency order. Each is a tracer bullet that cuts through data, logic, UI, persistence, and tests, and is demoable on its own.

- **Spec:** [Design doc](../docs/superpowers/specs/2026-11-07-critical-mass-design.md)
- **Plan:** [Implementation plan](../docs/superpowers/plans/2026-11-07-critical-mass.md)
- **Tracker:** local markdown (no tracker configured).

| #   | Issue                                            | Type | Blocked by                      | Stories        |
| --- | ------------------------------------------------ | ---- | ------------------------------- | -------------- |
| 01  | [First fusion](01-first-fusion.md)               | AFK  | —                               | US1, US9, US10 |
| 02  | [The full reactor](02-full-reactor.md)           | AFK  | [01](01-first-fusion.md)        | US1, US2, US9  |
| 03  | [The contract ladder](03-contract-ladder.md)     | AFK  | [02](02-full-reactor.md)        | US3, US4       |
| 04  | [The research lab](04-research-lab.md)           | AFK  | [03](03-contract-ladder.md)     | US5, US7       |
| 05  | [Neon](05-neon.md)                               | AFK  | [04](04-research-lab.md)        | US7            |
| 06  | [Installable and offline](06-offline-pwa.md)     | AFK  | [05](05-neon.md)                | US6            |
| 07  | [Access for everyone](07-access-for-everyone.md) | AFK  | [06](06-offline-pwa.md)         | US8            |
| 08  | [Ship hardening](08-ship-hardening.md)           | AFK  | [07](07-access-for-everyone.md) | US1–US10       |

## User stories

- **US1** — Combine two tiles to fuse a heavier element.
- **US2** — Manage pressure: place or vent, and avoid a meltdown.
- **US3** — Complete contracts and draft upgrades.
- **US4** — Climb three sectors and win.
- **US5** — Unlock research between runs.
- **US6** — Install the reactor and play offline.
- **US7** — Control sound and motion, and resume a run.
- **US8** — Play with a keyboard or screen reader.
- **US9** — Return to a run exactly as it was.
- **US10** — See and understand the fusion chain before committing.

## Working notes

- Publish order is dependency order: 01 → 02 → 03 → 04 → 05 → 06 → 07 → 08.
- All eight are AFK: the rules, constants ownership, and tone are settled.
- The issue body is behavioral. The plan task linked in each header carries exact files, interfaces, tests, and commands.
- Binding rules: preview equals commit, 5×5 grid, N→E→S→W, 24 elements, 30 contracts, pressure cap/floors, scrap once per turn, Catalyst auto-grant.
- Do not implement ahead of a failing test in the linked plan task.
