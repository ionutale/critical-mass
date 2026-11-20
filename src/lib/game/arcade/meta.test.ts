import { describe, expect, it } from 'vitest';
import {
	DRAFT_UPGRADE_BY_ID,
	UNLOCK_BY_ID,
	UNLOCKS,
	UNLOCK_UPGRADES
} from '../../data/arcade/unlocks';
import { ELEMENTS, ELEMENT_BY_SYMBOL, elementAt, rarityOf } from '../../data/elements';
import { UPGRADE_BY_ID, UPGRADE_CARDS } from '../../data/upgrades';
import type { UpgradeId } from '../../data/upgrades';
import type { ElementSymbol } from '../../types';
import { chooseUpgrade, generateDraft } from './draft';
import { resolvePlacement } from './fusion';
import { createMeta, evaluateUnlocks, recordRun, runStats } from './meta';
import { createRun, handSize, STARTER_DECK } from './turn';

const CENTER = 12;

function buildGrid(
	tiles: readonly (readonly [number, ElementSymbol])[] = []
): (ElementSymbol | null)[] {
	const grid = Array<ElementSymbol | null>(25).fill(null);
	for (const [cell, symbol] of tiles) grid[cell] = symbol;
	return grid;
}

function overloaded(score: number, bestChain = 0, turn = 1): ReturnType<typeof createRun> {
	return { ...createRun(7), status: 'overload', score, bestChain, turn };
}

function allUnlockIds(): string[] {
	return UNLOCKS.map((unlock) => unlock.id);
}

function drawOrder(run: ReturnType<typeof createRun>): ElementSymbol[] {
	return [...run.hand, ...run.deck];
}

function countOf(deck: readonly ElementSymbol[], symbol: ElementSymbol): number {
	return deck.filter((card) => card === symbol).length;
}

describe('unlock table', () => {
	it('defines eight ordered, unique nodes with a threshold and a metric', () => {
		expect(UNLOCKS).toHaveLength(8);
		expect(new Set(UNLOCKS.map((unlock) => unlock.id)).size).toBe(8);

		for (const unlock of UNLOCKS) {
			expect(unlock.name.length).toBeGreaterThan(0);
			expect(unlock.description.length).toBeGreaterThan(0);
			expect(unlock.threshold).toBeGreaterThan(0);
			expect(['totalScore', 'bestChain', 'runs']).toContain(unlock.metric);
			expect(['starter', 'pool', 'challenge']).toContain(unlock.kind);
			// The record is exactly the documented seven-field shape.
			expect(unlock).toEqual({
				id: unlock.id,
				name: unlock.name,
				description: unlock.description,
				threshold: unlock.threshold,
				metric: unlock.metric,
				kind: unlock.kind,
				ref: unlock.ref
			});
		}
	});

	it('points every starter node at an element and every pool node at a bonus upgrade', () => {
		const bonusIds = new Set(UNLOCK_UPGRADES.map((upgrade) => upgrade.id));
		const starters = UNLOCKS.filter((unlock) => unlock.kind === 'starter');
		const pools = UNLOCKS.filter((unlock) => unlock.kind === 'pool');

		expect(starters.length).toBeGreaterThan(0);
		expect(pools.length).toBeGreaterThan(0);
		for (const unlock of pools) expect(bonusIds.has(unlock.ref as never)).toBe(true);
	});

	it('maps every unlock id to its record', () => {
		for (const unlock of UNLOCKS) {
			expect(UNLOCK_BY_ID.get(unlock.id)).toBe(unlock);
		}
	});

	it('resolves every base and unlock-only upgrade through one draft lookup', () => {
		expect(DRAFT_UPGRADE_BY_ID.size).toBe(UPGRADE_BY_ID.size + UNLOCK_UPGRADES.length);
		expect(DRAFT_UPGRADE_BY_ID.get('coolant')?.kind).toBe('modifier');

		for (const upgrade of UNLOCK_UPGRADES) {
			expect(DRAFT_UPGRADE_BY_ID.get(upgrade.id)?.name).toBe(upgrade.name);
		}
	});
});

