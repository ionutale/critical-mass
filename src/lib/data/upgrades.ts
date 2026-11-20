import type { ElementSymbol } from '../types';

/**
 * Every concrete Upgrade the first-pass arcade pool can offer.
 * Cards widen the deck; modifiers change the run's rules for the rest of the run.
 */
export type UpgradeId =
	| 'add-h-2'
	| 'add-he-2'
	| 'add-li'
	| 'add-c'
	| 'add-be'
	| 'add-na'
	| 'add-o'
	| 'coolant'
	| 'efficient'
	| 'chain-reaction'
	| 'salvage'
	| 'deep-hand'
	| 'heat-sink'
	| 'rarity-bonus'
	| 'echo';

export interface UpgradeRecord {
	id: UpgradeId;
	name: string;
	description: string;
	kind: 'card' | 'modifier';
}

/**
 * Draft-pool order. Card upgrades first so their pool position never depends on
 * which modifiers a run already owns; modifiers that are owned are filtered out
 * by the draft roll.
 */
export const UPGRADES: readonly UpgradeRecord[] = [
	{
		id: 'add-h-2',
		name: 'Hydrogen Stock',
		description: 'Add 2 Hydrogen cards to the discard pile.',
		kind: 'card'
	},
	{
		id: 'add-he-2',
		name: 'Helium Stock',
		description: 'Add 2 Helium cards to the discard pile.',
		kind: 'card'
	},
	{
		id: 'add-li',
		name: 'Lithium Stock',
		description: 'Add 1 Lithium card to the discard pile.',
		kind: 'card'
	},
	{
		id: 'add-c',
		name: 'Carbon Stock',
		description: 'Add 1 Carbon card to the discard pile.',
		kind: 'card'
	},
	{
		id: 'add-be',
		name: 'Beryllium Stock',
		description: 'Add 1 Beryllium card to the discard pile.',
		kind: 'card'
	},
	{
		id: 'add-na',
		name: 'Sodium Stock',
		description: 'Add 1 Sodium card to the discard pile.',
		kind: 'card'
	},
	{
		id: 'add-o',
		name: 'Oxygen Stock',
		description: 'Add 1 Oxygen card to the discard pile.',
		kind: 'card'
	},
	{
		id: 'coolant',
		name: 'Coolant',
		description: 'Stabilize removes 15 more Heat.',
		kind: 'modifier'
	},
	{
		id: 'efficient',
		name: 'Efficient Fusion',
		description: 'Each Fusion adds 1 less Heat.',
		kind: 'modifier'
	},
	{
		id: 'chain-reaction',
		name: 'Chain Reaction',
		description: 'Fusions at Chain step 3 or later score 50% more.',
		kind: 'modifier'
	},
	{
		id: 'salvage',
		name: 'Salvage',
		description: 'Scrap twice per turn instead of once.',
		kind: 'modifier'
	},
	{
		id: 'deep-hand',
		name: 'Deep Hand',
		description: 'Hand size +1.',
		kind: 'modifier'
	},
	{
		id: 'heat-sink',
		name: 'Heat Sink',
		description: 'Once per turn, the first Fusion adds no Heat.',
		kind: 'modifier'
	},
	{
		id: 'rarity-bonus',
		name: 'Rarity Bonus',
		description: 'Valence-4 results score 25% more.',
		kind: 'modifier'
	},
	{
		id: 'echo',
		name: 'Echo',
		description: 'The first Stabilize each run draws as normal.',
		kind: 'modifier'
	}
];

export const UPGRADE_BY_ID: ReadonlyMap<UpgradeId, UpgradeRecord> = new Map(
	UPGRADES.map((upgrade) => [upgrade.id, upgrade])
);

/**
 * Card payloads. A drafted card upgrade appends these symbols to the run's
 * discard pile; modifier ids are absent.
 */
export const UPGRADE_CARDS: ReadonlyMap<UpgradeId, readonly ElementSymbol[]> = new Map<
	UpgradeId,
	readonly ElementSymbol[]
>([
	['add-h-2', ['H', 'H']],
	['add-he-2', ['He', 'He']],
	['add-li', ['Li']],
	['add-c', ['C']],
	['add-be', ['Be']],
	['add-na', ['Na']],
	['add-o', ['O']]
]);

/**
 * Tuning for every modifier, kept together so the engine hooks stay data-driven.
 * Magnitudes are the builder's tuning call per the design spec.
 */
export const UPGRADE_EFFECTS = {
	coolant: { coolingBonus: 15 },
	efficient: { heatReduction: 1 },
	'chain-reaction': { minStep: 3, scoreMultiplier: 1.5 },
	salvage: { scrapsPerTurn: 2 },
	'deep-hand': { handSizeBonus: 1 },
	'heat-sink': { freeFirstFusion: true },
	'rarity-bonus': { valence: 4, scoreMultiplier: 1.25 },
	echo: { firstStabilizeDraws: true }
} as const;

/** Whether the run owns an Upgrade. Card upgrades may be owned more than once. */
export function hasUpgrade(run: { upgrades: readonly string[] }, id: UpgradeId): boolean {
	return run.upgrades.includes(id);
}
