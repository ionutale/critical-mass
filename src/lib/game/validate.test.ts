import { describe, expect, it } from 'vitest';
import { CONTRACTS } from '../data/contracts';
import { ELEMENTS } from '../data/elements';
import { MODULES } from '../data/modules';
import { RECIPES } from '../data/recipes';
import { UNLOCKS } from '../data/unlocks';
import { validateContent } from './validate';

describe('validateContent', () => {
	it('accepts the 24-element ladder and its contract', () => {
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

	it('rejects an unlock that references an unknown pool item', () => {
		const broken = [
			...UNLOCKS.slice(0, 11),
			{ ...UNLOCKS[11], id: 'bad', ref: 'not-a-real-module' }
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
