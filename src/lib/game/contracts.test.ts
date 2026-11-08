import { describe, expect, it } from 'vitest';
import { emptyGrid, runFixture } from '../test/fixtures';
import { activeContract, chooseDraft, deliver, generateDraft, nextSector } from './contracts';

describe('contract ladder', () => {
	it('delivers only the matching tile and opens exactly one draft at the count', () => {
		const grid = emptyGrid();
		grid[0] = 'He';
		grid[1] = 'H';
		const run = runFixture({ grid });

		expect(deliver(run, 1)).toBe(run);

		const completed = deliver(run, 0);
		expect(completed.grid[0]).toBeNull();
		expect(completed.delivered).toBe(1);
		expect(completed.pendingDraftKind).toBe('contract');
		expect(completed.pendingDraft).toHaveLength(3);
		expect(deliver(completed, 0)).toBe(completed);
	});

	it('builds a mandatory draft of unique options and resumes after a pick', () => {
		const grid = emptyGrid();
		grid[0] = 'He';
		const completed = deliver(runFixture({ grid }), 0);

		const keys = new Set(
			completed.pendingDraft!.map((option) =>
				option.kind === 'cards'
					? `cards:${option.element}`
					: option.kind === 'module'
						? `module:${option.moduleId}`
						: `patch:${option.patchId}`
			)
		);
		expect(keys.size).toBe(3);

		expect(chooseDraft(completed, 99)).toBe(completed);

		const chosen = chooseDraft(completed, 0);
		expect(chosen.pendingDraft).toBeNull();
		expect(chosen.contractsCompleted).toBe(1);
		expect(chosen.contractId).not.toBe('s1-1a');
		expect(activeContract(chosen).slot).toBe(2);
		expect(chosen.discard.length).toBe(completed.discard.length + 2);

		const moduleRun = chooseDraft(completed, 1);
		expect(moduleRun.modules).toHaveLength(1);

		const patchRun = chooseDraft(completed, 2);
		expect(patchRun.patches).toHaveLength(1);
	});

	it('awards research once per contract and adds the modifier bonus', () => {
		const grid = emptyGrid();
		grid[0] = 'N';
		const run = runFixture({
			grid,
			contractId: 's1-3a',
			delivered: 1,
			ventsThisContract: 0
		});
		const completed = deliver(run, 0);

		expect(completed.delivered).toBe(2);
		expect(completed.researchEarned).toBe(2);
		expect(chooseDraft(completed, 0).researchEarned).toBe(2);
	});

	it('never lets a modifier gate delivery', () => {
		const grid = emptyGrid();
		grid[0] = 'N';
		const run = runFixture({
			grid,
			contractId: 's1-3a',
			delivered: 1,
			ventsThisContract: 3
		});
		const completed = deliver(run, 0);

		expect(completed.pendingDraft).not.toBeNull();
		expect(completed.researchEarned).toBe(1);
	});

	it('clears the boss, vents to the next floor, and opens a free module draft', () => {
		const grid = emptyGrid();
		grid[0] = 'Mg';
		const run = runFixture({
			grid,
			contractId: 's1-5a',
			pressure: 10
		});
		const completed = deliver(run, 0);
		expect(completed.researchEarned).toBe(4);

		const afterDraft = chooseDraft(completed, 0);
		expect(afterDraft.pendingTransition).toBe(true);
		expect(afterDraft.contractsCompleted).toBe(1);

		const sector2 = nextSector(afterDraft);
		expect(sector2.sector).toBe(2);
		expect(sector2.pressure).toBe(20);
		expect(sector2.sectorFloor).toBe(20);
		expect(sector2.pendingDraftKind).toBe('sector');
		expect(sector2.pendingDraft).toHaveLength(3);
		expect(sector2.pendingDraft!.every((option) => option.kind === 'module')).toBe(true);
	});

	it('auto-grants Catalyst on entering sector 3', () => {
		const run = runFixture({
			sector: 2,
			pendingTransition: true,
			pressure: 50,
			hasCatalyst: false
		});
		const sector3 = nextSector(run);

		expect(sector3.sector).toBe(3);
		expect(sector3.hasCatalyst).toBe(true);
		expect(sector3.pressure).toBe(40);
		expect(sector3.sectorFloor).toBe(40);
	});

	it('wins after the sector 3 boss draft', () => {
		const grid = emptyGrid();
		grid[0] = 'U';
		const run = runFixture({
			grid,
			sector: 3,
			contractId: 's3-5a',
			hasCatalyst: true,
			pressure: 50
		});
		const completed = deliver(run, 0);
		expect(completed.researchEarned).toBe(4);

		const victory = chooseDraft(completed, 0);
		expect(victory.status).toBe('victory');
		expect(victory.researchEarned).toBe(4);
	});

	it('generates deterministic, sector-valid drafts', () => {
		const run = runFixture();
		const first = generateDraft(run);
		const second = generateDraft(run);

		expect(first).toEqual(second);
		expect(first.options).toHaveLength(3);
		for (const option of first.options) {
			if (option.kind === 'cards') {
				expect(option.element).not.toBe('U');
			}
		}
	});
});
