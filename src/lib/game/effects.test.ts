import { describe, expect, it } from 'vitest';
import { contractsForSlot } from '../data/contracts';
import { runFixture } from '../test/fixtures';
import { applyEffect } from './effects';

function variants(sector: 1 | 2 | 3, slot: 1 | 2 | 3 | 4 | 5): string[] {
	return contractsForSlot(sector, slot).map((contract) => contract.id);
}

describe('reroll effect', () => {
	it('never keeps the current contract and reaches every other variant', () => {
		const contractId = 's1-1a';
		const others = variants(1, 1).filter((id) => id !== contractId);
		expect(others).toHaveLength(2);

		const seen = new Set<string>();
		for (let rngState = 1; rngState <= 64; rngState += 1) {
			const run = applyEffect(runFixture({ contractId, rngState }), 'reroll');

			expect(run.contractId).not.toBe(contractId);
			expect(others).toContain(run.contractId);
			expect(run.rngState).not.toBe(rngState);
			seen.add(run.contractId);
		}

		// The old first-match implementation could only ever reach s1-1b.
		expect(seen).toEqual(new Set(others));
	});

	it('is deterministic for a given rng state', () => {
		const run = runFixture({ contractId: 's2-3b', rngState: 1234 });

		expect(applyEffect(run, 'reroll')).toEqual(applyEffect(run, 'reroll'));
	});

	it('rerolls away from a c variant', () => {
		const run = runFixture({ contractId: 's3-2c', rngState: 9 });
		const after = applyEffect(run, 'reroll');

		expect(after.contractId).not.toBe('s3-2c');
		expect(variants(3, 2)).toContain(after.contractId);
	});
});
