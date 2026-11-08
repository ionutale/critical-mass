import { contractById, contractsForSlot } from '../data/contracts';
import { ELEMENTS } from '../data/elements';
import { MODULES } from '../data/modules';
import { PATCHES } from '../data/patches';
import type { ContractTemplate, DraftOption, RunState } from '../types';
import { applyEffect, contractCount, deliveryAmount, draftSize } from './effects';
import { pickIndex } from './rng';

export const RESEARCH_PER_CONTRACT = 1;
export const RESEARCH_BOSS_BONUS = 3;
export const RESEARCH_MODIFIER_BONUS = 1;

export function activeContract(run: RunState): ContractTemplate {
	return contractById(run.contractId);
}

export function targetTiles(run: RunState): number[] {
	const target = activeContract(run).target;
	return run.grid.flatMap((tile, index) => (tile === target ? [index] : []));
}

export function isMeltdown(run: RunState): boolean {
	return run.pressure >= run.pressureCap;
}

export function modifierMet(run: RunState, contract: ContractTemplate): boolean {
	switch (contract.modifier) {
		case 'one-chain':
			return run.contractMaxChain >= contractCount(run);
		case 'no-vent':
			return run.ventsThisContract === 0;
		case 'pressure-50':
			return run.pressure >= 50;
		case 'two-targets':
			return new Set(run.deliveredTargets).size >= 2;
		default:
			return false;
	}
}

export function researchForContract(run: RunState, contract: ContractTemplate): number {
	const bossBonus = contract.slot === 5 ? RESEARCH_BOSS_BONUS : 0;
	const modifierBonus = modifierMet(run, contract) ? RESEARCH_MODIFIER_BONUS : 0;
	return RESEARCH_PER_CONTRACT + bossBonus + modifierBonus;
}

export function researchFor(run: RunState): number {
	return run.researchEarned;
}

function cardElementPool(sector: 1 | 2 | 3): string[] {
	const maxTier = sector === 1 ? 7 : 14;
	return ELEMENTS.filter((element) => !element.heavy && element.tier <= maxTier).map(
		(element) => element.symbol
	);
}

function sameOption(a: DraftOption, b: DraftOption): boolean {
	if (a.kind !== b.kind) return false;
	if (a.kind === 'cards' && b.kind === 'cards') return a.element === b.element;
	if (a.kind === 'module' && b.kind === 'module') return a.moduleId === b.moduleId;
	if (a.kind === 'patch' && b.kind === 'patch') return a.patchId === b.patchId;
	return false;
}

export function generateDraft(
	run: RunState,
	kind: 'contract' | 'sector' = 'contract'
): { options: DraftOption[]; state: number } {
	const size = draftSize(run);
	let state = run.rngState;

	if (kind === 'sector') {
		const available = MODULES.filter(
			(module) =>
				!run.modules.includes(module.id) && !(module.effect === 'catalyst' && run.hasCatalyst)
		);
		const pool = available.length >= size ? available : MODULES;
		const options: DraftOption[] = [];
		const remaining = [...pool];

		while (options.length < size && remaining.length > 0) {
			const picked = pickIndex(state, remaining.length);
			state = picked.state;
			const [module] = remaining.splice(picked.index, 1);
			options.push({ kind: 'module', moduleId: module.id });
		}

		return { options, state };
	}

	const cards = cardElementPool(run.sector).map<DraftOption>((element) => ({
		kind: 'cards',
		element,
		count: 2
	}));
	const modules = MODULES.filter(
		(module) =>
			!run.modules.includes(module.id) && !(module.effect === 'catalyst' && run.hasCatalyst)
	).map<DraftOption>((module) => ({ kind: 'module', moduleId: module.id }));
	const patches = PATCHES.filter((patch) => !run.patches.includes(patch.id)).map<DraftOption>(
		(patch) => ({ kind: 'patch', patchId: patch.id })
	);

	const options: DraftOption[] = [];
	const categories = [cards, modules, patches];

	for (const category of categories) {
		if (options.length >= size || category.length === 0) continue;
		const picked = pickIndex(state, category.length);
		state = picked.state;
		options.push(category[picked.index]);
	}

	const remaining = [...cards, ...modules, ...patches].filter(
		(option) => !options.some((chosen) => sameOption(option, chosen))
	);

	while (options.length < size && remaining.length > 0) {
		const picked = pickIndex(state, remaining.length);
		state = picked.state;
		const [option] = remaining.splice(picked.index, 1);
		options.push(option);
	}

	return { options, state };
}