describe('evaluateUnlocks', () => {
	it('returns nothing below the threshold and the node at the exact threshold', () => {
		const carbon = UNLOCK_BY_ID.get('starter-carbon')!;

		expect(evaluateUnlocks(createMeta({ totalScore: carbon.threshold - 1 }))).toEqual([]);
		expect(evaluateUnlocks(createMeta({ totalScore: carbon.threshold }))).toEqual([
			'starter-carbon'
		]);
	});

	it('reads each metric from MetaState', () => {
		const score = UNLOCK_BY_ID.get('starter-carbon')!;
		const chain = UNLOCK_BY_ID.get('starter-sodium')!;
		const runs = UNLOCK_BY_ID.get('pool-nitrogen')!;

		expect(evaluateUnlocks(createMeta({ totalScore: score.threshold }))).toContain(score.id);
		expect(evaluateUnlocks(createMeta({ bestChain: chain.threshold }))).toContain(chain.id);
		expect(evaluateUnlocks(createMeta({ runs: runs.threshold }))).toContain(runs.id);
	});

	it('unlocks exactly once: applying the result makes the next evaluation empty', () => {
		const meta = createMeta({ totalScore: 5000 });
		const first = evaluateUnlocks(meta);

		expect(first).toContain('starter-carbon');
		expect(first).toContain('starter-magnesium');

		const applied = { ...meta, unlocks: [...meta.unlocks, ...first] };

		expect(evaluateUnlocks(applied)).toEqual([]);
		// Re-evaluating the same input is deterministic.
		expect(evaluateUnlocks(meta)).toEqual(first);
	});

	it('never re-reports an owned node when a threshold is crossed again', () => {
		const applied = createMeta({ totalScore: 5000, unlocks: ['starter-carbon'] });

		expect(evaluateUnlocks(applied)).not.toContain('starter-carbon');
	});

	it('reports newly crossed nodes in table order', () => {
		const unlocked = evaluateUnlocks(createMeta({ totalScore: 5000, bestChain: 4, runs: 8 }));

		expect(unlocked).toEqual(UNLOCKS.map((unlock) => unlock.id));
	});
});

describe('runStats and recordRun', () => {
	it('maps a run to score, chain, and turns', () => {
		expect(runStats(overloaded(42, 3, 17))).toEqual({ score: 42, chain: 3, turns: 17 });
	});

	it('leaves meta untouched for an unfinished run', () => {
		const meta = createMeta({ totalScore: 10, runs: 2, bestScore: 20, bestChain: 2 });

		expect(recordRun(meta, createRun(7))).toBe(meta);
	});

	it('updates best score, total score, runs, and best chain on overload', () => {
		const meta = recordRun(createMeta(), overloaded(400, 4, 22));

		expect(meta).toEqual({
			bestScore: 400,
			totalScore: 400,
			runs: 1,
			bestChain: 4,
			unlocks: ['starter-carbon', 'starter-sodium', 'pool-silicon']
		});
	});

	it('keeps the best score and chain from the strongest run', () => {
		const first = recordRun(createMeta(), overloaded(900, 5));
		const second = recordRun(first, overloaded(120, 2));

		expect(second.bestScore).toBe(900);
		expect(second.bestChain).toBe(5);
		expect(second.totalScore).toBe(1020);
		expect(second.runs).toBe(2);
	});

	it('never duplicates an unlock already in the save', () => {
		const first = recordRun(createMeta(), overloaded(100));
		const second = recordRun(first, overloaded(100));

		expect(second.unlocks.filter((id) => id === 'starter-carbon')).toHaveLength(1);
	});
});

describe('a fresh save reaches every rarity', () => {
	it('fuses base-pool Sodium and Oxygen into Fe (rarity 12) with no unlocks', () => {
		// Na and O are both base upgrade cards, so a fresh save can draft them.
		expect(UPGRADE_CARDS.get('add-na')).toEqual(['Na']);
		expect(UPGRADE_CARDS.get('add-o')).toEqual(['O']);

		const run = {
			...createRun(7),
			grid: buildGrid([[11, 'O']]),
			hand: ['Na'] as ElementSymbol[],
			heat: 0,
			heatCap: 100,
			turn: 1,
			upgrades: [] as string[]
		};

		const result = resolvePlacement(run, 0, CENTER);

		expect(result?.steps.map((step) => step.result)).toEqual(['Fe']);
		expect(result?.steps[0]?.rarity).toBe(
			rarityOf({ symbol: 'Fe', name: 'Iron', valence: 4, mass: 3 })
		);
		expect(result?.steps[0]?.rarity).toBe(12);
	});

	it('reaches every element from base content alone', () => {
		const reachable = new Set<ElementSymbol>([
			...STARTER_DECK,
			...[...UPGRADE_CARDS.values()].flat()
		]);

		let changed = true;
		while (changed) {
			changed = false;

			for (const a of [...reachable]) {
				for (const b of [...reachable]) {
					const first = ELEMENT_BY_SYMBOL.get(a)!;
					const second = ELEMENT_BY_SYMBOL.get(b)!;
					const sum = first.valence + second.valence;
					if (sum > 4) continue;

					const result = elementAt(sum, Math.max(first.mass, second.mass));
					if (result && !reachable.has(result.symbol)) {
						reachable.add(result.symbol);
						changed = true;
					}
				}
			}
		}

		expect([...reachable].sort()).toEqual(ELEMENTS.map((element) => element.symbol).sort());
	});
});

