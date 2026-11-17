import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyGrid, metaFixture, runFixture } from '../test/fixtures';
import {
	chooseDraft,
	deliver,
	initGame,
	newRun,
	place,
	recovered,
	resetAll,
	resetRun,
	run,
	save,
	setSetting,
	SAVE_KEY,
	unlock
} from './game';

const mockedSeeds = vi.hoisted(() => ({ queue: [] as number[] }));

vi.mock('../game/storage', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../game/storage')>();
	return {
		...actual,
		randomSeed: vi.fn(() => mockedSeeds.queue.shift() ?? 42)
	};
});

beforeEach(() => {
	mockedSeeds.queue.length = 0;
	window.localStorage.clear();
	initGame();
});

describe('game store', () => {
	it('places a card, fuses it, and autosaves', () => {
		const before = get(run)!;
		place(0, 13);
		const after = get(run)!;

		expect(after.grid[13]).toBe('He');
		expect(after.grid[12]).toBeNull();
		expect(after.pressure).toBe(7);
		expect(after.hand.length).toBe(before.hand.length);
		expect(after.discard).toContain(before.hand[0]);
		expect(JSON.parse(window.localStorage.getItem(SAVE_KEY)!).run.grid[13]).toBe('He');
	});

	it('delivers a matching tile to the contract', () => {
		const grid = emptyGrid();
		grid[0] = 'He';
		initGame({ run: runFixture({ grid }) });
		deliver(0);

		expect(get(run)!.delivered).toBe(1);
		expect(get(run)!.grid[0]).toBeNull();
	});

	it('awards research and resumes after a draft pick', () => {
		const grid = emptyGrid();
		grid[0] = 'He';
		initGame({ run: runFixture({ grid }), meta: metaFixture({ research: 0 }) });

		deliver(0);
		expect(get(save).meta.research).toBe(1);
		expect(get(run)!.pendingDraft).not.toBeNull();

		chooseDraft(0);
		expect(get(run)!.pendingDraft).toBeNull();
		expect(get(run)!.contractsCompleted).toBe(1);
		expect(get(save).meta.stats.contracts).toBe(1);
		expect(JSON.parse(window.localStorage.getItem(SAVE_KEY)!).meta.research).toBe(1);
	});

	it('keeps awarded research after a meltdown', () => {
		const grid = emptyGrid();
		grid[12] = 'H';
		initGame({
			run: runFixture({ grid, hand: ['H'], pressure: 99, researchEarned: 1 }),
			meta: metaFixture({ research: 1 })
		});

		place(0, 13);

		expect(get(run)!.status).toBe('meltdown');
		expect(get(save).meta.research).toBe(1);
	});

	it('spends research on an unlock and persists it', () => {
		initGame({ meta: metaFixture({ research: 10 }) });

		expect(unlock('card-carbon')).toBe(true);
		expect(get(save).meta.research).toBe(7);
		expect(get(save).meta.unlocks).toContain('card-carbon');
		expect(JSON.parse(window.localStorage.getItem(SAVE_KEY)!).meta.unlocks).toContain(
			'card-carbon'
		);

		expect(unlock('card-carbon')).toBe(false);
		expect(get(save).meta.research).toBe(7);
	});

	it('refuses an unlock when research is short', () => {
		initGame({ meta: metaFixture({ research: 2 }) });

		expect(unlock('card-magnesium')).toBe(false);
		expect(get(save).meta.research).toBe(2);
		expect(get(save).meta.unlocks).toEqual([]);
	});

	it('persists settings and separates reset run from reset all', () => {
		initGame({ meta: metaFixture({ research: 5, unlocks: ['card-carbon'] }) });

		setSetting('sound', false);
		expect(JSON.parse(window.localStorage.getItem(SAVE_KEY)!).settings.sound).toBe(false);
		initGame();
		expect(get(save).settings.sound).toBe(false);

		resetRun();
		expect(get(run)).toBeNull();
		expect(get(save).meta.research).toBe(5);
		expect(get(save).meta.unlocks).toEqual(['card-carbon']);

		initGame({ meta: metaFixture({ research: 5, unlocks: ['card-carbon'] }) });
		resetAll();
		expect(get(run)).toBeNull();
		expect(get(save).meta.research).toBe(0);
		expect(get(save).meta.unlocks).toEqual([]);
		expect(get(save).settings.sound).toBe(false);
	});

	it('starts each new run from a fresh seed while keeping meta and settings', () => {
		mockedSeeds.queue.push(3141592653, 2718281828);
		initGame({ meta: metaFixture({ research: 5, unlocks: ['card-carbon'] }) });
		setSetting('sound', false);

		newRun();
		const first = get(run)!;
		newRun();
		const second = get(run)!;

		expect(first.seed).toBe(3141592653);
		expect(second.seed).toBe(2718281828);
		expect(second.seed).not.toBe(first.seed);
		expect(get(save).meta.research).toBe(5);
		expect(get(save).meta.unlocks).toEqual(['card-carbon']);
		expect(get(save).meta.stats.runs).toBe(2);
		expect(get(save).settings.sound).toBe(false);
		expect(JSON.parse(window.localStorage.getItem(SAVE_KEY)!).run.seed).toBe(second.seed);
	});

	it('restores a saved run', () => {
		place(0, 13);
		const expected = get(run)!;
		initGame();
		expect(get(run)!.grid[13]).toBe('He');
		expect(get(run)!.pressure).toBe(expected.pressure);
	});

	it('recovers from a corrupt save', () => {
		window.localStorage.setItem(SAVE_KEY, '{bad');
		initGame();
		expect(get(run)!.grid[12]).toBe('H');
	});

	it('loads a save with a negative run seed without crashing', () => {
		const state = JSON.parse(JSON.stringify(get(save)));
		state.run.seed = -1;
		window.localStorage.setItem(SAVE_KEY, JSON.stringify(state));
		initGame();

		expect(get(recovered)).toBe(false);
		expect(get(run)!.seed).toBe(-1);
		expect(get(run)!.grid.filter(Boolean)).toHaveLength(1);
		expect(get(run)!.hand.length + get(run)!.deck.length).toBe(10);
	});

	it('recovers from a save with a non-numeric run seed', () => {
		const state = JSON.parse(JSON.stringify(get(save)));
		state.run.seed = 'not-a-seed';
		window.localStorage.setItem(SAVE_KEY, JSON.stringify(state));
		initGame();

		expect(get(recovered)).toBe(true);
		expect(get(run)!.grid[12]).toBe('H');
	});

	it('recovers from a save with a null run seed (NaN/Infinity after JSON)', () => {
		const state = JSON.parse(JSON.stringify(get(save)));
		state.run.seed = Number.NaN;
		window.localStorage.setItem(SAVE_KEY, JSON.stringify(state));
		initGame();

		expect(get(recovered)).toBe(true);
		expect(get(run)!.grid[12]).toBe('H');
	});

	it('recovers from a save with an infinite run seed', () => {
		const raw = JSON.stringify(get(save)).replace('"seed":42', '"seed":1e999');
		window.localStorage.setItem(SAVE_KEY, raw);
		initGame();

		expect(get(recovered)).toBe(true);
		expect(get(run)!.grid[12]).toBe('H');
	});
});
