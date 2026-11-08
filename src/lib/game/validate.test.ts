import { describe, expect, it } from 'vitest';
import { CONTRACTS } from '../data/contracts';
import { ELEMENTS } from '../data/elements';
import { RECIPES } from '../data/recipes';
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
