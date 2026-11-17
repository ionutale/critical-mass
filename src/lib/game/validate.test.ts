import { describe, expect, it } from 'vitest';
import { CONTRACTS } from '../data/contracts';
import { ELEMENTS } from '../data/elements';
import { MODULES } from '../data/modules';
import { RECIPES } from '../data/recipes';
import { UNLOCKS } from '../data/unlocks';
import { validateContent } from './validate';

describe('validateContent', () => {
	it('accepts the expanded element ladder and its contracts', () => {
		expect(validateContent({ elements: ELEMENTS, recipes: RECIPES, contracts: CONTRACTS })).toEqual(
			{
				ok: true,
				errors: []
			}
		);
	});

	it('validates the full module and unlock pools', () => {
		expect(
			validateContent({
				elements: ELEMENTS,
				recipes: RECIPES,
				contracts: CONTRACTS,
				modules: MODULES,
				unlocks: UNLOCKS
			})
		).toEqual({ ok: true, errors: [] });
	});

	it('requires three variants for every sector slot', () => {
		const broken = CONTRACTS.filter((contract) => contract.id !== 's1-1c');
		const result = validateContent({ elements: ELEMENTS, recipes: RECIPES, contracts: broken });

		expect(result.ok).toBe(false);
		expect(result.errors).toContain('Sector 1 slot 1 has 2 variants instead of 3.');
		expect(result.errors).toContain('Sector 1 has 14 contracts instead of 15.');
	});

	it('counts modules and unlocks against the expanded pool sizes', () => {
		const shortModules = validateContent({
			elements: ELEMENTS,
			recipes: RECIPES,
			contracts: CONTRACTS,
			modules: MODULES.slice(0, 29),
			unlocks: UNLOCKS
		});
		expect(shortModules.errors).toContain('Expected 30 modules, found 29.');

		const shortUnlocks = validateContent({
			elements: ELEMENTS,
			recipes: RECIPES,
			contracts: CONTRACTS,
			modules: MODULES,
			unlocks: UNLOCKS.slice(0, 15)
		});
		expect(shortUnlocks.errors).toContain('Expected 16 unlocks, found 15.');
	});

	it('rejects an unlock that references an unknown pool item', () => {
		const broken = [
			...UNLOCKS.slice(0, 15),
			{ ...UNLOCKS[15], id: 'bad', ref: 'not-a-real-module' }
		];
		const result = validateContent({
			elements: ELEMENTS,
			recipes: RECIPES,
			contracts: CONTRACTS,
			modules: MODULES,
			unlocks: broken
		});
		expect(result.ok).toBe(false);
	});

	it('rejects a recipe that does not produce a heavier element', () => {
		const broken = [{ a: 'H', b: 'H', result: 'H', catalyst: false }];
		const result = validateContent({ elements: ELEMENTS, recipes: broken, contracts: [] });
		expect(result.ok).toBe(false);
	});

	it('rejects an unreachable non-heavy element', () => {
		const isolated = [...ELEMENTS, { ...ELEMENTS[3], symbol: 'Xx', number: 119, tier: 25 }];
		const result = validateContent({
			elements: isolated,
			recipes: RECIPES,
			contracts: []
		});
		expect(result.ok).toBe(false);
	});
});
