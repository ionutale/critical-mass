import { describe, expect, it } from 'vitest';
import { ELEMENT_BY_SYMBOL } from '../../data/elements';
import type { ElementSymbol } from '../../types';
import { previewPlacement } from './fusion';
import { chooseUpgrade } from './draft';
import { PASSIVE_HEAT } from './heat';
import {
	applyHeat,
	createRun,
	drawToHandSize,
	endTurn,
	heatFloor,
	placeCard,
	queueMilestones,
	scrap,
	stabilize,
	STARTER_DECK
} from './turn';
import type { FusionState } from './types';

const CENTER = 12;

function buildGrid(
	tiles: readonly (readonly [number, ElementSymbol])[] = []
): (ElementSymbol | null)[] {
	const grid = Array<ElementSymbol | null>(25).fill(null);
	for (const [cell, symbol] of tiles) grid[cell] = symbol;
	return grid;
}

/** H at N, E, and S of the center: a 3-step He -> C -> Ne chain. */
const CHAIN_TILES = [
	[7, 'H'],
	[13, 'H'],
	[17, 'H']
] as const;
const CHAIN_CHOICES = [1, 1, 0] as const;
const FULL_HAND: ElementSymbol[] = ['H', 'Li', 'He', 'Be', 'Na'];

function chainRun(
	overrides: Partial<ReturnType<typeof createRun>> = {}
): ReturnType<typeof createRun> {
	return {
		...createRun(7),
		grid: buildGrid(CHAIN_TILES),
		hand: [...FULL_HAND],
		deck: ['H', 'Li', 'He', 'Be', 'Na'],
		discard: [] as ElementSymbol[],
		heat: 0,
		...overrides
	};
}

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

	it('records unlocks but ignores unknown ids', () => {
		const base = createRun(7);
		const unknown = createRun(7, ['alternate-starter']);

		expect(unknown.unlocked).toEqual(['alternate-starter']);
		expect(unknown.hand).toEqual(base.hand);
		expect(unknown.deck).toEqual(base.deck);
		expect(unknown.grid).toEqual(base.grid);
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
		expect(run.milestonesCrossed).toBe(0);
		expect(run.upgrades).toEqual([]);
		expect(run.scrapsUsed).toBe(0);
		expect(run.unlocked).toEqual([]);
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

describe('placeCard turn resolution', () => {
	it('resolves the chain, then adds passive Heat, draws to 5, and resets scrapsUsed', () => {
		const run = chainRun({ scrapsUsed: 1 });

		const after = placeCard(run, 0, CENTER);

		// Chain: He (2) + C (4) + Ne (5) = 11 heat, 20 score; then the passive Heat.
		expect(after.heat).toBe(11 + PASSIVE_HEAT);
		expect(after.score).toBe(20);
		expect(after.bestChain).toBe(3);
		expect(after.turn).toBe(run.turn + 1);
		expect(after.grid[CENTER]).toBe('Ne');
		expect(after.grid[7]).toBeNull();
		expect(after.grid[13]).toBeNull();
		expect(after.grid[17]).toBeNull();
		// The placed card enters the discard and one card is drawn back.
		expect(after.discard).toEqual(['H']);
		expect(after.deck).toEqual(['Li', 'He', 'Be', 'Na']);
		expect(after.hand).toHaveLength(5);
		expect(after.hand.at(-1)).toBe('H');
		expect(after.scrapsUsed).toBe(0);
		expect(after.status).toBe('active');
	});

	it('commits exactly the previewed grid, score, and heat for non-default choices', () => {
		const run = chainRun({ heat: 40 });
		const preview = previewPlacement(run, 0, CENTER, CHAIN_CHOICES)!;

		const after = placeCard(run, 0, CENTER, CHAIN_CHOICES);

		expect(after.grid).toEqual(preview.grid);
		expect(after.score - run.score).toBe(preview.scoreGain);
		expect(after.heat).toBe(preview.heatAfterTurn);
	});

	it('awards score before overload when the chain itself reaches the cap', () => {
		const run = chainRun({ heat: 95 });
		const preview = previewPlacement(run, 0, CENTER, CHAIN_CHOICES)!;
		expect(preview.heatAfter).toBe(100);
		expect(preview.overload).toBe(true);

		const after = placeCard(run, 0, CENTER, CHAIN_CHOICES);

		expect(after.score - run.score).toBe(preview.scoreGain);
		expect(after.score - run.score).toBeGreaterThan(0);
		expect(after.grid).toEqual(preview.grid);
		expect(after.heat).toBe(preview.heatAfterTurn);
		expect(after.status).toBe('overload');
		// A lethal placement does not run the end-of-turn draw.
		expect(after.turn).toBe(run.turn);
	});

	it('overloads when the end-of-turn passive Heat crosses the cap', () => {
		const run = chainRun({ grid: buildGrid(), heat: 98 });
		const preview = previewPlacement(run, 0, CENTER)!;
		expect(preview.overload).toBe(false);
		expect(preview.heatAfterTurn).toBe(100);
		expect(preview.overloadAfterTurn).toBe(true);

		const after = placeCard(run, 0, CENTER);

		expect(after.score).toBe(run.score);
		expect(after.heat).toBe(preview.heatAfterTurn);
		expect(after.status).toBe('overload');
		expect(after.turn).toBe(run.turn + 1);
	});

	it('ignores invalid placements', () => {
		const run = chainRun();

		expect(placeCard(run, 0, CENTER, [])).not.toBe(run);
		expect(placeCard(run, 9, CENTER)).toBe(run);
		expect(placeCard(run, 0, 7)).toBe(run);
		expect(placeCard(run, 0, -1)).toBe(run);
	});

	it('does not mutate the input run', () => {
		const run = chainRun();
		const grid = [...run.grid];
		const hand = [...run.hand];

		placeCard(run, 0, CENTER);

		expect(run.grid).toEqual(grid);
		expect(run.hand).toEqual(hand);
		expect(run.heat).toBe(0);
		expect(run.score).toBe(0);
	});
});

describe('stabilize', () => {
	it('discards a card, cools 15, adds passive Heat, and does not draw', () => {
		const run = chainRun({ turn: 10, heat: 70, discard: ['Be'], scrapsUsed: 1 });

		const after = stabilize(run, 2);

		expect(after.hand).toEqual(['H', 'Li', 'Be', 'Na']);
		expect(after.discard).toEqual(['Be', 'He']);
		expect(after.heat).toBe(70 - 15 + PASSIVE_HEAT);
		expect(after.turn).toBe(11);
		expect(after.deck).toEqual(run.deck);
		expect(after.hand).toHaveLength(4);
		expect(after.scrapsUsed).toBe(0);
	});

	it('cools only down to the rising passive floor', () => {
		const run = chainRun({ turn: 10, heat: 35 });

		const after = stabilize(run, 0);

		expect(heatFloor(run)).toBe(PASSIVE_HEAT * 10);
		// 35 is already below the turn-10 floor: Stabilize must not raise it, so
		// only the passive Heat applies.
		expect(after.heat).toBe(35 + PASSIVE_HEAT);
		expect(after.heat).toBeLessThan(PASSIVE_HEAT * 10 + PASSIVE_HEAT);
	});

	it('never raises Heat on turn 1 or when already at the floor', () => {
		const firstTurn = chainRun({ turn: 1, heat: 0 });
		const afterFirst = stabilize(firstTurn, 0);
		expect(afterFirst.heat).toBe(PASSIVE_HEAT);
		expect(afterFirst.heat).toBeLessThan(heatFloor(firstTurn) + PASSIVE_HEAT);

		const atFloor = chainRun({ turn: 10, heat: PASSIVE_HEAT * 10 });
		const afterFloor = stabilize(atFloor, 0);
		expect(afterFloor.heat).toBe(PASSIVE_HEAT * 10 + PASSIVE_HEAT);
	});

	it('is a pure pass when the hand is empty: passive Heat, no cooling, no draw', () => {
		const run = chainRun({ turn: 5, heat: 40, hand: [], deck: ['H'] });

		const after = stabilize(run, 0);

		expect(after.turn).toBe(6);
		expect(after.heat).toBe(40 + PASSIVE_HEAT);
		expect(after.hand).toEqual([]);
		expect(after.deck).toEqual(['H']);
		expect(after.discard).toEqual(run.discard);
	});

	it('ignores an out-of-range hand index instead of cooling for free', () => {
		const run = chainRun({ turn: 10, heat: 70 });

		expect(stabilize(run, 7)).toBe(run);
		expect(stabilize(run, -1)).toBe(run);
	});

	it('overloads a stabilize-only loop within 40 turns via the rising floor', () => {
		let run = createRun(7);
		let turns = 0;

		while (run.status === 'active' && turns < 40) {
			// Milestones still queue drafts, which lock the turn until chosen.
			if (run.pendingDrafts > 0) {
				run = chooseUpgrade(run, 0);
				continue;
			}
			run = stabilize(run, 0);
			turns++;
		}

		expect(run.status).toBe('overload');
		expect(run.heat).toBe(100);
		expect(turns).toBeLessThan(40);
	});
});

describe('scrap', () => {
	it('removes one tile without ending the turn or costing a card', () => {
		const run = chainRun();

		const after = scrap(run, 7);

		expect(after.grid[7]).toBeNull();
		expect(after.grid[13]).toBe('H');
		expect(after.scrapsUsed).toBe(1);
		expect(after.turn).toBe(run.turn);
		expect(after.hand).toEqual(run.hand);
		expect(after.deck).toEqual(run.deck);
		expect(after.score).toBe(run.score);
	});

	it('is limited to once per turn and resets on the next turn', () => {
		const run = chainRun();
		const once = scrap(run, 7);

		const twice = scrap(once, 13);
		expect(twice.grid[13]).toBe('H');
		expect(twice.grid).toEqual(once.grid);

		const nextTurn = endTurn(once);
		expect(nextTurn.scrapsUsed).toBe(0);
		expect(scrap(nextTurn, 13).grid[13]).toBeNull();
	});

	it('ignores empty cells, invalid cells, and tiles after overload', () => {
		const run = chainRun();
		expect(scrap(run, 0)).toBe(run);
		expect(scrap(run, -1)).toBe(run);
		expect(scrap(run, 25)).toBe(run);
		expect(scrap({ ...run, status: 'overload' }, 7)).toEqual({ ...run, status: 'overload' });
	});
});

describe('endTurn', () => {
	it('advances the turn, adds passive Heat, and resets scrapsUsed', () => {
		const run = chainRun({ scrapsUsed: 1, heat: 10 });

		const after = endTurn(run);

		expect(after.turn).toBe(run.turn + 1);
		expect(after.heat).toBe(10 + PASSIVE_HEAT);
		expect(after.scrapsUsed).toBe(0);
	});

	it('reshuffles the discard when the deck is empty', () => {
		const run = chainRun({
			hand: ['H', 'H', 'H', 'H'],
			deck: [],
			discard: ['Li', 'He', 'Be', 'Na', 'Mg'],
			heat: 0
		});

		const after = endTurn(run);

		expect(after.hand).toHaveLength(5);
		expect(after.deck).toHaveLength(4);
		expect(after.discard).toEqual([]);
		expect(after.hand).toEqual([...run.hand, after.hand[4]]);
		expect(after.rngState).toBeTypeOf('number');
	});

	it('draws to hand size when short', () => {
		const run = chainRun({ hand: ['H', 'H'], deck: ['Li', 'He', 'Be'] });

		const after = drawToHandSize(run);

		expect(after.hand).toHaveLength(5);
		expect(after.deck).toEqual([]);
	});
});

describe('applyHeat', () => {
	it('adds heat and clamps to the cap', () => {
		const run = createRun(7);

		expect(applyHeat(run, 11).heat).toBe(11);
		expect(applyHeat({ ...run, heat: 95 }, 11).heat).toBe(100);
		expect(applyHeat({ ...run, heat: 100 }, 3)).toEqual({ ...run, heat: 100 });
	});
});

describe('milestones', () => {
	it('queues one draft per milestone passed', () => {
		const run = createRun(7);

		expect(queueMilestones({ ...run, heat: 24 }).pendingDrafts).toBe(0);
		expect(queueMilestones({ ...run, heat: 25 }).pendingDrafts).toBe(1);
		expect(queueMilestones({ ...run, heat: 50 }).pendingDrafts).toBe(2);
		expect(queueMilestones({ ...run, heat: 75 }).pendingDrafts).toBe(3);
	});

	it('queues two drafts when a single turn crosses 25 and 50', () => {
		const hotTurn = queueMilestones({ ...createRun(7), heat: 60 });

		expect(hotTurn.pendingDrafts).toBe(2);
		// Re-queueing the same state must not queue again.
		expect(queueMilestones(hotTurn).pendingDrafts).toBe(2);
	});

	it('never requeues a milestone after the heat is cooled and raised again', () => {
		const crossed = queueMilestones({ ...createRun(7), heat: 60 });
		const cooled = queueMilestones({ ...crossed, heat: 10 });
		const reheated = queueMilestones({ ...cooled, heat: 60 });

		expect(cooled.pendingDrafts).toBe(2);
		expect(reheated.pendingDrafts).toBe(2);
	});

	it('queues a draft when the end-of-turn passive Heat crosses 25', () => {
		const run = chainRun({ grid: buildGrid(), heat: 25 - PASSIVE_HEAT });

		const after = placeCard(run, 0, CENTER);

		expect(after.heat).toBe(25);
		expect(after.pendingDrafts).toBe(1);
	});
});
