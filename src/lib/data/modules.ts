import type { ModuleRecord } from '../types';

export const MODULES: readonly ModuleRecord[] = [
	{
		id: 'coolant-loop',
		name: 'Coolant Loop',
		description: 'Venting sheds 20 pressure instead of 15.',
		effect: 'vent+5'
	},
	{
		id: 'reinforced-vessel',
		name: 'Reinforced Vessel',
		description: 'Pressure cap +10.',
		effect: 'cap+10'
	},
	{
		id: 'damping-field',
		name: 'Damping Field',
		description: 'Fusion pressure −10%.',
		effect: 'fusion-10'
	},
	{
		id: 'cargo-rack',
		name: 'Cargo Rack',
		description: 'Hand limit +1.',
		effect: 'hand+1'
	},
	{
		id: 'auxiliary-feed',
		name: 'Auxiliary Feed',
		description: 'Draw +1 card each turn.',
		effect: 'draw+1'
	},
	{
		id: 'helium-reserve',
		name: 'Helium Reserve',
		description: 'Add two He cards to the discard pile.',
		effect: 'add-he-2'
	},
	{
		id: 'echo-buffer',
		name: 'Echo Buffer',
		description: 'Duplicate a card into the discard pile.',
		effect: 'duplicate-card'
	},
	{
		id: 'catalyst-injector',
		name: 'Catalyst Injector',
		description: 'Unlock the catalyst-gated heavy chain.',
		effect: 'catalyst'
	},
	{
		id: 'neutron-flux',
		name: 'Neutron Flux',
		description: 'Heavy fusions cost 4 less pressure.',
		effect: 'neutron'
	},
	{
		id: 'thermal-buffer',
		name: 'Thermal Buffer',
		description: 'Chain steps after the first cost 2 less pressure.',
		effect: 'chain-bonus-2'
	},
	{
		id: 'assembly-line',
		name: 'Assembly Line',
		description: 'Each delivery counts as 2 progress.',
		effect: 'delivery+1'
	},
	{
		id: 'contract-rider',
		name: 'Contract Rider',
		description: 'The next contract needs one fewer delivery.',
		effect: 'count-1'
	},
	{
		id: 'draft-expander',
		name: 'Draft Expander',
		description: 'Future drafts offer four options.',
		effect: 'draft+1'
	},
	{
		id: 'emergency-vent',
		name: 'Emergency Vent',
		description: 'Survive one meltdown at 1 pressure below the cap.',
		effect: 'meltdown-save'
	},
	{
		id: 'blast-shield',
		name: 'Blast Shield',
		description: 'Pressure starts 10 below the floor after a sector transition.',
		effect: 'sector-shield'
	},
	{
		id: 'reroll-relay',
		name: 'Reroll Relay',
		description: 'Swap the active contract for its other variant.',
		effect: 'reroll'
	},
	{
		id: 'deep-coolant',
		name: 'Deep Coolant',
		description: 'Venting sheds another 5 pressure.',
		effect: 'vent+5'
	},
	{
		id: 'second-vessel',
		name: 'Second Vessel',
		description: 'Pressure cap +10.',
		effect: 'cap+10'
	},
	{
		id: 'phase-damper',
		name: 'Phase Damper',
		description: 'Fusion pressure −10%.',
		effect: 'fusion-10'
	},
	{
		id: 'long-rack',
		name: 'Long Rack',
		description: 'Hand limit +1.',
		effect: 'hand+1'
	},
	{
		id: 'twin-feed',
		name: 'Twin Feed',
		description: 'Draw +1 card each turn.',
		effect: 'draw+1'
	},
	{
		id: 'helium-cache',
		name: 'Helium Cache',
		description: 'Add two He cards to the discard pile.',
		effect: 'add-he-2'
	},
	{
		id: 'copy-buffer',
		name: 'Copy Buffer',
		description: 'Duplicate a card into the discard pile.',
		effect: 'duplicate-card'
	},
	{
		id: 'heavy-seed',
		name: 'Heavy Seed',
		description: 'Unlock the catalyst-gated heavy chain.',
		effect: 'catalyst'
	}
];

export const MODULE_BY_ID = new Map(MODULES.map((module) => [module.id, module]));
