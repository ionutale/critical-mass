import type { RunState, SaveState } from '../types';
import { createRun } from './turn';

export const SAVE_KEY = 'critical-mass:save:v1';

export function randomSeed(): number {
	const buf = new Uint32Array(1);
	if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
		crypto.getRandomValues(buf);
		return buf[0];
	}
	return Date.now() % 0xffffffff;
}

function defaultStorage(): Storage {
	if (typeof window !== 'undefined') return window.localStorage;
	return globalThis.localStorage;
}

export function createInitialSave(seed = 42): SaveState {
	return {
		// v2: Task 7 adds the v1 → v2 migration (old runs reset, settings persist).
		version: 2,
		run: createRun(seed),
		meta: {
			research: 0,
			unlocks: [],
			stats: { runs: 0, wins: 0, bestSector: 1, contracts: 0 }
		},
		settings: { sound: true, reduceMotion: false },
		introSeen: true
	};
}

const DEFAULT_SEED = 42;

function parseSeed(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
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
	if (save.version !== 2) return null;
	if (save.meta && typeof save.meta.research !== 'number') return null;
	if (!save.settings || typeof save.settings.sound !== 'boolean') return null;

	const base = createInitialSave();
	let run: SaveState['run'] = null;
	if (save.run && typeof save.run === 'object') {
		const storedRun = save.run as Partial<RunState>;
		const seed = 'seed' in storedRun ? parseSeed(storedRun.seed) : DEFAULT_SEED;
		// A present-but-unusable seed means the save cannot be trusted; let loadSave recover.
		if (seed === null) return null;
		run = { ...createRun(seed), ...storedRun, seed } as RunState;
	}

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
