import { describe, expect, it } from 'vitest';
import {
	checkBands,
	competentPlay,
	searchForTarget,
	type Block,
	type Result
} from '../../../scripts/balance';
import { emptyGrid, runFixture } from '../test/fixtures';

/**
 * Regression for the branch search that only explored non-default options.
 *
 * Placing He at 12 has two step-0 options:
 *   default: 7 Be + He -> C
 *   branch: 13 He + He -> Be
 * Only the default line can reach N: after C, 13 He -> O is option 0 and
 * 11 H -> N is option 1. The old search skipped the default option, explored
 * the Be line instead, and reported N unreachable.
 */
describe('balance branch search', () => {
	it('finds a target that needs the default at depth 0 and a branch at depth 1', () => {
		const grid = emptyGrid();
		grid[7] = 'Be';
		grid[13] = 'He';
		grid[11] = 'H';
		const run = runFixture({ grid, hand: ['He'] });

		const found = searchForTarget(run, 0, 12, 'N', { nodes: 64 });

		expect(found).not.toBeNull();
		expect(found!.choices).toEqual([0, 1]);
		expect(found!.preview.grid).toContain('N');
	});
});

function result(overrides: Partial<Result> = {}): Result {
	return {
		seed: 1,
		status: 'meltdown',
		contracts: 0,
		peak: 0,
		pressure: 0,
		sector: 1,
		actions: 1,
		idleAtEnd: 0,
		abandoned: false,
		stalled: false,
		...overrides
	};
}

function block(overrides: Partial<Block> = {}): Block {
	return {
		label: 'Test block',
		target: 'test band',
		results: [],
		...overrides
	};
}

function resultsWithWins(total: number, wins: number): Result[] {
	return Array.from({ length: total }, (_, index) =>
		result({ seed: index + 1, status: index < wins ? 'victory' : 'meltdown' })
	);
}

describe('balance acceptance bands', () => {
	it('accepts a win rate inside the band and rejects rates outside it', () => {
		const band = { min: 10, max: 20 };

		expect(checkBands([block({ results: resultsWithWins(40, 7), band })])).toEqual([]);
		expect(checkBands([block({ results: resultsWithWins(40, 4), band })])).toEqual([]);
		expect(checkBands([block({ results: resultsWithWins(40, 8), band })])).toEqual([]);

		expect(checkBands([block({ results: resultsWithWins(40, 3), band })])).toHaveLength(1);
		expect(checkBands([block({ results: resultsWithWins(40, 9), band })])).toHaveLength(1);
	});

	it('rejects stalls when the band allows none', () => {
		const band = { min: 30, max: 50, maxStalls: 0 };
		const clean = resultsWithWins(40, 18);
		const stalled = clean.map((entry, index) =>
			index === 0 ? { ...entry, status: 'active' as const, stalled: true } : entry
		);

		expect(checkBands([block({ results: clean, band })])).toEqual([]);
		expect(checkBands([block({ results: stalled, band })])).toEqual([
			'Test block: 1 stalls, expected at most 0'
		]);
	});

	it('terminates the competent policy without stalls on a small seed set', () => {
		for (const seed of [1, 2, 3]) {
			const played = competentPlay(seed, []);

			expect(played.stalled).toBe(false);
			expect(['victory', 'meltdown']).toContain(played.status);
			expect(played.actions).toBeGreaterThan(0);
		}
	});
});
