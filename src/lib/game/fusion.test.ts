import { describe, expect, it } from 'vitest';
import { ELEMENTS } from '../data/elements';
import { RECIPES } from '../data/recipes';
import { emptyGrid, runFixture } from '../test/fixtures';
import { placeCard, previewPlacement } from './fusion';
import { createRun } from './turn';

// Active He at 12 with Be at 7 (N) and C at 13 (E): Be+He->C, C+He->O.
function branchRun() {
	const grid = emptyGrid();
	grid[7] = 'Be';
	grid[13] = 'C';
	return runFixture({ grid, hand: ['He'] });
}

describe('fusion', () => {
	it('previews and commits the same single fusion', () => {
		const run = createRun(42);
		const preview = previewPlacement(run, 0, 13, ELEMENTS, RECIPES)!;

		expect(preview.steps.map((step) => step.result)).toEqual(['He']);
		expect(preview.pressureGain).toBe(7);
		expect(preview.grid[12]).toBeNull();
		expect(preview.grid[13]).toBe('He');

		const after = placeCard(run, 0, 13, ELEMENTS, RECIPES);
		expect(after.grid[13]).toBe('He');
		expect(after.grid[12]).toBeNull();
		expect(after.pressure).toBe(preview.pressureAfter);
	});

	it('resolves north before east before south before west', () => {
		const grid = emptyGrid();
		grid[7] = 'H';
		grid[13] = 'H';
		const run = runFixture({ grid, hand: ['H'] });
		const preview = previewPlacement(run, 0, 12, ELEMENTS, RECIPES)!;
		expect(preview.steps[0].cell).toBe(7);
	});

	it('chains from the placed tile and terminates', () => {
		const grid = emptyGrid();
		grid[7] = 'He';
		grid[11] = 'He';
		const run = runFixture({ grid, hand: ['C'] });
		const preview = previewPlacement(run, 0, 12, ELEMENTS, RECIPES)!;
		expect(preview.steps.map((step) => step.result)).toEqual(['O', 'Ne']);
		expect(preview.grid[7]).toBeNull();
		expect(preview.grid[11]).toBeNull();
		expect(preview.grid[12]).toBe('Ne');
	});

	it('lists all candidate neighbors per step', () => {
		const preview = previewPlacement(branchRun(), 0, 12, ELEMENTS, RECIPES)!;
		expect(preview.steps[0].options.length).toBeGreaterThanOrEqual(2);
	});

	it('uses the chosen option index', () => {
		const a = previewPlacement(branchRun(), 0, 12, ELEMENTS, RECIPES, [0])!;
		const b = previewPlacement(branchRun(), 0, 12, ELEMENTS, RECIPES, [1])!;
		expect(a.steps[0].result).not.toBe(b.steps[0].result);
	});

	it('falls back to first option for out-of-range choice', () => {
		const a = previewPlacement(branchRun(), 0, 12, ELEMENTS, RECIPES, [99])!;
		const b = previewPlacement(branchRun(), 0, 12, ELEMENTS, RECIPES, [])!;
		expect(a.grid).toEqual(b.grid);
	});

	it('commit equals preview with non-default choices', () => {
		const run = branchRun();
		const choices = [1];
		const preview = previewPlacement(run, 0, 12, ELEMENTS, RECIPES, choices)!;
		const next = placeCard(run, 0, 12, ELEMENTS, RECIPES, choices);
		expect(next.grid).toEqual(preview.grid);
		expect(next.pressure).toBe(preview.pressureAfter);
	});

	it('applies the chosen option at each step and commits the previewed branch', () => {
		const grid = emptyGrid();
		grid[7] = 'Be';
		grid[13] = 'C';
		grid[17] = 'He';
		grid[11] = 'He';
		const run = runFixture({ grid, hand: ['He'] });

		const preview = previewPlacement(run, 0, 12, ELEMENTS, RECIPES, [1, 0])!;
		expect(preview.steps.length).toBeGreaterThanOrEqual(2);
		expect(preview.steps[0].options[0]).toEqual({
			cell: 7,
			other: 'Be',
			result: 'C',
			pressure: 9
		});
		expect(preview.steps[0].choice).toBe(1);
		expect(preview.steps[0].result).toBe('O');
		expect(preview.steps[1].options.length).toBeGreaterThanOrEqual(2);
		expect(preview.steps[1].choice).toBe(0);
		expect(preview.steps[1].cell).toBe(preview.steps[1].options[0].cell);

		const committed = placeCard(run, 0, 12, ELEMENTS, RECIPES, [1, 0]);
		expect(committed.grid).toEqual(preview.grid);
		expect(committed.pressure).toBe(preview.pressureAfter);

		const other = previewPlacement(run, 0, 12, ELEMENTS, RECIPES, [1, 1])!;
		expect(other.steps[1].cell).not.toBe(preview.steps[1].cell);
		expect(other.steps[1].result).toBe(preview.steps[1].result);
	});

	it('leaves a lone tile unfused and marks a meltdown at the cap', () => {
		const lone = runFixture({ hand: ['H'] });
		expect(previewPlacement(lone, 0, 0, ELEMENTS, RECIPES)!.steps).toEqual([]);

		const hot = createRun(42);
		hot.pressure = 98;
		const preview = previewPlacement(hot, 0, 13, ELEMENTS, RECIPES)!;
		expect(preview.pressureAfter).toBe(105);
		expect(preview.meltdown).toBe(true);
	});
});
