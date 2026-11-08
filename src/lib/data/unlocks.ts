import type { UnlockRecord } from '../types';

/**
 * Meta progression only widens the pool: cards, modules, and contract tools.
 * No node raises a permanent pressure cap, vent value, or starting stat.
 */
export const UNLOCKS: readonly UnlockRecord[] = [
	{
		id: 'card-carbon',
		name: 'Carbon Stocks',
		description: 'Add Carbon cards to the starting draft pool.',
		cost: 3,
		kind: 'card',
		ref: 'C'
	},
	{
		id: 'card-oxygen',
		name: 'Oxygen Stocks',
		description: 'Add Oxygen cards to the starting draft pool.',
		cost: 4,
		kind: 'card',
		ref: 'O'
	},
	{
		id: 'card-neon',
		name: 'Neon Stocks',
		description: 'Add Neon cards to the starting draft pool.',
		cost: 5,
		kind: 'card',
		ref: 'Ne'
	},
	{
		id: 'card-magnesium',
		name: 'Magnesium Stocks',
		description: 'Add Magnesium cards to the starting draft pool.',
		cost: 6,
		kind: 'card',
		ref: 'Mg'
	},
	{
		id: 'module-deep-coolant',
		name: 'Deep Coolant',
		description: 'Add Deep Coolant to the module draft pool.',
		cost: 5,
		kind: 'module',
		ref: 'deep-coolant'
	},
	{
		id: 'module-second-vessel',
		name: 'Second Vessel',
		description: 'Add Second Vessel to the module draft pool.',
		cost: 6,
		kind: 'module',
		ref: 'second-vessel'
	},
	{
		id: 'module-long-rack',
		name: 'Long Rack',
		description: 'Add Long Rack to the module draft pool.',
		cost: 7,
		kind: 'module',
		ref: 'long-rack'
	},
	{
		id: 'module-heavy-seed',
		name: 'Heavy Seed',
		description: 'Add Heavy Seed to the module draft pool.',
		cost: 8,
		kind: 'module',
		ref: 'heavy-seed'
	},
	{
		id: 'contract-reroll',
		name: 'Reroll Relay',
		description: 'Add Reroll Relay to the contract draft pool.',
		cost: 7,
		kind: 'contract',
		ref: 'reroll-relay'
	},
	{
		id: 'contract-rider',
		name: 'Contract Rider',
		description: 'Add Contract Rider to the contract draft pool.',
		cost: 8,
		kind: 'contract',
		ref: 'contract-rider'
	},
	{
		id: 'contract-assembly',
		name: 'Assembly Line',
		description: 'Add Assembly Line to the contract draft pool.',
		cost: 9,
		kind: 'contract',
		ref: 'assembly-line'
	},
	{
		id: 'contract-expander',
		name: 'Draft Expander',
		description: 'Add Draft Expander to the contract draft pool.',
		cost: 12,
		kind: 'contract',
		ref: 'draft-expander'
	}
];

export const UNLOCK_BY_ID = new Map(UNLOCKS.map((unlock) => [unlock.id, unlock]));

/** Module ids that only enter the draft pool after their research node is owned. */
export const LOCKED_MODULE_IDS = new Set(
	UNLOCKS.filter((unlock) => unlock.kind !== 'card').map((unlock) => unlock.ref)
);

/** Card symbols that only enter the sector-1 draft pool after their node is owned. */
export const LOCKED_CARD_SYMBOLS = new Set(
	UNLOCKS.filter((unlock) => unlock.kind === 'card').map((unlock) => unlock.ref)
);
