import { get } from 'svelte/store';
import { beforeEach, describe, expect, it } from 'vitest';
import { emptyGrid, runFixture } from '../test/fixtures';
import { deliver, initGame, place, run, SAVE_KEY } from './game';

beforeEach(() => {
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
		expect(after.pressure).toBe(5);
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
});
