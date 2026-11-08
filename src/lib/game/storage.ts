import type { SaveState } from '../types';
import { createRun } from './turn';

export const SAVE_KEY = 'critical-mass:save:v1';

function defaultStorage(): Storage {
	if (typeof window !== 'undefined') return window.localStorage;
	return globalThis.localStorage;
}

export function createInitialSave(seed = 42): SaveState {
	return {
		version: 1,
		run: createRun(seed),
		meta: {
			research: 0,
			unlocks: [],
			stats: { runs: 2, wins: 0, bestSector: 1, contracts: 0 }
		},
		settings: { sound: true, reduceMotion: false },
		introSeen: true
	};
}

export function parseSave(raw: string): SaveState | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}

	if (typeof parsed !== 'object' || parsed === null) return null;
	const save = parsed as Partial<SaveState>;
	if (save.version !== 1) return null;
	if (save.meta && typeof save.meta.research !== 'number') return null;
	if (!save.settings || typeof save.settings.sound !== 'boolean') return null;

	const base = createInitialSave();
	const run =
		save.run && typeof save.run === 'object'
			? { ...createRun(save.run.seed ?? 42), ...save.run }
			: null;

	return {
		...base,
		...save,
		run,
		meta: { ...base.meta, ...(save.meta ?? {}) },
		settings: { ...base.settings, ...(save.settings ?? {}) }
	} as SaveState;
}

export function loadSave(storage: Storage = defaultStorage()): {
	save: SaveState;
	recovered: boolean;
} {
	let raw: string | null;
	try {
		raw = storage.getItem(SAVE_KEY);
	} catch {
		return { save: createInitialSave(), recovered: true };
	}

	if (!raw) return { save: createInitialSave(), recovered: false };

	const parsed = parseSave(raw);
	if (!parsed) return { save: createInitialSave(), recovered: true };
	return { save: parsed, recovered: false };
}

export function saveGame(save: SaveState, storage: Storage = defaultStorage()): boolean {
	try {
		storage.setItem(SAVE_KEY, JSON.stringify(save));
		return true;
	} catch {
		return false;
	}
}
