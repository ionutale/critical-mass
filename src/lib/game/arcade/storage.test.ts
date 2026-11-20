import { describe, expect, it } from 'vitest';
import type { ElementSymbol } from '../../types';
import { chooseUpgrade, generateDraft } from './draft';
import { createMeta } from './meta';
import { SAVE_KEY, createInitialSave, loadSave, parseSave, saveGame } from './storage';
import type { SaveState } from './storage';
import { createRun } from './turn';
import type { RunState } from './turn';

const DEFAULT_SEED = 42;

/** A minimal in-memory Storage so each test starts with a clean save slot. */
class MemoryStorage implements Storage {
	private readonly map = new Map<string, string>();

	get length(): number {
		return this.map.size;
	}

	clear(): void {
		this.map.clear();
	}

	getItem(key: string): string | null {
		return this.map.get(key) ?? null;
	}

	key(index: number): string | null {
		return [...this.map.keys()][index] ?? null;
	}

	removeItem(key: string): void {
		this.map.delete(key);
	}

	setItem(key: string, value: string): void {
		this.map.set(key, value);
	}
}

function storageWith(raw: string | null): Storage {
	const storage = new MemoryStorage();
	if (raw !== null) storage.setItem(SAVE_KEY, raw);
	return storage;
}

function failingStorage(error: Error): Storage {
	return {
		length: 0,
		clear() {},
		getItem() {
			throw error;
		},
		key() {
			return null;
		},
		removeItem() {},
		setItem() {
			throw error;
		}
	};
}

/** Every arcade field set to a distinct, non-default value. */
function richRun(): RunState {
	const grid = Array<ElementSymbol | null>(25).fill(null);
	grid[0] = 'H';
	grid[12] = 'Ne';
	grid[24] = 'Be';

	return {
		...createRun(21),
		seed: -13,
		rngState: 1234567,
		turn: 9,
		grid,
		deck: ['H', 'He', 'Li'],
		hand: ['C', 'N', 'O', 'Na', 'Mg'],
		discard: ['H', 'H', 'Fe'],
		heat: 47,
		heatCap: 120,
		score: 1234,
		bestChain: 4,
		status: 'overload',
		pendingDrafts: 2,
		upgrades: ['coolant', 'add-h-2', 'echo'],
		scrapsUsed: 1,
		milestonesCrossed: 2,
		heatSinkUsed: true,
		echoUsed: true,
		unlocked: ['pilot', 'overclock']
	};
}

/** Serialize a fresh save with the run seed replaced by an arbitrary JSON literal. */
function saveJsonWithSeedLiteral(literal: string): string {
	const run = { ...createRun(5), seed: 0 };
	const raw = JSON.stringify({ ...createInitialSave(5), run });

	if (literal === '') {
		const parsed = JSON.parse(raw) as { run: Record<string, unknown> };
		delete parsed.run.seed;
		return JSON.stringify(parsed);
	}

	return raw.replace('"seed":0', `"seed":${literal}`);
}

describe('createInitialSave', () => {
	it('builds a v2 save with the deterministic run and an empty meta', () => {
		const save = createInitialSave(7);

		expect(save.version).toBe(2);
		expect(save.run).toEqual(createRun(7));
		expect(save.meta).toEqual({
			bestScore: 0,
			totalScore: 0,
			runs: 0,
			bestChain: 0,
			unlocks: []
		});
		expect(save.settings).toEqual({ sound: true, reduceMotion: false });
	});

	it('keeps the deployed storage key', () => {
		expect(SAVE_KEY).toBe('critical-mass:save:v1');
	});
});

describe('v2 save round-trip', () => {
	it('persists every arcade run field', () => {
		const save: SaveState = {
			version: 2,
			run: richRun(),
			meta: {
				bestScore: 2100,
				totalScore: 9000,
				runs: 12,
				bestChain: 5,
				unlocks: ['pilot']
			},
			settings: { sound: false, reduceMotion: true }
		};
		const storage = storageWith(null);

		expect(saveGame(save, storage)).toBe(true);
		expect(JSON.parse(storage.getItem(SAVE_KEY) ?? '{}').version).toBe(2);

		const loaded = loadSave(storage);
		expect(loaded.recovered).toBe(false);
		expect(loaded.save).toEqual(save);
		expect(Object.keys(loaded.save.run ?? {}).sort()).toEqual(Object.keys(save.run ?? {}).sort());

		const run = loaded.save.run;
		expect(run?.seed).toBe(-13);
		expect(run?.rngState).toBe(1234567);
		expect(run?.turn).toBe(9);
		expect(run?.grid[12]).toBe('Ne');
		expect(run?.deck).toEqual(['H', 'He', 'Li']);
		expect(run?.hand).toEqual(['C', 'N', 'O', 'Na', 'Mg']);
		expect(run?.discard).toEqual(['H', 'H', 'Fe']);
		expect(run?.heat).toBe(47);
		expect(run?.heatCap).toBe(120);
		expect(run?.score).toBe(1234);
		expect(run?.bestChain).toBe(4);
		expect(run?.status).toBe('overload');
		expect(run?.pendingDrafts).toBe(2);
		expect(run?.upgrades).toEqual(['coolant', 'add-h-2', 'echo']);
		expect(run?.scrapsUsed).toBe(1);
		expect(run?.milestonesCrossed).toBe(2);
		expect(run?.heatSinkUsed).toBe(true);
		expect(run?.echoUsed).toBe(true);
		expect(run?.unlocked).toEqual(['pilot', 'overclock']);
	});

	it('keeps a v2 save with no active run', () => {
		const save: SaveState = { ...createInitialSave(3), run: null };

		const loaded = parseSave(JSON.stringify(save));
		expect(loaded.recovered).toBe(false);
		expect(loaded.save.run).toBeNull();
		expect(loaded.save.meta).toEqual(createMeta());
	});
});

