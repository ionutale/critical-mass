import { expect, test } from '@playwright/test';

const SAVE_KEY = 'critical-mass:save:v1';

function emptyGrid(): (string | null)[] {
	return Array<string | null>(25).fill(null);
}

function runFixture(overrides: Record<string, unknown> = {}) {
	return {
		seed: 42,
		rngState: 7,
		grid: emptyGrid(),
		deck: [],
		hand: ['H', 'H', 'H', 'H', 'H'],
		discard: [],
		pressure: 0,
		pressureCap: 100,
		sectorFloor: 0,
		sector: 1,
		contractId: 's1-1a',
		delivered: 0,
		contractsCompleted: 0,
		turn: 1,
		scrapsUsed: 0,
		pendingDiscards: 0,
		modules: [],
		hasCatalyst: false,
		ventsThisContract: 0,
		maxChain: 0,
		deliveredTargets: [],
		pendingDraft: null,
		pendingDraftKind: null,
		pendingTransition: false,
		patches: [],
		researchEarned: 0,
		contractMaxChain: 0,
		contractReduction: 0,
		meltdownSaves: 0,
		sectorShield: 0,
		status: 'active',
		...overrides
	};
}

async function seed(
	page: import('@playwright/test').Page,
	overrides: Record<string, unknown> = {}
) {
	await page.addInitScript(
		([key, save]) => {
			if (!localStorage.getItem(key)) localStorage.setItem(key, save);
		},
		[
			SAVE_KEY,
			JSON.stringify({
				version: 1,
				run: runFixture(overrides),
				meta: {
					research: 0,
					unlocks: [],
					stats: { runs: 0, wins: 0, bestSector: 1, contracts: 0 }
				},
				settings: { sound: false, reduceMotion: true },
				introSeen: true
			})
		]
	);
}

test('cold-start fusion persists after reload', async ({ page }) => {
	const grid = emptyGrid();
	grid[12] = 'H';
	await seed(page, { grid, hand: ['H', 'H', 'H', 'H', 'H'] });
	await page.goto('/');
	await page.getByRole('button', { name: /continue run/i }).click();

	await page.getByRole('button', { name: /hydrogen card 1/i }).click();
	await page.getByRole('button', { name: /cell 13/i }).click();
	await page.getByRole('button', { name: /^confirm$/i }).click();

	await expect(page.getByRole('button', { name: /cell 13/i })).toContainText('He');

	await page.reload();
	await page.getByRole('button', { name: /continue run/i }).click();
	await expect(page.getByRole('button', { name: /cell 13/i })).toContainText('He');
});

test('a mid-run reload keeps pressure, contract, and hand', async ({ page }) => {
	await seed(page, {
		pressure: 42,
		delivered: 0,
		hand: ['H', 'H', 'H'],
		deck: ['H', 'H']
	});
	await page.goto('/');
	await page.getByRole('button', { name: /continue run/i }).click();

	const before = await page.evaluate(
		(key) => JSON.parse(localStorage.getItem(key) ?? '{}').run,
		SAVE_KEY
	);
	await page.reload();
	await page.getByRole('button', { name: /continue run/i }).click();

	const after = await page.evaluate(
		(key) => JSON.parse(localStorage.getItem(key) ?? '{}').run,
		SAVE_KEY
	);
	expect(after.pressure).toBe(before.pressure);
	expect(after.contractId).toBe(before.contractId);
	expect(after.hand).toEqual(before.hand);
});

test('venting lowers pressure and discards one card', async ({ page }) => {
	await seed(page, { pressure: 60, hand: ['H', 'H', 'H', 'H'] });
	await page.goto('/');
	await page.getByRole('button', { name: /continue run/i }).click();

	await page.getByRole('button', { name: /^vent/i }).click();
	await expect(page.getByRole('dialog')).toBeVisible();
	await page.getByRole('dialog').getByRole('button').first().click();

	await expect(page.getByRole('dialog')).toHaveCount(0);
	const after = await page.evaluate(
		(key) => JSON.parse(localStorage.getItem(key) ?? '{}').run,
		SAVE_KEY
	);
	expect(after.pressure).toBeLessThan(60);
});

test('a finished victory save is reported and can be replaced', async ({ page }) => {
	await seed(page, { status: 'victory', sector: 3, contractsCompleted: 15 });
	await page.goto('/');

	await expect(page.getByText(/ended in victory/i)).toBeVisible();
	await page.getByRole('button', { name: /new run/i }).click();
	await expect(page.getByRole('heading', { name: /critical mass/i })).toBeVisible();
});
