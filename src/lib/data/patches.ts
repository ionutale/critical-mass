import type { PatchRecord } from '../types';

export const PATCHES: readonly PatchRecord[] = [
	{
		id: 'patch-coolant',
		name: 'Coolant Flush',
		description: 'This run, venting sheds 5 more pressure.',
		effect: 'vent+5'
	},
	{
		id: 'patch-vessel',
		name: 'Thicker Vessel',
		description: 'This run, pressure cap +10.',
		effect: 'cap+10'
	},
	{
		id: 'patch-rack',
		name: 'Spare Rack',
		description: 'This run, hand limit +1.',
		effect: 'hand+1'
	},
	{
		id: 'patch-feed',
		name: 'Extra Feed',
		description: 'This run, draw +1 card each turn.',
		effect: 'draw+1'
	},
	{
		id: 'patch-shield',
		name: 'Emergency Shield',
		description: 'This run, survive one meltdown.',
		effect: 'meltdown-save'
	},
	{
		id: 'patch-line',
		name: 'Express Line',
		description: 'This run, each delivery counts as 2 progress.',
		effect: 'delivery+1'
	}
];

export const PATCH_BY_ID = new Map(PATCHES.map((patch) => [patch.id, patch]));
