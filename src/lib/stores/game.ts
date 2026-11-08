import { derived, get, writable } from 'svelte/store';
import { ELEMENTS } from '../data/elements';
import { RECIPES } from '../data/recipes';
import { UNLOCKS } from '../data/unlocks';
import type { RunState, SaveState } from '../types';
import {
	chooseDraft as chooseDraftFromEngine,
	deliver as deliverTile,
	nextSector as nextSectorFromEngine
} from '../game/contracts';
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

function commit(nextRun: RunState): void {
	save.update((state) => {
		const previous = state.run;
		const researchGain = Math.max(0, nextRun.researchEarned - (previous?.researchEarned ?? 0));
		const contractGain = Math.max(
			0,
			nextRun.contractsCompleted - (previous?.contractsCompleted ?? 0)
		);
		const meta = {
			...state.meta,
			research: state.meta.research + researchGain,
			stats: { ...state.meta.stats }
		};
		meta.stats.contracts += contractGain;

		if (nextRun.status === 'victory' && previous?.status !== 'victory') {
			meta.stats.wins += 1;
			meta.stats.bestSector = 3;
		} else if (nextRun.status === 'meltdown' && previous?.status !== 'meltdown') {
			meta.stats.bestSector = Math.max(meta.stats.bestSector, nextRun.sector);
		}

		return { ...state, run: nextRun, meta };
	});
}

export function place(handIndex: number, cell: number): void {
	const current = get(run);
	if (!current) return;
	commit(placeCard(current, handIndex, cell, ELEMENTS, RECIPES));
}

export function vent(handIndex: number): void {
	const current = get(run);
	if (!current) return;
	commit(ventReactor(current, handIndex));
}

export function discardCard(handIndex: number): void {
	const current = get(run);
	if (!current) return;
	commit(discardCardFromHand(current, handIndex));
}

export function scrap(cell: number): void {
	const current = get(run);
	if (!current) return;
	commit(scrapTile(current, cell));
}

export function deliver(cell: number): void {
	const current = get(run);
	if (!current) return;
	commit(deliverTile(current, cell, get(save).meta.unlocks));
}

export function chooseDraft(index: number): void {
	const current = get(run);
	if (!current) return;
	commit(chooseDraftFromEngine(current, index));
}

export function nextSector(): void {
	const current = get(run);
	if (!current) return;
	commit(nextSectorFromEngine(current, get(save).meta.unlocks));
}

export function unlock(id: string): boolean {
	const node = UNLOCKS.find((record) => record.id === id);
	if (!node) return false;

	let purchased = false;
	save.update((state) => {
		if (state.meta.unlocks.includes(id) || state.meta.research < node.cost) return state;
		purchased = true;
		return {
			...state,
			meta: {
				...state.meta,
				research: state.meta.research - node.cost,
				unlocks: [...state.meta.unlocks, id]
			}
		};
	});

	return purchased;
}

export function setSetting(key: 'sound' | 'reduceMotion', value: boolean): void {
	save.update((state) => ({
		...state,
		settings: { ...state.settings, [key]: value }
	}));
}

/** Clears the active run but keeps research, unlocks, settings, and stats. */
export function resetRun(): void {
	save.update((state) => ({ ...state, run: null }));
}

/** Clears the run, research, unlocks, and stats but keeps the player's settings. */
export function resetAll(): void {
	const current = get(save);
	const fresh = createInitialSave();
	save.set({
		...fresh,
		run: null,
		settings: current.settings,
		introSeen: current.introSeen
	});
}

export function newRun(): void {
	const current = get(save);
	const fresh = createInitialSave();
	save.set({
		...fresh,
		meta: {
			...current.meta,
			stats: { ...current.meta.stats, runs: current.meta.stats.runs + 1 }
		},
		settings: current.settings,
		introSeen: current.introSeen
	});
	saveGame(get(save));
}