function startContract(run: RunState, sector: 1 | 2 | 3, slot: 1 | 2 | 3 | 4 | 5): RunState {
	const variants = contractsForSlot(sector, slot);
	const picked = pickIndex(run.rngState, variants.length);

	return {
		...run,
		contractId: variants[picked.index].id,
		rngState: picked.state,
		delivered: 0,
		deliveredTargets: [],
		ventsThisContract: 0,
		contractMaxChain: 0,
		contractReduction: 0,
		pendingDraft: null,
		pendingDraftKind: null,
		pendingTransition: false
	};
}

export function deliver(run: RunState, cell: number): RunState {
	if (run.status !== 'active' || run.pendingDraft || run.pendingTransition) return run;

	const contract = activeContract(run);
	if (run.grid[cell] !== contract.target) return run;

	const count = contractCount(run);
	if (run.delivered >= count) return run;

	const grid = [...run.grid];
	grid[cell] = null;
	const delivered = Math.min(count, run.delivered + deliveryAmount(run));
	const next: RunState = {
		...run,
		grid,
		delivered,
		deliveredTargets: [...run.deliveredTargets, contract.target]
	};

	if (delivered < count) return next;

	const draft = generateDraft(next, 'contract');
	return {
		...next,
		researchEarned: next.researchEarned + researchForContract(next, contract),
		pendingDraft: draft.options,
		pendingDraftKind: 'contract',
		rngState: draft.state
	};
}

function applyDraftOption(run: RunState, option: DraftOption): RunState {
	if (option.kind === 'cards') {
		return {
			...run,
			discard: [...run.discard, option.element, option.element]
		};
	}

	if (option.kind === 'module') {
		if (run.modules.includes(option.moduleId)) return run;
		const module = MODULES.find((record) => record.id === option.moduleId);
		if (!module) return run;
		return applyEffect({ ...run, modules: [...run.modules, module.id] }, module.effect);
	}

	if (run.patches.includes(option.patchId)) return run;
	const patch = PATCHES.find((record) => record.id === option.patchId);
	if (!patch) return run;
	return applyEffect({ ...run, patches: [...run.patches, patch.id] }, patch.effect);
}

export function chooseDraft(run: RunState, index: number): RunState {
	if (!run.pendingDraft || run.status !== 'active') return run;
	const option = run.pendingDraft[index];
	if (!option) return run;

	const contract = activeContract(run);
	const kind = run.pendingDraftKind;
	let next: RunState = {
		...run,
		pendingDraft: null,
		pendingDraftKind: null
	};

	if (kind === 'sector') return applyDraftOption(next, option);

	next = { ...next, contractsCompleted: next.contractsCompleted + 1 };

	if (contract.slot === 5 && run.sector === 3) {
		return applyDraftOption({ ...next, status: 'victory' }, option);
	}

	if (contract.slot === 5) {
		return applyDraftOption({ ...next, pendingTransition: true }, option);
	}

	const slot = (contract.slot + 1) as 1 | 2 | 3 | 4 | 5;
	next = startContract(next, run.sector, slot);
	return applyDraftOption(next, option);
}

export function nextSector(run: RunState): RunState {
	if (!run.pendingTransition || run.status !== 'active' || run.sector >= 3) return run;

	const sector = (run.sector + 1) as 2 | 3;
	const floor = sector === 2 ? 20 : 40;
	const shield = run.sectorShield > 0;
	const pressure = shield ? Math.max(0, floor - 10) : floor;

	const transitioned = startContract(
		{
			...run,
			sector,
			sectorFloor: floor,
			pressure,
			hasCatalyst: run.hasCatalyst || sector === 3,
			sectorShield: shield ? run.sectorShield - 1 : 0
		},
		sector,
		1
	);

	const draft = generateDraft(transitioned, 'sector');
	return {
		...transitioned,
		pendingDraft: draft.options,
		pendingDraftKind: 'sector',
		rngState: draft.state
	};
}
