import { describe, expect, it } from 'vitest';
import type { ElementSymbol } from '../../types';
import { previewPlacement, resolvePlacement } from './fusion';
import { PASSIVE_HEAT } from './heat';
import type { FusionState } from './types';

const CENTER = 12;

function emptyGrid(): (ElementSymbol | null)[] {
	return Array<ElementSymbol | null>(25).fill(null);
}

function stateWith(
	tiles: readonly (readonly [number, ElementSymbol])[],
	overrides: Partial<FusionState> = {}
): FusionState {
	const grid = emptyGrid();
	for (const [cell, symbol] of tiles) grid[cell] = symbol;
	return {
		grid,
		hand: ['H'],
		heat: 0,
		heatCap: 100,
		turn: 1,
		upgrades: [],
		...overrides
	};
}

const ALL_AROUND_CENTER = [
	[7, 'H'], // N
	[13, 'H'], // E
	[17, 'H'], // S
	[11, 'H'], // W
	[8, 'H'], // NE
	[18, 'H'], // SE
	[16, 'H'], // SW
	[6, 'H'] // NW
] as const;

describe('resolvePlacement fusion rules', () => {
	it('fuses H + H into He on the origin cell', () => {
		const run = stateWith([[7, 'H']], { hand: ['H'] });

		const result = resolvePlacement(run, 0, CENTER);

		expect(result).not.toBeNull();
		expect(result!.grid).toHaveLength(25);
		expect(result!.steps).toHaveLength(1);
		expect(result!.steps[0]).toMatchObject({
			step: 1,
			a: 'H',
			b: 'H',
			result: 'He',
			cell: 7,
			rarity: 2,
			points: 2,
			heat: 2,
			choice: 0
		});
		expect(result!.steps[0].options).toEqual([
			{ cell: 7, other: 'H', result: 'He', rarity: 2, points: 2, heat: 2 }
		]);
		expect(result!.grid[CENTER]).toBe('He');
		expect(result!.grid[7]).toBeNull();
		expect(result!.scoreGain).toBe(2);
		expect(result!.heatGain).toBe(2);
	});

	it('fuses Li + H into Be (valence sum 2, higher mass 2)', () => {
		// The design document's example says "Li + He -> Be", but Li (1,2) + He (2,1)
		// sums to valence 3 (N) under the stated rule. Li + H is the rule-consistent
		// way to reach Be, and the next test pins the Li + He outcome.
		const run = stateWith([[7, 'Li']], { hand: ['H'] });

		const result = resolvePlacement(run, 0, CENTER)!;

		expect(result.steps[0].result).toBe('Be');
		expect(result.steps[0].rarity).toBe(4);
		expect(result.steps[0].points).toBe(4);
		expect(result.steps[0].heat).toBe(2);
		expect(result.grid[CENTER]).toBe('Be');
	});

	it('follows valence sum for Li + He (3, mass 2 -> N), not the spec typo', () => {
		const run = stateWith([[7, 'He']], { hand: ['Li'] });

		const result = resolvePlacement(run, 0, CENTER)!;

		expect(result.steps[0].result).toBe('N');
		expect(result.steps[0].rarity).toBe(6);
		expect(result.steps[0].heat).toBe(3);
	});

	it('fuses C + H into Ne', () => {
		const run = stateWith([[7, 'H']], { hand: ['C'] });

		const result = resolvePlacement(run, 0, CENTER)!;

		expect(result.steps[0].result).toBe('Ne');
		expect(result.steps[0].rarity).toBe(4);
		expect(result.steps[0].heat).toBe(4);
		expect(result.grid[CENTER]).toBe('Ne');
	});

	it('fuses with diagonal neighbours', () => {
		const run = stateWith([[6, 'H']], { hand: ['C'] }); // NW of center

		const result = resolvePlacement(run, 0, CENTER)!;

		expect(result.steps).toHaveLength(1);
		expect(result.steps[0].cell).toBe(6);
		expect(result.grid[CENTER]).toBe('Ne');
		expect(result.grid[6]).toBeNull();
	});

	it('never fuses when the valence sum exceeds 4', () => {
		const run = stateWith(
			[
				[7, 'H'],
				[17, 'He']
			],
			{ hand: ['Ne'] }
		); // 4 + 1 = 5

		const result = resolvePlacement(run, 0, CENTER)!;

		expect(result.steps).toEqual([]);
		expect(result.scoreGain).toBe(0);
		expect(result.heatGain).toBe(0);
		expect(result.grid[CENTER]).toBe('Ne');
		expect(result.grid[7]).toBe('H');
		expect(result.grid[17]).toBe('He');
	});

	it('uses the higher mass tier of either input (Mg + He -> Fe)', () => {
		const run = stateWith([[7, 'Mg']], { hand: ['He'] });

		const result = resolvePlacement(run, 0, CENTER)!;

		expect(result.steps[0].result).toBe('Fe');
		expect(result.steps[0].rarity).toBe(12);
		expect(result.steps[0].points).toBe(12);
		expect(result.steps[0].heat).toBe(4);
		expect(result.grid[CENTER]).toBe('Fe');
	});
});

