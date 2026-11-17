import { describe, expect, it } from 'vitest';
import { searchForTarget } from '../../../scripts/balance';
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