describe('createRun with unlocks', () => {
	it('records the unlocked ids on the run', () => {
		expect(createRun(7).unlocked).toEqual([]);
		expect(createRun(7, ['starter-carbon', 'pool-nitrogen']).unlocked).toEqual([
			'starter-carbon',
			'pool-nitrogen'
		]);
	});

	it('replaces starter Hydrogens with unlocked elements without changing deck size', () => {
		const base = createRun(7);
		const carbon = createRun(7, ['starter-carbon']);
		const sodium = createRun(7, ['starter-sodium']);

		expect(drawOrder(base)).toHaveLength(10);
		expect(drawOrder(carbon)).toHaveLength(10);
		expect(countOf(drawOrder(base), 'C')).toBe(0);
		expect(countOf(drawOrder(carbon), 'C')).toBe(1);
		expect(countOf(drawOrder(carbon), 'H')).toBe(4);
		expect(countOf(drawOrder(sodium), 'Na')).toBe(1);
		expect(countOf(drawOrder(sodium), 'H')).toBe(4);
	});

	it('applies several starter nodes to distinct Hydrogen slots', () => {
		const run = createRun(7, ['starter-carbon', 'starter-sodium']);
		const all = drawOrder(run);

		expect(countOf(all, 'C')).toBe(1);
		expect(countOf(all, 'Na')).toBe(1);
		expect(countOf(all, 'H')).toBe(3);
		expect(countOf(all, 'Li')).toBe(2);
		expect(countOf(all, 'He')).toBe(2);
		expect(countOf(all, 'Be')).toBe(1);
	});

	it('deals the opening hand with handSize()', () => {
		const base = createRun(7);
		const unlocked = createRun(7, allUnlockIds());

		expect(base.hand).toHaveLength(handSize(base));
		expect(unlocked.hand).toHaveLength(handSize(unlocked));
		expect(base.hand).toHaveLength(5);
		expect(unlocked.deck).toHaveLength(5);
	});

	it('never changes base stats, only deck options', () => {
		const base = createRun(7);
		const unlocked = createRun(7, allUnlockIds());

		expect(unlocked.turn).toBe(base.turn);
		expect(unlocked.heat).toBe(base.heat);
		expect(unlocked.heatCap).toBe(base.heatCap);
		expect(unlocked.score).toBe(base.score);
		expect(unlocked.bestChain).toBe(base.bestChain);
		expect(unlocked.milestonesCrossed).toBe(base.milestonesCrossed);
		expect(unlocked.grid).toEqual(base.grid);

		// The same board resolves to the same score and heat with or without unlocks.
		const board = buildGrid([
			[7, 'H'],
			[13, 'H'],
			[17, 'H']
		]);
		const choices = [1, 1, 0];
		const baseResult = resolvePlacement(
			{ ...base, grid: board, hand: ['H', 'Li', 'He', 'Be', 'Na'] },
			0,
			CENTER,
			choices
		);
		const unlockedResult = resolvePlacement(
			{ ...unlocked, grid: board, hand: ['H', 'Li', 'He', 'Be', 'Na'] },
			0,
			CENTER,
			choices
		);

		expect(unlockedResult?.scoreGain).toBe(baseResult?.scoreGain);
		expect(unlockedResult?.heatGain).toBe(baseResult?.heatGain);
	});

	it('ignores unknown unlock ids', () => {
		const base = createRun(7);
		const unknown = createRun(7, ['not-a-real-unlock']);

		expect(unknown.unlocked).toEqual(['not-a-real-unlock']);
		expect(unknown.hand).toEqual(base.hand);
		expect(unknown.deck).toEqual(base.deck);
		expect(unknown.grid).toEqual(base.grid);
	});

	it('is deterministic for the same seed and unlock list', () => {
		const ids = ['starter-carbon', 'pool-silicon'];

		expect(createRun(7, ids)).toEqual(createRun(7, ids));
		expect(createRun(7, ids)).not.toEqual(createRun(7));
	});
});

describe('draft pool with unlocks', () => {
	function findDraft(
		unlocked: string[],
		id: UpgradeId
	): { run: ReturnType<typeof createRun>; options: UpgradeId[] } {
		for (let rngState = 0; rngState < 500; rngState++) {
			const run = { ...createRun(7, unlocked), rngState };
			const options = generateDraft(run);
			if (options.includes(id)) return { run, options };
		}

		throw new Error(`no deterministic draft offered ${id}`);
	}

	it('only offers bonus upgrades when their node is unlocked', () => {
		const drafts = (unlocked: string[]) =>
			Array.from({ length: 100 }, (_, rngState) =>
				generateDraft({ ...createRun(7, unlocked), rngState })
			).flat();

		expect(drafts([])).not.toContain('add-n');
		expect(drafts(['pool-nitrogen'])).toContain('add-n');
	});

	it('keeps the base draft unchanged for a fresh save', () => {
		expect(generateDraft(createRun(7, []))).toEqual(generateDraft(createRun(7)));
	});

	it('offers bonus cards deterministically and adds them to the discard pile', () => {
		const { run, options } = findDraft(['pool-nitrogen'], 'add-n');
		const base = { ...run, pendingDrafts: 1 };

		expect(generateDraft(base)).toEqual(options);

		const after = chooseUpgrade(base, options.indexOf('add-n'));

		expect(after.upgrades).toContain('add-n');
		expect(after.discard).toEqual(['N']);
		expect(after.pendingDrafts).toBe(0);
	});
});
