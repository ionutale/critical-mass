import { ELEMENT_BY_SYMBOL } from '../../data/elements';
import type { UpgradeId } from '../../data/upgrades';
import type { ElementSymbol } from '../../types';
import { createMeta } from './meta';
import type { MetaState } from './meta';
import { createRun } from './turn';
import type { RunState } from './turn';

/**
 * Stable localStorage key. The key names the deployed save slot and does not
 * change with the schema; `SaveState.version` is what carries the schema.
 */
export const SAVE_KEY = 'critical-mass:save:v1';

export const SAVE_VERSION = 2;

const DEFAULT_SEED = 42;
const GRID_SIZE = 5;
const CELL_COUNT = GRID_SIZE * GRID_SIZE;

export interface Settings {
	sound: boolean;
	reduceMotion: boolean;
}

/**
 * Save schema v2: one arcade run (or none), lifetime meta progression, and the
 * two player settings. v1 saves from the retiring engine are migrated by
 * discarding their run and meta while keeping the settings.
 */
export interface SaveState {
	version: 2;
	run: RunState | null;
	meta: MetaState;
	settings: Settings;
}

export interface LoadedSave {
	save: SaveState;
	recovered: boolean;
}

const DEFAULT_SETTINGS: Settings = { sound: true, reduceMotion: false };

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

