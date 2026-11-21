import { describe, expect, it } from 'vitest';
import { UPGRADE_BY_ID, UPGRADE_CARDS, UPGRADES } from '../../data/upgrades';
import type { UpgradeId } from '../../data/upgrades';
import type { ElementSymbol } from '../../types';
import { chooseUpgrade, generateDraft, hasUpgrade } from './draft';
import { previewPlacement, resolvePlacement } from './fusion';
import { createRun, endTurn, placeCard, scrap, stabilize } from './turn';

const CENTER = 12;

function buildGrid(
	tiles: readonly (readonly [number, ElementSymbol])[] = []
): (ElementSymbol | null)[] {
	const grid = Array<ElementSymbol | null>(25).fill(null);
	for (const [cell, symbol] of tiles) grid[cell] = symbol;
	return grid;
}

/**
 * H at N, E, and S of the center: a 3-step He -> C -> Ne chain.
 * Base: score 2 + 6 + 12, heat 2 + 4 + 5.
 */
function chainRun(
	overrides: Partial<ReturnType<typeof createRun>> = {}
): ReturnType<typeof createRun> {
	return {
		...createRun(7),
		grid: buildGrid([
			[7, 'H'],
			[13, 'H'],
			[17, 'H']
		]),
		hand: ['H', 'Li', 'He', 'Be', 'Na'],
		deck: ['H', 'Li', 'He', 'Be', 'Na'],
		discard: [],
		heat: 0,
		...overrides
	};
}

const CHAIN_CHOICES = [1, 1, 0] as const;

const MODIFIER_IDS: UpgradeId[] = UPGRADES.filter((upgrade) => upgrade.kind === 'modifier').map(
	(upgrade) => upgrade.id
);

/**
 * Find the first seed whose deterministic draft satisfies `predicate`.
 * Drafts depend only on `rngState` and owned modifiers, so this is stable.
 */
function findDraft(
	predicate: (options: UpgradeId[]) => boolean,
	owned: UpgradeId[] = []
): { run: ReturnType<typeof createRun>; options: UpgradeId[] } {
	for (let seed = 0; seed < 500; seed++) {
		const run = { ...createRun(seed), pendingDrafts: 1, upgrades: [...owned] };
		const options = generateDraft(run);
		if (predicate(options)) return { run, options };
	}

	throw new Error('no deterministic draft matched the predicate');
}

describe('upgrade pool', () => {
	it('defines all 15 concrete upgrades with unique ids and a kind', () => {
		expect(UPGRADES).toHaveLength(15);
		expect(new Set(UPGRADES.map((upgrade) => upgrade.id)).size).toBe(15);

		for (const upgrade of UPGRADES) {
			expect(upgrade.name.length).toBeGreaterThan(0);
			expect(upgrade.description.length).toBeGreaterThan(0);
			expect(['card', 'modifier']).toContain(upgrade.kind);
			// The record is exactly the documented four-field shape.
			expect(upgrade).toEqual({
				id: upgrade.id,
				name: upgrade.name,
				description: upgrade.description,
				kind: upgrade.kind
			});
		}
	});

	it('maps the seven card upgrades to the cards they add', () => {
		expect(UPGRADE_BY_ID.get('add-h-2')?.kind).toBe('card');
		expect(UPGRADE_CARDS.get('add-h-2')).toEqual(['H', 'H']);
		expect(UPGRADE_CARDS.get('add-he-2')).toEqual(['He', 'He']);
		expect(UPGRADE_CARDS.get('add-li')).toEqual(['Li']);
		expect(UPGRADE_CARDS.get('add-c')).toEqual(['C']);
		expect(UPGRADE_CARDS.get('add-be')).toEqual(['Be']);
		expect(UPGRADE_CARDS.get('add-na')).toEqual(['Na']);
		expect(UPGRADE_CARDS.get('add-o')).toEqual(['O']);
		expect(UPGRADE_CARDS.size).toBe(7);
		expect(UPGRADE_CARDS.get('coolant')).toBeUndefined();
	});
});

describe('generateDraft', () => {
	it('offers three distinct, valid upgrades', () => {
		const draft = generateDraft(createRun(7));

		expect(draft).toHaveLength(3);
		expect(new Set(draft).size).toBe(3);
		for (const id of draft) expect(UPGRADE_BY_ID.has(id)).toBe(true);
	});

	it('derives the draft from rngState, so the same run always sees the same options', () => {
		expect(generateDraft(createRun(7))).toEqual(generateDraft(createRun(7)));

		const drafts = new Set(
			Array.from({ length: 20 }, (_, rngState) =>
				generateDraft({ ...createRun(7), rngState }).join(',')
			)
		);
		expect(drafts.size).toBeGreaterThan(1);
	});

	it('excludes owned modifiers but may offer a card upgrade again', () => {
		const { options } = findDraft(
			(ids) => ids.every((id) => UPGRADE_BY_ID.get(id)?.kind === 'card'),
			MODIFIER_IDS
		);
		for (const id of options) expect(UPGRADE_BY_ID.get(id)?.kind).toBe('card');

		const offered = new Set(
			Array.from({ length: 50 }, (_, rngState) =>
				generateDraft({ ...createRun(7), rngState, upgrades: ['add-h-2'] })
			).flat()
		);
		expect(offered.has('add-h-2')).toBe(true);
	});
});