describe('v1 migration', () => {
	it('resets the legacy run and meta but preserves settings', () => {
		const v1 = {
			version: 1,
			run: {
				seed: 99,
				rngState: 1,
				grid: ['H'],
				deck: ['H'],
				hand: ['H'],
				discard: [],
				pressure: 10,
				pressureCap: 100,
				sector: 1,
				sectorFloor: 0,
				contractId: 'contract-1',
				delivered: 0,
				contractsCompleted: 0,
				turn: 2,
				scrapsUsed: 0,
				pendingDiscards: 0,
				modules: [],
				hasCatalyst: false,
				ventsThisContract: 0,
				maxChain: 1,
				deliveredTargets: [],
				pendingDraft: null,
				pendingDraftKind: null,
				pendingTransition: false,
				patches: [],
				researchEarned: 5,
				contractMaxChain: 1,
				contractReduction: 0,
				meltdownSaves: 0,
				sectorShield: 0,
				status: 'active'
			},
			meta: {
				research: 42,
				unlocks: ['legacy-unlock'],
				stats: { runs: 5, wins: 2, bestSector: 3, contracts: 8 }
			},
			settings: { sound: false, reduceMotion: true },
			introSeen: true
		};

		const loaded = loadSave(storageWith(JSON.stringify(v1)));

		expect(loaded.recovered).toBe(false);
		expect(loaded.save.version).toBe(2);
		expect(loaded.save.run).toBeNull();
		expect(loaded.save.meta).toEqual(createMeta());
		expect(loaded.save.settings).toEqual({ sound: false, reduceMotion: true });
	});

	it('falls back to default settings when a v1 save has none', () => {
		const loaded = parseSave(JSON.stringify({ version: 1, run: null, meta: null }));

		expect(loaded.recovered).toBe(false);
		expect(loaded.save.run).toBeNull();
		expect(loaded.save.meta).toEqual(createMeta());
		expect(loaded.save.settings).toEqual({ sound: true, reduceMotion: false });
	});
});

describe('recovery', () => {
	it.each(['{oops', 'null', '[]', '42', '"save"'])(
		'recovers from corrupt JSON %j with a fresh save',
		(raw) => {
			const loaded = loadSave(storageWith(raw));

			expect(loaded.recovered).toBe(true);
			expect(loaded.save).toEqual(createInitialSave());
		}
	);

	it.each([
		['run is not an arcade run', { ...createInitialSave(5), run: { grid: 'nope' } }],
		[
			'run holds an unknown element',
			(() => {
				const run = createRun(5);
				const grid = [...run.grid];
				grid[0] = 'Xx' as ElementSymbol;
				return { ...createInitialSave(5), run: { ...run, grid } };
			})()
		],
		[
			'meta is malformed',
			{ ...createInitialSave(5), meta: { bestScore: 'lots', totalScore: 0, runs: 0 } }
		],
		[
			'run holds a non-finite score',
			(() => {
				const run = createRun(5);
				return { ...createInitialSave(5), run: { ...run, score: Number.NaN } };
			})()
		]
	])('recovers from a v2 save whose %s', (_label, save) => {
		const loaded = parseSave(JSON.stringify(save));

		expect(loaded.recovered).toBe(true);
		expect(loaded.save).toEqual(createInitialSave());
	});

	it('recovers when storage cannot be read', () => {
		const loaded = loadSave(failingStorage(new Error('denied')));

		expect(loaded.recovered).toBe(true);
		expect(loaded.save).toEqual(createInitialSave());
	});

	it('reports a failed write instead of throwing', () => {
		expect(saveGame(createInitialSave(), failingStorage(new Error('quota')))).toBe(false);
	});
});

describe('seed validation', () => {
	it('keeps a negative seed', () => {
		const run: RunState = { ...createRun(5), seed: -7 };

		const loaded = parseSave(JSON.stringify({ ...createInitialSave(5), run }));

		expect(loaded.recovered).toBe(false);
		expect(loaded.save.run?.seed).toBe(-7);
	});

	it.each([
		['null', 'null'],
		['a numeric string', '"13"'],
		['a non-numeric string', '"abc"'],
		['an infinite number', '1e999'],
		['a missing seed', '']
	])('defaults an unusable seed (%s) without crashing', (_label, literal) => {
		const loaded = parseSave(saveJsonWithSeedLiteral(literal));

		expect(loaded.recovered).toBe(false);
		expect(loaded.save.run?.seed).toBe(DEFAULT_SEED);
		expect(Number.isFinite(loaded.save.run?.seed ?? Number.NaN)).toBe(true);
		expect(loaded.save.run?.rngState).toBe(createRun(5).rngState);
	});
});

describe('pending drafts', () => {
	it('reconstructs the draft after a reload and lets it be chosen', () => {
		const run: RunState = { ...createRun(21), pendingDrafts: 1 };
		const expected = generateDraft(run);
		expect(expected.length).toBeGreaterThan(0);

		const loaded = loadSave(storageWith(JSON.stringify({ ...createInitialSave(21), run })));
		expect(loaded.recovered).toBe(false);

		const reloaded = loaded.save.run;
		expect(reloaded).not.toBeNull();
		if (!reloaded) return;

		expect(reloaded.pendingDrafts).toBe(1);
		expect(generateDraft(reloaded)).toEqual(expected);

		const chosen = chooseUpgrade(reloaded, 0);
		expect(chosen.pendingDrafts).toBe(0);
		expect(chosen.upgrades).toEqual([expected[0]]);
	});
});