describe('resolvePlacement adjacency and branching', () => {
	it('lists every fusable neighbour in N, E, S, W, NE, SE, SW, NW order', () => {
		const run = stateWith(ALL_AROUND_CENTER, { hand: ['C'] });

		const result = resolvePlacement(run, 0, CENTER)!;

		expect(result.steps).toHaveLength(1); // Ne is terminal
		expect(result.steps[0].options.map((option) => option.cell)).toEqual([
			7, 13, 17, 11, 8, 18, 16, 6
		]);
		for (const option of result.steps[0].options) {
			expect(option).toEqual({
				cell: option.cell,
				other: 'H',
				result: 'Ne',
				rarity: 4,
				points: 4,
				heat: 4
			});
		}
		expect(result.grid[CENTER]).toBe('Ne');
		expect(result.grid[7]).toBeNull();
		expect(result.grid[13]).toBe('H');
	});

	it('keeps only in-bounds neighbours, in the same order, at a corner', () => {
		const run = stateWith(
			[
				[1, 'H'], // E
				[5, 'H'], // S
				[6, 'H'], // SE
				[7, 'H'], // not adjacent
				[11, 'H'] // not adjacent
			],
			{ hand: ['C'] }
		);

		const result = resolvePlacement(run, 0, 0)!;

		expect(result.steps[0].options.map((option) => option.cell)).toEqual([1, 5, 6]);
	});

	it('selects the branch named by choices', () => {
		const run = stateWith(ALL_AROUND_CENTER, { hand: ['C'] });

		const result = resolvePlacement(run, 0, CENTER, [5])!;

		expect(result.steps[0].choice).toBe(5);
		expect(result.steps[0].cell).toBe(18); // SE
		expect(result.grid[18]).toBeNull();
		expect(result.grid[7]).toBe('H');
		expect(result.grid[CENTER]).toBe('Ne');
	});

	it('falls back to option 0 for an out-of-range choice', () => {
		const run = stateWith(ALL_AROUND_CENTER, { hand: ['C'] });
		const fallback = resolvePlacement(run, 0, CENTER, [99])!;
		const negative = resolvePlacement(run, 0, CENTER, [-1])!;
		const defaulted = resolvePlacement(run, 0, CENTER, [])!;

		expect(fallback.steps[0].choice).toBe(0);
		expect(fallback.steps[0].cell).toBe(7);
		expect(fallback.grid).toEqual(defaulted.grid);
		expect(negative.grid).toEqual(defaulted.grid);
	});

	it('defaults to option 0 at every step', () => {
		const run = stateWith(
			[
				[7, 'H'],
				[13, 'H'],
				[17, 'H']
			],
			{ hand: ['H'] }
		);

		const implicit = resolvePlacement(run, 0, CENTER)!;
		const explicit = resolvePlacement(run, 0, CENTER, [0, 0, 0])!;

		expect(implicit.steps.map((step) => step.choice)).toEqual([0, 0, 0]);
		expect(implicit.steps.map((step) => step.cell)).toEqual([7, 13, 17]);
		expect(implicit.grid).toEqual(explicit.grid);
		expect(implicit.steps).toEqual(explicit.steps);
	});
});