describe('chooseUpgrade', () => {
	it('applies the offered option and consumes one pending draft at a time', () => {
		const base = { ...createRun(7), pendingDrafts: 2 };
		const options = generateDraft(base);

		const once = chooseUpgrade(base, 1);

		expect(once.pendingDrafts).toBe(1);
		expect(once.upgrades).toEqual([options[1]]);
		expect(hasUpgrade(once, options[1])).toBe(true);

		const twice = chooseUpgrade(once, 0);

		expect(twice.pendingDrafts).toBe(0);
		expect(twice.upgrades).toHaveLength(2);
		expect(twice.upgrades[0]).toBe(options[1]);
	});

	it('advances rngState deterministically when a draft is chosen', () => {
		const base = { ...createRun(7), pendingDrafts: 1 };

		const first = chooseUpgrade(base, 0);
		const twin = chooseUpgrade({ ...createRun(7), pendingDrafts: 1 }, 0);

		expect(twin).toEqual(first);
		expect(first.rngState).not.toBe(base.rngState);
		// Generating options is pure: it never advances the run.
		expect(generateDraft(base)).toEqual(generateDraft(base));
	});

	it('does nothing without a pending draft or with an invalid index', () => {
		const noDraft = { ...createRun(7), pendingDrafts: 0 };
		expect(chooseUpgrade(noDraft, 0)).toBe(noDraft);

		const base = { ...createRun(7), pendingDrafts: 1 };
		expect(chooseUpgrade(base, 3)).toBe(base);
		expect(chooseUpgrade(base, -1)).toBe(base);
		expect(chooseUpgrade(base, 1.5)).toBe(base);
	});

	it('puts drafted cards into the discard pile without touching the hand or deck', () => {
		const { run, options } = findDraft(
			(ids) => ids.every((id) => UPGRADE_BY_ID.get(id)?.kind === 'card'),
			MODIFIER_IDS
		);
		const base = {
			...run,
			discard: ['Li'] as ElementSymbol[],
			deck: ['H', 'He'] as ElementSymbol[]
		};
		const expected = UPGRADE_CARDS.get(options[0]);

		const after = chooseUpgrade(base, 0);

		expect(expected).toBeDefined();
		expect(after.discard).toEqual([...base.discard, ...expected!]);
		expect(after.hand).toEqual(base.hand);
		expect(after.deck).toEqual(base.deck);
	});

	it('adds no cards when a modifier is chosen', () => {
		const { run, options } = findDraft(
			(ids) => ids.includes('coolant'),
			MODIFIER_IDS.filter((id) => id !== 'coolant')
		);

		const after = chooseUpgrade(run, options.indexOf('coolant'));

		expect(after.discard).toEqual(run.discard);
		expect(after.upgrades).toContain('coolant');
		expect(hasUpgrade(after, 'coolant')).toBe(true);
	});
});

describe('pending drafts lock the turn', () => {
	it('blocks placement, stabilize, and scrap until the queued draft is chosen', () => {
		const run = chainRun({ pendingDrafts: 1 });

		expect(placeCard(run, 0, CENTER)).toBe(run);
		expect(stabilize(run, 0)).toBe(run);
		expect(scrap(run, 7)).toBe(run);

		const chosen = chooseUpgrade(run, 0);

		expect(chosen.pendingDrafts).toBe(0);
		expect(placeCard(chosen, 0, CENTER)).not.toBe(chosen);
	});

	it('keeps blocking while a second draft is still pending', () => {
		const run = chainRun({ pendingDrafts: 2 });
		const after = chooseUpgrade(run, 0);

		expect(after.pendingDrafts).toBe(1);
		expect(placeCard(after, 0, CENTER)).toBe(after);
		expect(stabilize(after, 0)).toBe(after);
		expect(scrap(after, 7)).toBe(after);
	});
});

