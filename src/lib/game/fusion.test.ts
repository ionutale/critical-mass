import { describe, expect, it } from 'vitest';
import { ELEMENTS } from '../data/elements';
import { RECIPES } from '../data/recipes';
import { emptyGrid, runFixture } from '../test/fixtures';
import { placeCard, previewPlacement } from './fusion';
import { createRun } from './turn';

describe('fusion', () => {
	it('previews and commits the same single fusion', () => {
		const run = createRun(42);
		const preview = previewPlacement(run, 0, 13, ELEMENTS, RECIPES)!;

		expect(preview.steps.map((step) => step.result)).toEqual(['He']);
		expect(preview.pressureGain).toBe(5);
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

	it('leaves a lone tile unfused and marks a meltdown at the cap', () => {
		const lone = runFixture({ hand: ['H'] });
		expect(previewPlacement(lone, 0, 0, ELEMENTS, RECIPES)!.steps).toEqual([]);

		const hot = createRun(42);
		hot.pressure = 98;
		const preview = previewPlacement(hot, 0, 13, ELEMENTS, RECIPES)!;
		expect(preview.pressureAfter).toBe(103);
		expect(preview.meltdown).toBe(true);
	});
});
