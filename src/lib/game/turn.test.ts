import { describe, expect, it } from 'vitest';
import { contractsForSlot } from '../data/contracts';
import { ELEMENTS } from '../data/elements';
import { RECIPES } from '../data/recipes';
import { emptyGrid, runFixture } from '../test/fixtures';
import { placeCard } from './fusion';
import { createRun, discardCard, endTurn, scrap, START_VARIANTS, vent } from './turn';

describe('turn', () => {
	it('builds a ten-card deck, draws five, and seeds the center', () => {
		const run = createRun(42);
		expect(run.hand).toHaveLength(5);
		expect(run.deck.length + run.hand.length).toBe(10);
		expect(run.grid[12]).toBe('H');
		expect(run.deck).toEqual(expect.arrayContaining(['H', 'H']));
	});

	it('replays the same start for the same seed', () => {
		const first = createRun(7);
		const second = createRun(7);

		expect(second).toEqual(first);
		expect(second.contractId).toBe(first.contractId);
	});

	it('starts different variants for seeds that map to different entries', () => {
		expect(START_VARIANTS.length).toBeGreaterThan(1);

		const first = createRun(0);
		const second = createRun(1);

		expect(first.grid).not.toEqual(second.grid);
		expect([...first.hand, ...first.deck].sort()).not.toEqual(
			[...second.hand, ...second.deck].sort()
		);
	});

	it('normalizes negative seeds to a valid variant', () => {
		const run = createRun(-1);
		// -1 normalizes to the last variant for a three-entry table.
		const variant = START_VARIANTS[START_VARIANTS.length - 1];

		expect(run.grid[variant.cell]).toBe('H');
		expect(run.grid.filter(Boolean)).toHaveLength(1);
		expect(run.hand.length + run.deck.length).toBe(10);
		expect(run.seed).toBe(-1);
	});

	it('falls back to the first variant for a non-finite seed', () => {
		const run = createRun(Number.NaN);

		expect(run.grid[START_VARIANTS[0].cell]).toBe('H');
		expect(run.hand.length + run.deck.length).toBe(10);
	});

	it('gives every variant a reachable sector-1 slot-1 first contract', () => {
		const firstSlot = contractsForSlot(1, 1);

		START_VARIANTS.forEach((variant, index) => {
			const run = createRun(index);
			const contract = firstSlot.find((candidate) => candidate.id === run.contractId);

			expect(contract).toBeDefined();
			const target = contract?.target;
			const startTile = run.grid[variant.cell];
			expect(startTile).not.toBeNull();
			expect([...run.hand, ...run.deck]).toHaveLength(10);

			const spare = [...run.hand, ...run.deck].some((card) =>
				RECIPES.some(
					(recipe) =>
						recipe.result === target &&
						((recipe.a === startTile && recipe.b === card) ||
							(recipe.b === startTile && recipe.a === card))
				)
			);
			expect(spare).toBe(true);
		});
	});

	it('discards a placed card and draws back to five', () => {
		const run = createRun(42);
		const after = placeCard(run, 0, 13, ELEMENTS, RECIPES);
		expect(after.discard).toContain(run.hand[0]);
		expect(after.hand).toHaveLength(5);
	});

	it('vents down to the sector floor, costing one card', () => {
		const run = runFixture({
			pressure: 10,
			sectorFloor: 20,
			deck: ['H'],
			hand: ['H', 'He', 'H', 'H', 'H']
		});
		const after = vent(run, 0);
		expect(after.pressure).toBe(20);
		expect(after.discard).toHaveLength(run.discard.length + 1);
		expect(after.hand).toHaveLength(5);
	});

	it('scraps one tile per turn', () => {
		const grid = emptyGrid();
		grid[0] = 'Si';
		const run = runFixture({ grid });
		const after = scrap(run, 0);
		expect(after.grid[0]).toBeNull();
		expect(after.scrapsUsed).toBe(1);

		const again = scrap(after, 1);
		expect(again).toBe(after);
	});

	it('reshuffles the discard when the deck runs out', () => {
		const run = runFixture({ deck: [], discard: ['H', 'He'], hand: [] });
		const after = endTurn(run);
		expect(after.hand).toHaveLength(1);
		expect(after.deck).toHaveLength(1);
	});

	it('caps the hand and discards the overflow', () => {
		const run = runFixture({
			deck: ['H'],
			hand: ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H']
		});
		const after = endTurn(run);
		expect(after.pendingDiscards).toBe(2);
		const cleaned = discardCard(after, 0);
		expect(cleaned.pendingDiscards).toBe(1);
		expect(cleaned.hand).toHaveLength(8);
	});
});
