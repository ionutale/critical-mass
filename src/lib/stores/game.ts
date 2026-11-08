import { derived, get, writable } from 'svelte/store';
import { contractById } from '../data/contracts';
import { ELEMENTS } from '../data/elements';
import { RECIPES } from '../data/recipes';
import type { RunState, SaveState } from '../types';
import { placeCard } from '../game/fusion';
import {
	discardCard as discardCardFromHand,
	scrap as scrapTile,
	vent as ventReactor
} from '../game/turn';
import { createInitialSave, loadSave, saveGame, SAVE_KEY } from '../game/storage';

export { SAVE_KEY };

export const save = writable<SaveState>(createInitialSave());
export const run = derived(save, ($save) => $save.run);
export const recovered = writable(false);

let ready = false;

save.subscribe((state) => {
	if (ready) saveGame(state);
});

export function initGame(overrides: Partial<SaveState> = {}): void {
	const loaded = loadSave();
	const state: SaveState = {
		...loaded.save,
		...overrides,
		settings: { ...loaded.save.settings, ...overrides.settings }
	};
	ready = true;
	save.set(state);
	recovered.set(loaded.recovered);
	saveGame(state);
}

export function place(handIndex: number, cell: number): void {
	const current = get(run);
	if (!current) return;
	const next = placeCard(current, handIndex, cell, ELEMENTS, RECIPES);
	save.update((state) => ({ ...state, run: next }));
}

export function vent(handIndex: number): void {
	const current = get(run);
	if (!current) return;
	save.update((state) => ({ ...state, run: ventReactor(current, handIndex) }));
}

export function discardCard(handIndex: number): void {
	const current = get(run);
	if (!current) return;
	save.update((state) => ({ ...state, run: discardCardFromHand(current, handIndex) }));
}

export function scrap(cell: number): void {
	const current = get(run);
	if (!current) return;
	save.update((state) => ({ ...state, run: scrapTile(current, cell) }));
}

export function deliver(cell: number): void {
	const current = get(run);
	if (!current) return;

	const contract = contractById(current.contractId);
	if (current.grid[cell] !== contract.target) return;
	if (current.delivered >= contract.count) return;

	const grid = [...current.grid];
	grid[cell] = null;
	const next: RunState = {
		...current,
		grid,
		delivered: current.delivered + 1,
		deliveredTargets: [...current.deliveredTargets, contract.target]
	};

	save.update((state) => ({ ...state, run: next }));
}

export function newRun(): void {
	const fresh = createInitialSave();
	save.set({
		...fresh,
		meta: {
			...fresh.meta,
			stats: { ...get(save).meta.stats, runs: get(save).meta.stats.runs + 1 }
		}
	});
	saveGame(get(save));
}