export function createInitialSave(seed = DEFAULT_SEED): SaveState {
	return {
		version: SAVE_VERSION,
		run: createRun(seed),
		meta: createMeta(),
		settings: { ...DEFAULT_SETTINGS }
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

function isNonNegativeNumber(value: unknown): value is number {
	return isFiniteNumber(value) && value >= 0;
}

function isCount(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isElementSymbol(value: unknown): value is ElementSymbol {
	return typeof value === 'string' && ELEMENT_BY_SYMBOL.has(value as ElementSymbol);
}

/**
 * A seed is display metadata plus the RNG's origin. Any finite number works,
 * including negatives; anything else (NaN, Infinity, strings, missing) falls
 * back to the default so a hand-edited save cannot crash the loader.
 */
function coerceSeed(value: unknown): number {
	return isFiniteNumber(value) ? value : DEFAULT_SEED;
}

function parseGrid(value: unknown): (ElementSymbol | null)[] | null {
	if (!Array.isArray(value) || value.length !== CELL_COUNT) return null;

	const grid: (ElementSymbol | null)[] = [];
	for (const cell of value) {
		if (cell === null) {
			grid.push(null);
			continue;
		}
		if (!isElementSymbol(cell)) return null;
		grid.push(cell);
	}

	return grid;
}

function parseCards(value: unknown): ElementSymbol[] | null {
	if (!Array.isArray(value)) return null;

	const cards: ElementSymbol[] = [];
	for (const card of value) {
		if (!isElementSymbol(card)) return null;
		cards.push(card);
	}

	return cards;
}

function parseStrings(value: unknown): string[] | null {
	if (!Array.isArray(value)) return null;
	return value.every((item): item is string => typeof item === 'string') ? [...value] : null;
}

/**
 * Validate the persisted run field by field. A save is only trusted when every
 * engine input is usable; otherwise the loader recovers a fresh save rather
 * than resuming a run that would throw on the next action.
 */
function parseRun(value: unknown): RunState | null {
	if (!isRecord(value)) return null;

	const grid = parseGrid(value.grid);
	const deck = parseCards(value.deck);
	const hand = parseCards(value.hand);
	const discard = parseCards(value.discard);
	const upgrades = parseStrings(value.upgrades);
	const unlocked = parseStrings(value.unlocked);

	if (grid === null || deck === null || hand === null || discard === null) return null;
	if (upgrades === null || unlocked === null) return null;

	if (typeof value.rngState !== 'number' || !Number.isInteger(value.rngState)) return null;
	if (!isCount(value.turn) || value.turn < 1) return null;
	if (value.status !== 'active' && value.status !== 'overload') return null;
	if (!isNonNegativeNumber(value.heat)) return null;
	if (!isFiniteNumber(value.heatCap) || value.heatCap <= 0) return null;
	if (!isNonNegativeNumber(value.score) || !isNonNegativeNumber(value.bestChain)) return null;
	if (!isCount(value.pendingDrafts)) return null;
	if (!isCount(value.scrapsUsed) || !isCount(value.milestonesCrossed)) return null;

	return {
		seed: coerceSeed(value.seed),
		rngState: value.rngState,
		turn: value.turn,
		grid,
		deck,
		hand,
		discard,
		heat: value.heat,
		heatCap: value.heatCap,
		score: value.score,
		bestChain: value.bestChain,
		status: value.status,
		pendingDrafts: value.pendingDrafts,
		upgrades: upgrades as UpgradeId[],
		scrapsUsed: value.scrapsUsed,
		milestonesCrossed: value.milestonesCrossed,
		heatSinkUsed: value.heatSinkUsed === true,
		echoUsed: value.echoUsed === true,
		unlocked
	};
}

function parseMeta(value: unknown): MetaState | null {
	if (!isRecord(value)) return null;

	const unlocks = parseStrings(value.unlocks);
	if (unlocks === null) return null;
	if (!isNonNegativeNumber(value.bestScore) || !isNonNegativeNumber(value.totalScore)) return null;
	if (!isNonNegativeNumber(value.runs) || !isNonNegativeNumber(value.bestChain)) return null;

	return {
		bestScore: value.bestScore,
		totalScore: value.totalScore,
		runs: value.runs,
		bestChain: value.bestChain,
		unlocks
	};
}

function parseSettings(value: unknown): Settings {
	if (!isRecord(value)) return { ...DEFAULT_SETTINGS };

	return {
		sound: typeof value.sound === 'boolean' ? value.sound : DEFAULT_SETTINGS.sound,
		reduceMotion:
			typeof value.reduceMotion === 'boolean' ? value.reduceMotion : DEFAULT_SETTINGS.reduceMotion
	};
}

function recoveredSave(): LoadedSave {
	return { save: createInitialSave(), recovered: true };
}

/**
 * Parse a raw save. A valid v2 save is restored field for field; a v1 save is
 * migrated to a v2 save with no active run and fresh meta but the same
 * settings; anything corrupt recovers a fresh save and reports it.
 *
 * Pending drafts need no persisted options: `generateDraft` derives them from
 * `rngState`, `upgrades`, and `unlocked`, so `pendingDrafts` alone restores the
 * draft the player was facing.
 */
export function parseSave(raw: string): LoadedSave {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return recoveredSave();
	}

	if (!isRecord(parsed)) return recoveredSave();

	const settings = parseSettings(parsed.settings);

	if (parsed.version === 1) {
		return {
			save: {
				version: SAVE_VERSION,
				run: null,
				meta: createMeta(),
				settings
			},
			recovered: false
		};
	}

	if (parsed.version !== SAVE_VERSION) return recoveredSave();

	const run = parsed.run == null ? null : parseRun(parsed.run);
	if (parsed.run != null && run === null) return recoveredSave();

	const meta = parseMeta(parsed.meta);
	if (meta === null) return recoveredSave();

	return { save: { version: SAVE_VERSION, run, meta, settings }, recovered: false };
}

export function loadSave(storage: Storage = defaultStorage()): LoadedSave {
	let raw: string | null;
	try {
		raw = storage.getItem(SAVE_KEY);
	} catch {
		return recoveredSave();
	}

	if (!raw) return { save: createInitialSave(), recovered: false };

	return parseSave(raw);
}

export function saveGame(save: SaveState, storage: Storage = defaultStorage()): boolean {
	try {
		storage.setItem(SAVE_KEY, JSON.stringify(save));
		return true;
	} catch {
		return false;
	}
}
