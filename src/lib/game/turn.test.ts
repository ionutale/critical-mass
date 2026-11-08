import { describe, expect, it } from 'vitest';
import { ELEMENTS } from '../data/elements';
import { RECIPES } from '../data/recipes';
import { emptyGrid, runFixture } from '../test/fixtures';
import { placeCard } from './fusion';
import { createRun, discardCard, endTurn, scrap, vent } from './turn';

describe('turn', () => {
	it('builds a ten-card deck, draws five, and seeds the center', () => {
		const run = createRun(42);
		expect(run.hand).toHaveLength(5);
		expect(run.deck.length + run.hand.length).toBe(10);
		expect(run.grid[12]).toBe('H');
		expect(run.deck).toEqual(expect.arrayContaining(['H', 'H']));
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
