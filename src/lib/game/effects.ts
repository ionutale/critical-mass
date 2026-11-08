import { contractById, contractsForSlot } from '../data/contracts';
import { MODULE_BY_ID } from '../data/modules';
import { PATCH_BY_ID } from '../data/patches';
import type { ModuleEffect, RunState } from '../types';

export function effectCount(run: RunState, effect: ModuleEffect): number {
	let count = 0;

	for (const id of run.modules) {
		if (MODULE_BY_ID.get(id)?.effect === effect) count++;
	}
	for (const id of run.patches) {
		if (PATCH_BY_ID.get(id)?.effect === effect) count++;
	}

	return count;
}

export function hasEffect(run: RunState, effect: ModuleEffect): boolean {
	return effectCount(run, effect) > 0;
}

export function handCap(run: RunState): number {
	return 7 + effectCount(run, 'hand+1');
}

export function ventAmount(run: RunState): number {
	return 15 + 5 * effectCount(run, 'vent+5');
}

export function drawAmount(run: RunState): number {
	return 1 + effectCount(run, 'draw+1');
}

export function draftSize(run: RunState): number {
	return 3 + effectCount(run, 'draft+1');
}

export function fusionScale(run: RunState): number {
	return Math.max(0.5, 1 - 0.1 * effectCount(run, 'fusion-10'));
}

export function chainReduction(run: RunState): number {
	return 2 * effectCount(run, 'chain-bonus-2');
}

export function heavyReduction(run: RunState): number {
	return 4 * effectCount(run, 'neutron');
}

export function deliveryAmount(run: RunState): number {
	return 1 + effectCount(run, 'delivery+1');
}

export function contractCount(run: RunState): number {
	return Math.max(1, contractById(run.contractId).count - run.contractReduction);
}

export function applyEffect(run: RunState, effect: ModuleEffect): RunState {
	switch (effect) {
		case 'cap+10':
			return { ...run, pressureCap: run.pressureCap + 10 };
		case 'add-he-2':
			return { ...run, discard: [...run.discard, 'He', 'He'] };
		case 'duplicate-card': {
			const card = run.hand[0] ?? run.deck[0] ?? 'H';
			return { ...run, discard: [...run.discard, card] };
		}
		case 'catalyst':
			return { ...run, hasCatalyst: true };
		case 'meltdown-save':
			return { ...run, meltdownSaves: run.meltdownSaves + 1 };
		case 'sector-shield':
			return { ...run, sectorShield: run.sectorShield + 1 };
		case 'count-1': {
			const contract = contractById(run.contractId);
			return {
				...run,
				contractReduction: Math.min(contract.count - 1, run.contractReduction + 1)
			};
		}
		case 'reroll': {
			const contract = contractById(run.contractId);
			const other = contractsForSlot(contract.sector, contract.slot).find(
				(variant) => variant.id !== contract.id
			);
			return other ? { ...run, contractId: other.id } : run;
		}
		default:
			return run;
	}
}
