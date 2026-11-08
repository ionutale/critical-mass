import { describe, expect, it } from 'vitest';
import { CONTRACTS } from './contracts';
import { ELEMENTS } from './elements';
import { MODULES } from './modules';
import { PATCHES } from './patches';
import { RECIPES } from './recipes';
import { UNLOCKS } from './unlocks';
import { validateContent } from '../game/validate';

describe('content', () => {
	it('has thirty contracts, two variants per sector slot', () => {
		expect(CONTRACTS).toHaveLength(30);
		for (const sector of [1, 2, 3] as const) {
			expect(CONTRACTS.filter((contract) => contract.sector === sector)).toHaveLength(10);
			for (const slot of [1, 2, 3, 4, 5] as const) {
				expect(
					CONTRACTS.filter((contract) => contract.sector === sector && contract.slot === slot)
				).toHaveLength(2);
			}
		}
	});

	it('has a full module, patch, and unlock pool', () => {
		expect(MODULES).toHaveLength(24);
		expect(new Set(MODULES.map((module) => module.id)).size).toBe(24);
		expect(PATCHES).toHaveLength(6);
		expect(UNLOCKS).toHaveLength(12);
		expect(new Set(UNLOCKS.map((unlock) => unlock.id)).size).toBe(12);
	});

	it('validates the whole contract ladder', () => {
		expect(
			validateContent({
				elements: ELEMENTS,
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
