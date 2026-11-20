import { derived, get, writable } from 'svelte/store';
import { chooseUpgrade as chooseUpgradeFromEngine } from '../game/arcade/draft';
import { recordRun } from '../game/arcade/meta';
import {
	createInitialSave,
	loadSave,
	randomSeed,
	saveGame,
	SAVE_KEY
} from '../game/arcade/storage';
import type { SaveState } from '../game/arcade/storage';
import {
	createRun,
	placeCard,
	scrap as scrapFromEngine,
	stabilize as stabilizeFromEngine
} from '../game/arcade/turn';
import type { RunState } from '../game/arcade/turn';

export { SAVE_KEY };

export const save = writable<SaveState>(createInitialSave());
export const run = derived(save, ($save) => $save.run);
export const recovered = writable(false);

/** True whenever the run cannot accept board actions. */
export const locked = derived(save, ($save) => {
	const current = $save.run;
	return current !== null && (current.pendingDrafts > 0 || current.status === 'overload');
});

let ready = false;

save.subscribe((state) => {
	if (ready) saveGame(state);
});

/**
 * Install a save into the store. Loading never tallies the run: an Overload is
 * recorded by `commit` when it happens, and a reloaded Overload was already
 * counted before it was persisted.
 */
export function initGame(overrides: Partial<SaveState> = {}): void {
	const loaded = loadSave();
	const state: SaveState = {
		...loaded.save,
		...overrides,
		settings: { ...loaded.save.settings, ...overrides.settings }
	};

	ready = false;
	save.set(state);
	ready = true;

	recovered.set(loaded.recovered);
	saveGame(state);
}

/**
 * Commit one engine result and autosave it. The engine returns the input run
 * object for invalid or blocked actions, so identity is the no-op check.
 *
 * An Overload is tallied exactly once: only a run that was not already
 * overloaded can record its score and unlocks, and a reload never records.
 */
function commit(state: SaveState, nextRun: RunState): void {
	if (state.run === nextRun) return;

	const record = nextRun.status === 'overload' && state.run?.status !== 'overload';
	const meta = record ? recordRun(state.meta, nextRun) : state.meta;

	save.set({ ...state, run: nextRun, meta });
}

export function place(handIndex: number, cell: number, choices: readonly number[] = []): void {
	const state = get(save);
	if (!state.run) return;
	commit(state, placeCard(state.run, handIndex, cell, choices));
}

export function stabilize(handIndex: number): void {
	const state = get(save);
	if (!state.run) return;
	commit(state, stabilizeFromEngine(state.run, handIndex));
}

export function scrap(cell: number): void {
	const state = get(save);
	if (!state.run) return;
	commit(state, scrapFromEngine(state.run, cell));
}

export function chooseUpgrade(index: number): void {
	const state = get(save);
	if (!state.run) return;
	commit(state, chooseUpgradeFromEngine(state.run, index));
}

/**
 * Start a fresh run from a random seed, keeping the lifetime meta and settings.
 * Starting a run does not tally it; `recordRun` counts completed Overloads.
 */
export function newRun(): void {
	const state = get(save);
	save.set({ ...state, run: createRun(randomSeed(), state.meta.unlocks) });
}

export function setSetting(key: 'sound' | 'reduceMotion', value: boolean): void {
	save.update((state) => ({
		...state,
		settings: { ...state.settings, [key]: value }
	}));
}

/** Clears the active run but keeps meta and settings. */
export function resetRun(): void {
	save.update((state) => ({ ...state, run: null }));
}

/** Clears the run and meta but keeps the player's settings. */
export function resetAll(): void {
	const state = get(save);
	const fresh = createInitialSave();
	save.set({ ...fresh, run: null, settings: state.settings });
}
