import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateDraft } from '../game/arcade/draft';
import { createMeta, recordRun } from '../game/arcade/meta';
import type { SaveState } from '../game/arcade/storage';
import {
	createRun,
	placeCard,
	scrap as scrapFromEngine,
	stabilize as stabilizeFromEngine
} from '../game/arcade/turn';
import type { RunState } from '../game/arcade/turn';
import type { ElementSymbol } from '../types';
import {
	chooseUpgrade,
	initGame,
	locked,
	newRun,
	place,
	recovered,
	resetAll,
	resetRun,
	run,
	save,
	SAVE_KEY,
	scrap,
	setSetting,
	stabilize
} from './arcade';

const mockedSeeds = vi.hoisted(() => ({ queue: [] as number[] }));

vi.mock('../game/arcade/storage', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../game/arcade/storage')>();
	return {
		...actual,
		randomSeed: vi.fn(() => mockedSeeds.queue.shift() ?? 42)
	};
});

const CENTER = 12;
const CHAIN_TILES: readonly (readonly [number, ElementSymbol])[] = [
	[7, 'H'],
	[13, 'H'],
	[17, 'H']
];
const CHAIN_CHOICES = [1, 1, 0] as const;
const FULL_HAND: ElementSymbol[] = ['H', 'Li', 'He', 'Be', 'Na'];

function gridWith(tiles: readonly (readonly [number, ElementSymbol])[]): (ElementSymbol | null)[] {
	const grid: (ElementSymbol | null)[] = Array(25).fill(null);
	for (const [cell, symbol] of tiles) grid[cell] = symbol;
	return grid;
}

/** A deterministic active run with a 3-step chain available at the centre. */
function arcadeRun(overrides: Partial<RunState> = {}): RunState {
	return {
		...createRun(7),
		grid: gridWith(CHAIN_TILES),
		hand: [...FULL_HAND],
		deck: [...FULL_HAND],
		discard: [],
		heat: 10,
		...overrides
	};
}

function stored(): SaveState {
	const raw = window.localStorage.getItem(SAVE_KEY);
	expect(raw).not.toBeNull();
	return JSON.parse(raw as string) as SaveState;
}

beforeEach(() => {
	mockedSeeds.queue.length = 0;
	window.localStorage.clear();
	initGame();
});

describe('initGame', () => {
	it('restores the arcade save and persists it', () => {
		const loadedRun = arcadeRun({ score: 42, heat: 55 });
		const meta = createMeta({ bestScore: 50, runs: 2, unlocks: ['starter-carbon'] });

		initGame({ run: loadedRun, meta, settings: { sound: false, reduceMotion: true } });

		expect(get(run)).toEqual(loadedRun);
		expect(get(save).meta).toEqual(meta);
		expect(get(save).settings).toEqual({ sound: false, reduceMotion: true });
		expect(get(recovered)).toBe(false);
		expect(stored().run).toEqual(loadedRun);
		expect(stored().meta).toEqual(meta);
	});

	it('recovers from a corrupt save and persists the recovered state', () => {
		window.localStorage.setItem(SAVE_KEY, '{bad');
		initGame();

		expect(get(recovered)).toBe(true);
		expect(get(run)).not.toBeNull();
		expect(get(save).meta).toEqual(createMeta());
		expect(stored().version).toBe(2);
		expect(stored().run).not.toBeNull();
	});
});

describe('actions', () => {
	it('commits a placement exactly as the engine resolves it and persists it', () => {
		const before = arcadeRun();
		initGame({ run: before });

		const expected = placeCard(before, 0, CENTER, CHAIN_CHOICES);
		place(0, CENTER, [...CHAIN_CHOICES]);

		const after = get(run)!;
		expect(after).toEqual(expected);
		expect(after.score).toBeGreaterThan(before.score);
		expect(after.bestChain).toBe(3);
		expect(after.grid[7]).toBeNull();
		expect(stored().run).toEqual(expected);
	});

	it('commits a stabilize turn and persists it', () => {
		const before = arcadeRun({ turn: 10, heat: 70 });
		initGame({ run: before });

		const expected = stabilizeFromEngine(before, 0);
		stabilize(0);

		const after = get(run)!;
		expect(after).toEqual(expected);
		expect(after.heat).toBe(58);
		expect(after.turn).toBe(11);
		expect(after.hand).toHaveLength(4);
		expect(stored().run).toEqual(expected);
	});

	it('commits a scrap without ending the turn and persists it', () => {
		const before = arcadeRun();
		initGame({ run: before });

		const expected = scrapFromEngine(before, 7);
		scrap(7);

		const after = get(run)!;
		expect(after).toEqual(expected);
		expect(after.grid[7]).toBeNull();
		expect(after.turn).toBe(before.turn);
		expect(after.scrapsUsed).toBe(1);
		expect(stored().run).toEqual(expected);
	});

	it('consumes one queued draft per chooseUpgrade and advances to the next', () => {
		const before = arcadeRun({ pendingDrafts: 2 });
		initGame({ run: before });

		const firstDraft = generateDraft(before);
		chooseUpgrade(0);

		expect(get(run)!.pendingDrafts).toBe(1);
		expect(get(run)!.upgrades).toEqual([firstDraft[0]]);

		const secondDraft = generateDraft(get(run)!);
		chooseUpgrade(1);

		const after = get(run)!;
		expect(after.pendingDrafts).toBe(0);
		expect(after.upgrades).toEqual([firstDraft[0], secondDraft[1]]);
		expect(stored().run).toEqual(after);
	});
});