describe('resolvePlacement chains and scoring', () => {
	// Place H at center with H to the N, E, and S.
	// Step 1: H+H -> He (rarity 2), step 2: He+H -> C (rarity 3),
	// step 3: C+H -> Ne (rarity 4, terminal).
	function chainRun(overrides: Partial<FusionState> = {}): FusionState {
		return stateWith(
			[
				[7, 'H'],
				[13, 'H'],
				[17, 'H']
			],
			{ hand: ['H'], ...overrides }
		);
	}

	it('resolves a 3-step chain and scores step x rarity', () => {
		const result = resolvePlacement(chainRun(), 0, CENTER, [1, 1, 0])!;

		expect(result.steps.map((step) => step.step)).toEqual([1, 2, 3]);
		expect(result.steps.map((step) => step.result)).toEqual(['He', 'C', 'Ne']);
		expect(result.steps.map((step) => step.cell)).toEqual([13, 17, 7]);
		expect(result.steps.map((step) => step.rarity)).toEqual([2, 3, 4]);
		expect(result.steps.map((step) => step.points)).toEqual([2, 6, 12]);
		expect(result.steps.map((step) => step.heat)).toEqual([2, 4, 5]);
		for (const step of result.steps) {
			expect(step.points).toBe(step.step * step.rarity);
		}
		expect(result.steps[1].options.map((option) => option.points)).toEqual([6, 6]);
		expect(result.scoreGain).toBe(20);
		expect(result.heatGain).toBe(11);
		expect(result.grid[CENTER]).toBe('Ne');
		expect(result.grid[7]).toBeNull();
		expect(result.grid[13]).toBeNull();
		expect(result.grid[17]).toBeNull();
	});

	it('previews exactly what resolvePlacement commits for non-default choices', () => {
		const run = chainRun({ heat: 40 });
		const choices = [1, 1, 0];

		const result = resolvePlacement(run, 0, CENTER, choices)!;
		const preview = previewPlacement(run, 0, CENTER, choices)!;

		expect(preview.steps).toEqual(result.steps);
		expect(preview.grid).toEqual(result.grid);
		expect(preview.scoreGain).toBe(result.scoreGain);
		expect(preview.heatGain).toBe(result.heatGain);
		expect(preview.heatAfter).toBe(51);
		expect(preview.overload).toBe(false);
		expect(preview.heatAfterTurn).toBe(51 + PASSIVE_HEAT);
		expect(preview.overloadAfterTurn).toBe(false);
	});

	it('reports the post-turn heat and overload after the passive Heat', () => {
		// 86 + 11 chain Heat = 97, so only the end-of-turn passive Heat reaches the cap.
		const boundary = previewPlacement(chainRun({ heat: 86 }), 0, CENTER, [1, 1, 0])!;
		expect(boundary.heatAfter).toBe(97);
		expect(boundary.overload).toBe(false);
		expect(boundary.heatAfterTurn).toBe(100);
		expect(boundary.overloadAfterTurn).toBe(true);

		// A lethal chain is already at the cap, so the +3 cannot raise it further.
		const lethal = previewPlacement(chainRun({ heat: 95 }), 0, CENTER, [1, 1, 0])!;
		expect(lethal.heatAfter).toBe(100);
		expect(lethal.overload).toBe(true);
		expect(lethal.heatAfterTurn).toBe(100);
		expect(lethal.overloadAfterTurn).toBe(true);
	});

	it('reports heatAfter and overload at the cap', () => {
		const below = previewPlacement(chainRun({ heat: 88 }), 0, CENTER, [1, 1, 0])!;
		const atCap = previewPlacement(chainRun({ heat: 89 }), 0, CENTER, [1, 1, 0])!;

		expect(below.heatAfter).toBe(99);
		expect(below.overload).toBe(false);
		expect(below.heatAfterTurn).toBe(100);
		expect(below.overloadAfterTurn).toBe(true);
		expect(atCap.heatAfter).toBe(100);
		expect(atCap.overload).toBe(true);
	});

	it('clamps preview heatAfter to the cap so preview equals commit', () => {
		const preview = previewPlacement(chainRun({ heat: 95 }), 0, CENTER, [1, 1, 0])!;

		expect(preview.heatGain).toBe(11);
		expect(preview.heatAfter).toBe(100);
		expect(preview.overload).toBe(true);
	});
});

describe('resolvePlacement validation', () => {
	it('returns null for invalid cells or hand indices', () => {
		const occupied = stateWith([[CENTER, 'H']], { hand: ['H'] });
		expect(resolvePlacement(occupied, 0, CENTER)).toBeNull();

		const run = stateWith([], { hand: ['H'] });
		expect(resolvePlacement(run, 0, -1)).toBeNull();
		expect(resolvePlacement(run, 0, 25)).toBeNull();
		expect(resolvePlacement(run, 1, CENTER)).toBeNull();
		expect(previewPlacement(run, 1, CENTER)).toBeNull();
	});

	it('does not mutate the input state or its grid', () => {
		const run = stateWith([[7, 'H']], { hand: ['H'] });
		const originalGrid = [...run.grid];

		const result = resolvePlacement(run, 0, CENTER)!;

		expect(result.grid).not.toBe(run.grid);
		expect(run.grid).toEqual(originalGrid);
		expect(run.grid[CENTER]).toBeNull();
		expect(run.grid[7]).toBe('H');
		expect(run.hand).toEqual(['H']);
		expect(run.heat).toBe(0);
	});
});
