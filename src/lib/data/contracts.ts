import type { ContractTemplate } from '../types';

export const CONTRACTS: readonly ContractTemplate[] = [
	{
		id: 's1-1a',
		sector: 1,
		slot: 1,
		target: 'He',
		count: 1,
		modifier: null,
		brief: 'One helium, please. The carpet is not rated for fusion.'
	},
	{
		id: 's1-1b',
		sector: 1,
		slot: 1,
		target: 'He',
		count: 2,
		modifier: null,
		brief: 'Two helium. The reactor wants balloons.'
	},
	{
		id: 's1-2a',
		sector: 1,
		slot: 2,
		target: 'Be',
		count: 1,
		modifier: null,
		brief: 'Beryllium for the window frames.'
	},
	{
		id: 's1-2b',
		sector: 1,
		slot: 2,
		target: 'C',
		count: 1,
		modifier: null,
		brief: 'Carbon. All the good stuff is carbon.'
	},
	{
		id: 's1-3a',
		sector: 1,
		slot: 3,
		target: 'N',
		count: 2,
		modifier: 'no-vent',
		brief: 'Two nitrogen, and keep the vents shut.'
	},
	{
		id: 's1-3b',
		sector: 1,
		slot: 3,
		target: 'O',
		count: 1,
		modifier: null,
		brief: 'Oxygen. Try not to make it exciting.'
	},
	{
		id: 's1-4a',
		sector: 1,
		slot: 4,
		target: 'Ne',
		count: 2,
		modifier: 'one-chain',
		brief: 'Two neon in one chain. The sign is watching.'
	},
	{
		id: 's1-4b',
		sector: 1,
		slot: 4,
		target: 'O',
		count: 2,
		modifier: 'pressure-50',
		brief: 'Two oxygen above fifty pressure. The gauge likes company.'
	},
	{
		id: 's1-5a',
		sector: 1,
		slot: 5,
		target: 'Mg',
		count: 1,
		modifier: null,
		brief: 'Boss order: one magnesium. Do not scratch it.'
	},
	{
		id: 's1-5b',
		sector: 1,
		slot: 5,
		target: 'Mg',
		count: 2,
		modifier: 'pressure-50',
		brief: 'Boss order: two magnesium, and make it hot.'
	},

	{
		id: 's2-1a',
		sector: 2,
		slot: 1,
		target: 'Si',
		count: 1,
		modifier: null,
		brief: 'Silicon for the new control chips.'
	},
	{
		id: 's2-1b',
		sector: 2,
		slot: 1,
		target: 'S',
		count: 1,
		modifier: null,
		brief: 'Sulfur. The lab smells like ambition.'
	},
	{
		id: 's2-2a',
		sector: 2,
		slot: 2,
		target: 'Ar',
		count: 1,
		modifier: null,
		brief: 'Argon for the welding bay.'
	},
	{
		id: 's2-2b',
		sector: 2,
		slot: 2,
		target: 'Ca',
		count: 2,
		modifier: 'no-vent',
		brief: 'Two calcium, no venting. The bones are watching.'
	},
	{
		id: 's2-3a',
		sector: 2,
		slot: 3,
		target: 'Ti',
		count: 2,
		modifier: 'one-chain',
		brief: 'Two titanium in one chain. Structural integrity, please.'
	},
	{
		id: 's2-3b',
		sector: 2,
		slot: 3,
		target: 'Cr',
		count: 1,
		modifier: null,
		brief: 'Chromium for the shiny parts.'
	},
	{
		id: 's2-4a',
		sector: 2,
		slot: 4,
		target: 'Cr',
		count: 2,
		modifier: 'pressure-50',
		brief: 'Two chromium over fifty. The plating can take it.'
	},
	{
		id: 's2-4b',
		sector: 2,
		slot: 4,
		target: 'Fe',
		count: 1,
		modifier: null,
		brief: 'Iron. The reactor has opinions about iron.'
	},
	{
		id: 's2-5a',
		sector: 2,
		slot: 5,
		target: 'Fe',
		count: 2,
		modifier: null,
		brief: 'Boss order: two iron. The reactor wants a spine.'
	},
	{
		id: 's2-5b',
		sector: 2,
		slot: 5,
		target: 'Fe',
		count: 2,
		modifier: 'pressure-50',
		brief: 'Boss order: two iron, hot and structural.'
	},

	{
		id: 's3-1a',
		sector: 3,
		slot: 1,
		target: 'Co',
		count: 1,
		modifier: null,
		brief: 'Cobalt for the blue warning lights.'
	},
	{
		id: 's3-1b',
		sector: 3,
		slot: 1,
		target: 'Ni',
		count: 1,
		modifier: null,
		brief: 'Nickel for the coolant fittings.'
	},
	{
		id: 's3-2a',
		sector: 3,
		slot: 2,
		target: 'Cu',
		count: 1,
		modifier: null,
		brief: 'Copper for the emergency bus.'
	},
	{
		id: 's3-2b',
		sector: 3,
		slot: 2,
		target: 'Zn',
		count: 2,
		modifier: 'no-vent',
		brief: 'Two zinc, no venting. The coating is watching.'
	},
	{
		id: 's3-3a',
		sector: 3,
		slot: 3,
		target: 'Ag',
		count: 1,
		modifier: null,
		brief: 'Silver for the contacts.'
	},
	{
		id: 's3-3b',
		sector: 3,
		slot: 3,
		target: 'Au',
		count: 1,
		modifier: 'pressure-50',
		brief: 'Gold above fifty pressure. Tasteful and hot.'
	},
	{
		id: 's3-4a',
		sector: 3,
		slot: 4,
		target: 'Hg',
		count: 2,
		modifier: 'one-chain',
		brief: 'Two mercury in one chain. Do not drop them.'
	},
	{
		id: 's3-4b',
		sector: 3,
		slot: 4,
		target: 'Pb',
		count: 2,
		modifier: null,
		brief: 'Lead for the shielding.'
	},
	{
		id: 's3-5a',
		sector: 3,
		slot: 5,
		target: 'U',
		count: 1,
		modifier: null,
		brief: 'Boss order: one uranium. The reactor is very calm about this.'
	},
	{
		id: 's3-5b',
		sector: 3,
		slot: 5,
		target: 'U',
		count: 2,
		modifier: 'pressure-50',
		brief: 'Boss order: two uranium. The reactor is lying about being calm.'
	}
];

export function contractById(id: string): ContractTemplate {
	return CONTRACTS.find((contract) => contract.id === id) ?? CONTRACTS[0];
}

export function contractsForSlot(
	sector: 1 | 2 | 3,
	slot: 1 | 2 | 3 | 4 | 5
): readonly ContractTemplate[] {
	return CONTRACTS.filter((contract) => contract.sector === sector && contract.slot === slot);
}

export const BOSS_TARGET: Record<1 | 2 | 3, string> = {
	1: 'Mg',
	2: 'Fe',
	3: 'U'
};
