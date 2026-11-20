import { UNLOCK_UPGRADE_CARDS, unlockedUpgradeIds } from '../../data/arcade/unlocks';
import { UPGRADE_CARDS, UPGRADES } from '../../data/upgrades';
import type { UpgradeId } from '../../data/upgrades';
import { pickIndex } from '../rng';
import type { RunState } from './turn';

export { hasUpgrade } from '../../data/upgrades';

/** Every draft offers 1 of 3. */
const DRAFT_SIZE = 3;

/**
 * The valid pool for this run: all card upgrades (they may be drafted again)
 * plus every modifier the run does not already own, then any card upgrades
 * unlocked by the meta save.
 */
function draftPool(upgrades: readonly string[], unlocked: readonly string[]): UpgradeId[] {
	const pool = UPGRADES.filter(
		(upgrade) => upgrade.kind === 'card' || !upgrades.includes(upgrade.id)
	).map((upgrade) => upgrade.id);

	for (const id of unlockedUpgradeIds(unlocked)) {
		if (!pool.includes(id)) pool.push(id);
	}

	return pool;
}

/**
 * Roll `DRAFT_SIZE` distinct options by drawing without replacement from the
 * valid pool. The RNG stream advances by one step per option; the resulting
 * state is what `chooseUpgrade` commits, so generating options is pure while
 * choosing is the state transition.
 */
function rollDraft(
	state: number,
	upgrades: readonly string[],
	unlocked: readonly string[]
): { ids: UpgradeId[]; state: number } {
	const remaining = draftPool(upgrades, unlocked);
	const ids: UpgradeId[] = [];
	let current = state;

	const count = Math.min(DRAFT_SIZE, remaining.length);
	for (let pick = 0; pick < count; pick++) {
		const step = pickIndex(current, remaining.length);
		current = step.state;

		const [id] = remaining.splice(step.index, 1);
		if (!id) break;
		ids.push(id);
	}

	return { ids, state: current };
}

/**
 * The three options for the draft this run is facing, derived deterministically
 * from `run.rngState`. Pure: calling it repeatedly shows the same cards, and
 * `chooseUpgrade` is what advances the run's RNG stream.
 */
export function generateDraft(run: RunState): UpgradeId[] {
	return rollDraft(run.rngState, run.upgrades, run.unlocked).ids;
}

/**
 * Apply option `index` of the current draft: record the Upgrade, append any
 * cards to the discard pile, advance `rngState`, and consume exactly one
 * pending draft. Invalid indices and runs with nothing pending are no-ops.
 */
export function chooseUpgrade(run: RunState, index: number): RunState {
	if (run.status !== 'active' || run.pendingDrafts <= 0) return run;
	if (!Number.isInteger(index)) return run;

	const { ids, state } = rollDraft(run.rngState, run.upgrades, run.unlocked);
	const chosen = ids[index];
	if (!chosen) return run;

	const cards = UPGRADE_CARDS.get(chosen) ?? UNLOCK_UPGRADE_CARDS.get(chosen) ?? [];

	return {
		...run,
		rngState: state,
		upgrades: [...run.upgrades, chosen],
		discard: [...run.discard, ...cards],
		pendingDrafts: run.pendingDrafts - 1
	};
}
