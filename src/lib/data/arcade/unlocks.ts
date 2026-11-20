import { ELEMENT_BY_SYMBOL } from '../elements';
import { UPGRADE_BY_ID } from '../upgrades';
import type { UpgradeId, UpgradeRecord } from '../upgrades';
import type { ElementSymbol } from '../../types';

/**
 * One meta-progression node, unlocked automatically the first time a lifetime
 * metric reaches its threshold. There is no currency and no shop.
 *
 * `ref` is interpreted by `kind`:
 * - `starter`: an ElementSymbol that replaces one Hydrogen in the starter deck.
 * - `pool`: an id from `UNLOCK_UPGRADES` added to the draft pool.
 * - `challenge`: an optional run modifier id, never applied automatically.
 *
 * Unlocks only add options. They never gate an Element or a Rarity, and no
 * record raises a base stat (hand size, Heat cap, score, or Heat).
 */
export interface UnlockRecord {
	id: string;
	name: string;
	description: string;
	threshold: number;
	metric: 'totalScore' | 'bestChain' | 'runs';
	kind: 'starter' | 'pool' | 'challenge';
	ref: string;
}

/**
 * The eight-node unlock tree, in evaluation and starter-replacement order.
 *
 * Starters replace Hydrogens one for one, so the deck stays 10 cards. Pool
 * nodes append card upgrades that are absent from the base pool.
 */
export const UNLOCKS: readonly UnlockRecord[] = [
	{
		id: 'starter-carbon',
		name: 'Carbon Seed',
		description: 'Replace one Hydrogen in the starter deck with Carbon.',
		threshold: 100,
		metric: 'totalScore',
		kind: 'starter',
		ref: 'C'
	},
	{
		id: 'starter-sodium',
		name: 'Sodium Seed',
		description: 'Replace one Hydrogen in the starter deck with Sodium.',
		threshold: 3,
		metric: 'bestChain',
		kind: 'starter',
		ref: 'Na'
	},
	{
		id: 'pool-nitrogen',
		name: 'Nitrogen Stock',
		description: 'Add a Nitrogen Stock card upgrade to the draft pool.',
		threshold: 3,
		metric: 'runs',
		kind: 'pool',
		ref: 'add-n'
	},
	{
		id: 'starter-oxygen',
		name: 'Oxygen Seed',
		description: 'Replace one Hydrogen in the starter deck with Oxygen.',
		threshold: 750,
		metric: 'totalScore',
		kind: 'starter',
		ref: 'O'
	},
	{
		id: 'pool-silicon',
		name: 'Silicon Stock',
		description: 'Add a Silicon Stock card upgrade to the draft pool.',
		threshold: 4,
		metric: 'bestChain',
		kind: 'pool',
		ref: 'add-si'
	},
	{
		id: 'starter-nitrogen',
		name: 'Nitrogen Seed',
		description: 'Replace one Hydrogen in the starter deck with Nitrogen.',
		threshold: 8,
		metric: 'runs',
		kind: 'starter',
		ref: 'N'
	},
	{
		id: 'pool-magnesium',
		name: 'Magnesium Stock',
		description: 'Add a Magnesium Stock card upgrade to the draft pool.',
		threshold: 2500,
		metric: 'totalScore',
		kind: 'pool',
		ref: 'add-mg'
	},
	{
		id: 'starter-magnesium',
		name: 'Magnesium Seed',
		description: 'Replace one Hydrogen in the starter deck with Magnesium.',
		threshold: 5000,
		metric: 'totalScore',
		kind: 'starter',
		ref: 'Mg'
	}
];

export const UNLOCK_BY_ID: ReadonlyMap<string, UnlockRecord> = new Map(
	UNLOCKS.map((unlock) => [unlock.id, unlock])
);

/**
 * Card upgrades that only enter the draft pool through a `pool` unlock. They
 * are deliberately absent from `UPGRADES`, so the base pool and its seeded
 * drafts are unchanged for a fresh save.
 */
export interface UnlockUpgradeRecord {
	id: UpgradeId;
	name: string;
	description: string;
	kind: 'card';
	cards: readonly ElementSymbol[];
}

export const UNLOCK_UPGRADES: readonly UnlockUpgradeRecord[] = [
	{
		id: 'add-n',
		name: 'Nitrogen Stock',
		description: 'Add 1 Nitrogen card to the discard pile.',
		kind: 'card',
		cards: ['N']
	},
	{
		id: 'add-si',
		name: 'Silicon Stock',
		description: 'Add 1 Silicon card to the discard pile.',
		kind: 'card',
		cards: ['Si']
	},
	{
		id: 'add-mg',
		name: 'Magnesium Stock',
		description: 'Add 1 Magnesium card to the discard pile.',
		kind: 'card',
		cards: ['Mg']
	}
];

export const UNLOCK_UPGRADE_BY_ID: ReadonlyMap<string, UnlockUpgradeRecord> = new Map(
	UNLOCK_UPGRADES.map((upgrade) => [upgrade.id, upgrade])
);

/** Card payloads for unlock-only upgrades; the draft falls back to this map. */
export const UNLOCK_UPGRADE_CARDS: ReadonlyMap<UpgradeId, readonly ElementSymbol[]> = new Map(
	UNLOCK_UPGRADES.map((upgrade) => [upgrade.id, upgrade.cards])
);

/**
 * Every upgrade the draft can offer, base and unlock-only. Draft UIs should
 * resolve option ids through this map; `UPGRADE_BY_ID` alone lacks the bonus
 * cards.
 */
export const DRAFT_UPGRADE_BY_ID: ReadonlyMap<UpgradeId, UpgradeRecord> = new Map<
	UpgradeId,
	UpgradeRecord
>([
	...UPGRADE_BY_ID,
	...UNLOCK_UPGRADES.map((upgrade): [UpgradeId, UpgradeRecord] => [upgrade.id, upgrade])
]);

/** Bonus upgrade ids granted by the given unlock ids, in table order. */
export function unlockedUpgradeIds(unlocked: readonly string[]): UpgradeId[] {
	const owned = new Set(unlocked);
	const ids: UpgradeId[] = [];

	for (const unlock of UNLOCKS) {
		if (unlock.kind !== 'pool' || !owned.has(unlock.id)) continue;

		const upgrade = UNLOCK_UPGRADE_BY_ID.get(unlock.ref);
		if (upgrade) ids.push(upgrade.id);
	}

	return ids;
}

function isElementSymbol(value: string): value is ElementSymbol {
	return ELEMENT_BY_SYMBOL.has(value as ElementSymbol);
}

/**
 * Apply unlocked starter nodes to a base deck. Each node replaces one Hydrogen
 * slot, in UNLOCKS order, so the deck keeps its size and determinism. Unknown
 * or duplicate unlock ids are ignored.
 */
export function applyStarterUnlocks(
	base: readonly ElementSymbol[],
	unlocked: readonly string[]
): ElementSymbol[] {
	const owned = new Set(unlocked);
	const deck = [...base];
	let hydrogen = deck.indexOf('H');

	for (const unlock of UNLOCKS) {
		if (unlock.kind !== 'starter' || !owned.has(unlock.id)) continue;
		if (hydrogen === -1) break;
		if (!isElementSymbol(unlock.ref)) continue;

		deck[hydrogen] = unlock.ref;
		hydrogen = deck.indexOf('H', hydrogen + 1);
	}

	return deck;
}
