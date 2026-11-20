import { describe, expect, it } from 'vitest';
import { CONTRACTS } from './contracts';
import { LEGACY_ELEMENTS } from './elements.legacy';
import { MODULE_BY_ID, MODULES } from './modules';
import { PATCHES } from './patches';
import { RECIPES } from './recipes';
import { UNLOCKS } from './unlocks';
import { validateContent } from '../game/validate';

const PRE_EXPANSION_CONTRACT_IDS = [
	's1-1a',
	's1-1b',
	's1-2a',
	's1-2b',
	's1-3a',
	's1-3b',
	's1-4a',
	's1-4b',
	's1-5a',
	's1-5b',
	's2-1a',
	's2-1b',
	's2-2a',
	's2-2b',
	's2-3a',
	's2-3b',
	's2-4a',
	's2-4b',
	's2-5a',
	's2-5b',
	's3-1a',
	's3-1b',
	's3-2a',
	's3-2b',
	's3-3a',
	's3-3b',
	's3-4a',
	's3-4b',
	's3-5a',
	's3-5b'
];

const PRE_EXPANSION_MODULE_IDS = [
	'coolant-loop',
	'reinforced-vessel',
	'damping-field',
	'cargo-rack',
	'auxiliary-feed',
	'helium-reserve',
	'echo-buffer',
	'catalyst-injector',
	'neutron-flux',
	'thermal-buffer',
	'assembly-line',
	'contract-rider',
	'draft-expander',
	'emergency-vent',
	'blast-shield',
	'reroll-relay',
	'deep-coolant',
	'second-vessel',
	'phase-damper',
	'long-rack',
	'twin-feed',
	'helium-cache',
	'copy-buffer',
	'heavy-seed'
];

const PRE_EXPANSION_UNLOCK_IDS = [
	'card-carbon',
	'card-oxygen',
	'card-neon',
	'card-magnesium',
	'module-deep-coolant',
	'module-second-vessel',
	'module-long-rack',
	'module-heavy-seed',
	'contract-reroll',
	'contract-rider',
	'contract-assembly',
	'contract-expander'
];

const PRE_EXPANSION_PATCH_IDS = [
	'patch-coolant',
	'patch-vessel',
	'patch-rack',
	'patch-feed',
	'patch-shield',
	'patch-line'
];

const PRE_EXPANSION_ELEMENTS = [
	'H',
	'He',
	'Be',
	'C',
	'N',
	'O',
	'Ne',
	'Mg',
	'Si',
	'S',
	'Ar',
	'Ca',
	'Ti',
	'Cr',
	'Fe',
	'Co',
	'Ni',
	'Cu',
	'Zn',
	'Ag',
	'Au',
	'Hg',
	'Pb',
	'U'
];

const BOSS_TARGET: Record<1 | 2 | 3, string> = { 1: 'Mg', 2: 'Fe', 3: 'U' };

const elementBySymbol = new Map(LEGACY_ELEMENTS.map((element) => [element.symbol, element]));

function reachable(allowCatalyst: boolean): Set<string> {
	const known = new Set(elementBySymbol.keys());
	const reached = new Set<string>(known.has('H') ? ['H'] : []);
	let changed = true;

	while (changed) {
		changed = false;
		for (const recipe of RECIPES) {
			if (recipe.catalyst && !allowCatalyst) continue;
			if (
				reached.has(recipe.a) &&
				reached.has(recipe.b) &&
				known.has(recipe.result) &&
				!reached.has(recipe.result)
			) {
				reached.add(recipe.result);
				changed = true;
			}
		}
	}

	return reached;
}

