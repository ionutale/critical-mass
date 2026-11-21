/**
 * Passive Heat added at the end of every turn. It also sets the per-turn Heat
 * floor. Preview and turn resolution share this single value so a placement's
 * previewed post-turn Heat always equals the committed Heat.
 *
 * At 4 the rising floor reaches the 100 cap on turn 25 (`4 × 25 = 100`), which
 * is the balance harness's natural 20–30 turn band. At 3 even a perfect
 * survivor rode the floor to turn 34, so the target needed a harness-only
 * late-game sprint to hold. This is the clock, not a policy rule.
 */
export const PASSIVE_HEAT = 4;
