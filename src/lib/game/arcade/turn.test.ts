import { describe, expect, it } from 'vitest';
import { ELEMENT_BY_SYMBOL } from '../../data/elements';
import type { ElementSymbol } from '../../types';
import { createRun, STARTER_DECK } from './turn';
import type { FusionState } from './types';

function countOf(deck: readonly ElementSymbol[], symbol: ElementSymbol): number {
	return deck.filter((card) => card === symbol).length;
}

function tilesOf(run: ReturnType<typeof createRun>): { cell: number; symbol: ElementSymbol }[] {
	return run.grid.flatMap((symbol, cell) => (symbol ? [{ cell, symbol }] : []));
}

/** The full draw order, hand first, then the remaining deck. */
function drawOrder(run: ReturnType<typeof createRun>): ElementSymbol[] {
	return [...run.hand, ...run.deck];
}

describe('createRun determinism', () => {
	it('deep-equals itself for the same seed', () => {
		const first = createRun(7);
		const second = createRun(7);

		expect(second).toEqual(first);
		// A later, unrelated run must not disturb the same seed.
		createRun(99);
		expect(createRun(7)).toEqual(first);
	});

	it('produces different shuffles for different seeds', () => {
		expect(drawOrder(createRun(7))).not.toEqual(drawOrder(createRun(8)));

		const orders = new Set(
			Array.from({ length: 8 }, (_, index) => drawOrder(createRun(index + 1)).join(','))
		);
		expect(orders.size).toBeGreaterThan(1);
	});

	it('places the same seed tiles for the same seed', () => {
		expect(tilesOf(createRun(7))).toEqual(tilesOf(createRun(7)));
	});

	it('ignores the unlocked list until unlocks are implemented', () => {
		expect(createRun(7, [])).toEqual(createRun(7));
		expect(createRun(7, ['alternate-starter'])).toEqual(createRun(7));
	});
});

describe('starter deck and opening hand', () => {
	it('uses the starter deck H×5, Li×2, He×2, Be×1', () => {
		expect(STARTER_DECK).toHaveLength(10);
		expect(countOf(STARTER_DECK, 'H')).toBe(5);
		expect(countOf(STARTER_DECK, 'Li')).toBe(2);
		expect(countOf(STARTER_DECK, 'He')).toBe(2);
		expect(countOf(STARTER_DECK, 'Be')).toBe(1);
		expect(countOf(STARTER_DECK, 'Na')).toBe(0);
	});

	it('draws a hand of 5 from the shuffled deck', () => {
		const run = createRun(7);

		expect(run.hand).toHaveLength(5);
		expect(run.deck).toHaveLength(5);
		expect(run.discard).toEqual([]);
	});

	it('preserves the starter deck as the hand plus deck multiset', () => {
		const run = createRun(7);
		const all = drawOrder(run);

		expect(all).toHaveLength(10);
		expect([...all].sort()).toEqual([...STARTER_DECK].sort());
	});
});

describe('seed tiles', () => {
	const SEEDS = Array.from({ length: 50 }, (_, index) => index);

	it('seeds every new reactor with 1 or 2 tiles', () => {
		for (const seed of SEEDS) {
			const tiles = tilesOf(createRun(seed));
			expect(tiles.length, `seed ${seed}`).toBeGreaterThanOrEqual(1);
			expect(tiles.length, `seed ${seed}`).toBeLessThanOrEqual(2);
		}
	});

	it('uses both allowed tile counts across seeds', () => {
		const counts = new Set(SEEDS.map((seed) => tilesOf(createRun(seed)).length));

		expect(counts).toEqual(new Set([1, 2]));
	});

	it('places tiles at distinct in-bounds cells', () => {
		for (const seed of SEEDS) {
			const cells = tilesOf(createRun(seed)).map((tile) => tile.cell);

			expect(new Set(cells).size, `seed ${seed}`).toBe(cells.length);
			for (const cell of cells) {
				expect(cell).toBeGreaterThanOrEqual(0);
				expect(cell).toBeLessThan(25);
			}
		}
	});

	it('only seeds placeable elements (valence ≤ 3)', () => {
		for (const seed of SEEDS) {
			for (const tile of tilesOf(createRun(seed))) {
				const element = ELEMENT_BY_SYMBOL.get(tile.symbol);

				expect(element, `seed ${seed} element ${tile.symbol}`).toBeDefined();
				expect(element!.valence, `seed ${seed} element ${tile.symbol}`).toBeLessThanOrEqual(3);
			}
		}
	});

	it('derives different tile layouts from different seeds', () => {
		const layouts = new Set(
			SEEDS.map((seed) =>
				tilesOf(createRun(seed))
					.map((tile) => `${tile.cell}:${tile.symbol}`)
					.join(',')
			)
		);

		expect(layouts.size).toBeGreaterThan(1);
	});
});

describe('initial run state', () => {
	it('starts an active, cool, empty run on turn 1', () => {
		const run = createRun(7);

		expect(run.seed).toBe(7);
		expect(Number.isInteger(run.rngState)).toBe(true);
		expect(run.turn).toBe(1);
		expect(run.heat).toBe(0);
		expect(run.heatCap).toBe(100);
		expect(run.score).toBe(0);
		expect(run.bestChain).toBe(0);
		expect(run.status).toBe('active');
		expect(run.pendingDrafts).toBe(0);
		expect(run.upgrades).toEqual([]);
		expect(run.scrapUsed).toBe(false);
	});

	it('exposes the grid as 25 cells with only seed tiles filled', () => {
		const run = createRun(7);

		expect(run.grid).toHaveLength(25);
		expect(run.grid.filter((tile) => tile != null)).toHaveLength(tilesOf(run).length);
	});

	it('is usable as the minimal fusion state', () => {
		const run = createRun(7);
		const fusion: FusionState = run;

		expect(fusion.grid).toBe(run.grid);
		expect(fusion.hand).toBe(run.hand);
		expect(fusion.upgrades).toBe(run.upgrades);
	});

	it('normalizes an unusable seed without throwing', () => {
		expect(() => createRun(Number.NaN)).not.toThrow();
		expect(createRun(Number.NaN)).toEqual(createRun(Number.NaN));
		expect(createRun(-3)).toEqual(createRun(-3));
	});
});