describe('content', () => {
	it('has forty-five contracts, three variants per sector slot', () => {
		expect(CONTRACTS).toHaveLength(45);
		for (const sector of [1, 2, 3] as const) {
			expect(CONTRACTS.filter((contract) => contract.sector === sector)).toHaveLength(15);
			for (const slot of [1, 2, 3, 4, 5] as const) {
				expect(
					CONTRACTS.filter((contract) => contract.sector === sector && contract.slot === slot)
				).toHaveLength(3);
			}
		}
	});

	it('has a full module, patch, and unlock pool', () => {
		expect(MODULES).toHaveLength(30);
		expect(new Set(MODULES.map((module) => module.id)).size).toBe(30);
		expect(PATCHES).toHaveLength(8);
		expect(new Set(PATCHES.map((patch) => patch.id)).size).toBe(8);
		expect(UNLOCKS).toHaveLength(16);
		expect(new Set(UNLOCKS.map((unlock) => unlock.id)).size).toBe(16);
	});

	it('has thirty unique elements and a reachable ladder', () => {
		expect(LEGACY_ELEMENTS).toHaveLength(30);
		expect(new Set(LEGACY_ELEMENTS.map((element) => element.symbol)).size).toBe(30);
		expect(new Set(LEGACY_ELEMENTS.map((element) => element.number)).size).toBe(30);

		const withoutCatalyst = reachable(false);
		const withCatalyst = reachable(true);
		for (const element of LEGACY_ELEMENTS) {
			if (element.heavy) {
				expect(withCatalyst.has(element.symbol), `${element.symbol} is unreachable`).toBe(true);
			} else {
				expect(withoutCatalyst.has(element.symbol), `${element.symbol} needs no catalyst`).toBe(
					true
				);
			}
		}
	});

	it('keeps every recipe on a heavier element', () => {
		for (const recipe of RECIPES) {
			const a = elementBySymbol.get(recipe.a);
			const b = elementBySymbol.get(recipe.b);
			const result = elementBySymbol.get(recipe.result);
			const label = `${recipe.a}+${recipe.b}->${recipe.result}`;

			expect(a, label).toBeDefined();
			expect(b, label).toBeDefined();
			expect(result, label).toBeDefined();
			expect(result!.number, label).toBeGreaterThan(a!.number);
			expect(result!.number, label).toBeGreaterThan(b!.number);
		}
	});

	it('respects sector tier limits and boss targets', () => {
		for (const contract of CONTRACTS) {
			const target = elementBySymbol.get(contract.target);

			expect(target, contract.id).toBeDefined();
			expect(contract.count, contract.id).toBeGreaterThanOrEqual(1);
			expect(contract.count, contract.id).toBeLessThanOrEqual(3);

			if (contract.sector === 1) {
				expect(target!.heavy, contract.id).toBe(false);
				expect(target!.tier, contract.id).toBeLessThanOrEqual(7);
			}
			if (contract.sector === 2) {
				expect(target!.heavy, contract.id).toBe(false);
				expect(target!.tier, contract.id).toBeLessThanOrEqual(14);
			}
			if (contract.sector === 3) {
				expect(target!.heavy, contract.id).toBe(true);
			}
			if (contract.slot === 5) {
				expect(contract.target, contract.id).toBe(BOSS_TARGET[contract.sector]);
			}
		}
	});

	it('keeps every unlock cost in range and pointed at a real pool item', () => {
		for (const unlock of UNLOCKS) {
			expect(Number.isInteger(unlock.cost), unlock.id).toBe(true);
			expect(unlock.cost, unlock.id).toBeGreaterThanOrEqual(3);
			expect(unlock.cost, unlock.id).toBeLessThanOrEqual(12);

			if (unlock.kind === 'card') {
				expect(elementBySymbol.has(unlock.ref), unlock.id).toBe(true);
			} else {
				expect(MODULE_BY_ID.has(unlock.ref), unlock.id).toBe(true);
			}
		}
	});

	it('keeps every pre-expansion id unchanged', () => {
		const contractIds = new Set(CONTRACTS.map((contract) => contract.id));
		const moduleIds = new Set(MODULES.map((module) => module.id));
		const unlockIds = new Set(UNLOCKS.map((unlock) => unlock.id));
		const patchIds = new Set(PATCHES.map((patch) => patch.id));
		const symbols = new Set(LEGACY_ELEMENTS.map((element) => element.symbol));

		for (const id of PRE_EXPANSION_CONTRACT_IDS) expect(contractIds.has(id), id).toBe(true);
		for (const id of PRE_EXPANSION_MODULE_IDS) expect(moduleIds.has(id), id).toBe(true);
		for (const id of PRE_EXPANSION_UNLOCK_IDS) expect(unlockIds.has(id), id).toBe(true);
		for (const id of PRE_EXPANSION_PATCH_IDS) expect(patchIds.has(id), id).toBe(true);
		for (const symbol of PRE_EXPANSION_ELEMENTS) expect(symbols.has(symbol), symbol).toBe(true);
	});

	it('validates the whole contract ladder', () => {
		expect(
			validateContent({
				elements: LEGACY_ELEMENTS,
				recipes: RECIPES,
				contracts: CONTRACTS,
				modules: MODULES,
				unlocks: UNLOCKS
			})
		).toEqual({
			ok: true,
			errors: []
		});
	});

	it('keeps the first contract as the teaching contract', () => {
		const first = CONTRACTS.find((contract) => contract.id === 's1-1a')!;
		expect(first.target).toBe('He');
		expect(first.count).toBe(1);
		expect(first.sector).toBe(1);
		expect(first.slot).toBe(1);
	});
});