describe('locked', () => {
	it('blocks every action while a draft is pending', () => {
		const before = arcadeRun({ pendingDrafts: 1 });
		initGame({ run: before });

		expect(get(locked)).toBe(true);

		const setItem = vi.spyOn(window.localStorage, 'setItem');
		place(0, CENTER, [...CHAIN_CHOICES]);
		stabilize(0);
		scrap(7);

		expect(get(run)).toBe(before);
		expect(get(save).run).toBe(before);
		expect(setItem).not.toHaveBeenCalled();
		setItem.mockRestore();
	});

	it('blocks every action after overload', () => {
		const before = arcadeRun({ status: 'overload' });
		initGame({ run: before });

		expect(get(locked)).toBe(true);

		const setItem = vi.spyOn(window.localStorage, 'setItem');
		place(0, CENTER, [...CHAIN_CHOICES]);
		stabilize(0);
		scrap(7);
		chooseUpgrade(0);

		expect(get(run)).toBe(before);
		expect(setItem).not.toHaveBeenCalled();
		setItem.mockRestore();
	});

	it('is unlocked while the run is active with no queued draft', () => {
		initGame({ run: arcadeRun() });
		expect(get(locked)).toBe(false);

		resetRun();
		expect(get(locked)).toBe(false);
	});
});

describe('overload tally', () => {
	it('records the run exactly once and persists the meta update', () => {
		const before = arcadeRun({ heat: 95 });
		initGame({ run: before, meta: createMeta() });

		place(0, CENTER, [...CHAIN_CHOICES]);

		const after = get(run)!;
		const expectedMeta = recordRun(createMeta(), after);

		expect(after.status).toBe('overload');
		expect(get(locked)).toBe(true);
		expect(after.score).toBeGreaterThan(0);
		expect(get(save).meta).toEqual(expectedMeta);
		expect(get(save).meta.bestScore).toBe(after.score);
		expect(get(save).meta.totalScore).toBe(after.score);
		expect(get(save).meta.runs).toBe(1);
		expect(get(save).meta.bestChain).toBe(after.bestChain);
		expect(get(save).meta.unlocks).toContain('starter-sodium');
		expect(stored().meta).toEqual(expectedMeta);

		// A second action cannot tally the same run again.
		place(0, CENTER, [...CHAIN_CHOICES]);
		expect(get(save).meta).toEqual(expectedMeta);

		// Reloading the overloaded save does not tally it either.
		initGame();
		expect(get(save).meta).toEqual(expectedMeta);
		expect(get(run)!.status).toBe('overload');
	});
});

describe('newRun', () => {
	it('starts from a fresh random seed and preserves meta and settings', () => {
		mockedSeeds.queue.push(3141592653, 2718281828);
		const meta = createMeta({
			bestScore: 90,
			totalScore: 120,
			runs: 2,
			bestChain: 4,
			unlocks: ['starter-carbon']
		});
		initGame({ meta, settings: { sound: false, reduceMotion: true } });

		newRun();
		const first = get(run)!;
		expect(first.seed).toBe(3141592653);
		expect(first.unlocked).toEqual(['starter-carbon']);
		expect(get(save).meta).toEqual(meta);
		expect(get(save).settings).toEqual({ sound: false, reduceMotion: true });

		newRun();
		const second = get(run)!;
		expect(second.seed).toBe(2718281828);
		expect(second.seed).not.toBe(first.seed);
		// Starting a run does not tally it; recordRun counts completed runs.
		expect(get(save).meta).toEqual(meta);
		expect(stored().run?.seed).toBe(second.seed);
		expect(stored().settings).toEqual({ sound: false, reduceMotion: true });
	});
});

describe('settings and resets', () => {
	it('persists a setting change without touching the run', () => {
		const before = arcadeRun({ score: 12 });
		initGame({ run: before });

		setSetting('sound', false);

		expect(get(save).settings.sound).toBe(false);
		expect(get(save).settings.reduceMotion).toBe(false);
		expect(get(run)).toBe(before);
		expect(stored().settings.sound).toBe(false);
		expect(stored().run).toEqual(before);
	});

	it('resetRun clears only the run', () => {
		const meta = createMeta({
			bestScore: 50,
			runs: 2,
			bestChain: 4,
			unlocks: ['starter-carbon']
		});
		initGame({ meta, settings: { sound: false, reduceMotion: true } });

		resetRun();

		expect(get(run)).toBeNull();
		expect(get(save).meta).toEqual(meta);
		expect(get(save).settings).toEqual({ sound: false, reduceMotion: true });
		expect(stored().run).toBeNull();
		expect(stored().meta).toEqual(meta);
	});

	it('resetAll clears the run and meta but keeps settings', () => {
		const meta = createMeta({
			bestScore: 50,
			runs: 2,
			bestChain: 4,
			unlocks: ['starter-carbon']
		});
		initGame({ meta, settings: { sound: false, reduceMotion: true } });

		resetAll();

		expect(get(run)).toBeNull();
		expect(get(save).meta).toEqual(createMeta());
		expect(get(save).settings).toEqual({ sound: false, reduceMotion: true });
		expect(stored().run).toBeNull();
		expect(stored().meta).toEqual(createMeta());
		expect(stored().settings.sound).toBe(false);
	});
});