describe('upgrade effects', () => {
	it('coolant makes Stabilize remove 30 instead of 15', () => {
		const base = chainRun({ turn: 10, heat: 70, upgrades: ['coolant'] });

		const cooled = stabilize(base, 0);

		expect(cooled.heat).toBe(70 - 30 + 3);
		expect(stabilize(chainRun({ turn: 10, heat: 70 }), 0).heat).toBe(70 - 15 + 3);
	});

	it('coolant still respects the rising heat floor', () => {
		const base = chainRun({ turn: 10, heat: 35, upgrades: ['coolant'] });

		expect(stabilize(base, 0).heat).toBe(30 + 3);
	});

	it('efficient reduces every fusion by 1 Heat, never below 1', () => {
		const chain = resolvePlacement(
			chainRun({ upgrades: ['efficient'] }),
			0,
			CENTER,
			CHAIN_CHOICES
		)!;

		expect(chain.steps.map((step) => step.heat)).toEqual([1, 3, 4]);
		expect(chain.heatGain).toBe(8);

		const single = resolvePlacement(
			chainRun({ grid: buildGrid([[7, 'H']]), hand: ['H'], upgrades: ['efficient'] }),
			0,
			CENTER
		)!;

		expect(single.steps[0].heat).toBe(1);
	});

	it('chain-reaction adds 50% score to step 3', () => {
		const result = resolvePlacement(
			chainRun({ upgrades: ['chain-reaction'] }),
			0,
			CENTER,
			CHAIN_CHOICES
		)!;

		expect(result.steps.map((step) => step.points)).toEqual([2, 6, 18]);
		expect(result.scoreGain).toBe(26);
	});

	it('salvage allows two Scraps per turn', () => {
		const base = chainRun({ upgrades: ['salvage'] });

		const once = scrap(base, 7);
		expect(once.scrapsUsed).toBe(1);

		const twice = scrap(once, 13);
		expect(twice.scrapsUsed).toBe(2);
		expect(twice.grid[13]).toBeNull();

		expect(scrap(twice, 17)).toBe(twice);
		expect(endTurn(twice).scrapsUsed).toBe(0);
	});

	it('deep-hand draws to a hand of 6', () => {
		const base = chainRun({
			upgrades: ['deep-hand'],
			hand: ['H', 'Li', 'He', 'Be', 'Na'],
			deck: ['C', 'O']
		});

		const after = endTurn(base);

		expect(after.hand).toHaveLength(6);
		expect(after.deck).toEqual(['O']);
	});

	it('heat-sink makes the first fusion of each turn add no Heat', () => {
		const base = chainRun({ upgrades: ['heat-sink'] });

		const preview = previewPlacement(base, 0, CENTER, CHAIN_CHOICES)!;
		expect(preview.steps.map((step) => step.heat)).toEqual([0, 4, 5]);
		expect(preview.heatGain).toBe(9);

		const spent = resolvePlacement({ ...base, heatSinkUsed: true }, 0, CENTER, CHAIN_CHOICES)!;
		expect(spent.heatGain).toBe(11);

		const after = placeCard(base, 0, CENTER, CHAIN_CHOICES);
		expect(after.heat).toBe(preview.heatAfterTurn);
		// The next turn starts with a fresh Heat Sink.
		expect(after.heatSinkUsed).toBe(false);
	});

	it('heat-sink keeps its flag on a lethal placement that does not end the turn', () => {
		const base = chainRun({ upgrades: ['heat-sink'], heat: 95 });

		const after = placeCard(base, 0, CENTER, CHAIN_CHOICES);

		expect(after.status).toBe('overload');
		expect(after.heat).toBe(100);
		expect(after.heatSinkUsed).toBe(true);
	});

	it('rarity-bonus adds 25% to valence-4 results', () => {
		const chain = resolvePlacement(
			chainRun({ upgrades: ['rarity-bonus'] }),
			0,
			CENTER,
			CHAIN_CHOICES
		)!;

		// Only the final Ne (valence 4) is boosted: 12 -> 15.
		expect(chain.steps.map((step) => step.points)).toEqual([2, 6, 15]);
		expect(chain.scoreGain).toBe(23);

		const single = resolvePlacement(
			chainRun({ grid: buildGrid([[7, 'H']]), hand: ['C'], upgrades: ['rarity-bonus'] }),
			0,
			CENTER
		)!;
		expect(single.steps[0].points).toBe(5);
	});

	it('combines score modifiers with a single rounding step', () => {
		const result = resolvePlacement(
			chainRun({ upgrades: ['chain-reaction', 'rarity-bonus'] }),
			0,
			CENTER,
			CHAIN_CHOICES
		)!;

		// 12 * 1.5 * 1.25 = 22.5 -> 23.
		expect(result.steps.map((step) => step.points)).toEqual([2, 6, 23]);
		expect(result.scoreGain).toBe(31);
	});

	it('echo makes the first Stabilize of a run draw normally', () => {
		const base = chainRun({ turn: 5, heat: 30, upgrades: ['echo'], deck: ['O'] });

		const first = stabilize(base, 0);

		expect(first.discard).toEqual(['H']);
		expect(first.hand).toEqual(['Li', 'He', 'Be', 'Na', 'O']);
		expect(first.echoUsed).toBe(true);

		const second = stabilize(first, 0);

		expect(second.hand).toHaveLength(4);
		expect(second.echoUsed).toBe(true);
	});
});

describe('preview and commit with upgrades', () => {
	it('commits exactly the previewed grid, score, and heat', () => {
		const base = chainRun({
			upgrades: ['efficient', 'chain-reaction', 'rarity-bonus'],
			heat: 40
		});
		const preview = previewPlacement(base, 0, CENTER, CHAIN_CHOICES)!;

		const after = placeCard(base, 0, CENTER, CHAIN_CHOICES);

		expect(after.grid).toEqual(preview.grid);
		expect(after.score - base.score).toBe(preview.scoreGain);
		expect(after.heat).toBe(preview.heatAfterTurn);
	});
});
