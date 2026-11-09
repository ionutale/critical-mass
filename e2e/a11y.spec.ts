import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import type { SaveState } from '../src/lib/types';

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

function saveFixture(overrides: Record<string, unknown> = {}): SaveState {
	return {
		version: 1,
		run: runFixture(),
		meta: {
			research: 0,
			unlocks: [],
			stats: { runs: 0, wins: 0, bestSector: 1, contracts: 0 }
		},
		settings: { sound: false, reduceMotion: true },
		introSeen: true,
		...overrides
	} as SaveState;
}

async function seed(page: Page, overrides: Record<string, unknown> = {}) {
	await page.addInitScript(
		([key, save]) => localStorage.setItem(key, save),
		[SAVE_KEY, JSON.stringify(saveFixture(overrides))]
	);
}

async function axeIsClean(page: Page) {
	const results = await new AxeBuilder({ page }).analyze();
	expect(results.violations.map((violation) => violation.id)).toEqual([]);
}

test('title and how-to have no axe violations', async ({ page }) => {
	await seed(page);
	await page.goto('/');
	await axeIsClean(page);

	await page.getByRole('button', { name: /how to play/i }).click();
	await expect(page.getByRole('heading', { name: /how to play/i })).toBeVisible();
	await axeIsClean(page);
});

test('run screen has no axe violations', async ({ page }) => {
	await seed(page);
	await page.goto('/');
	await page.getByRole('button', { name: /continue run/i }).click();

	await expect(page.getByRole('heading', { name: /critical mass/i })).toBeVisible();
	await axeIsClean(page);
});

test('draft overlay has no axe violations', async ({ page }) => {
	await seed(page, {
		run: runFixture({
			pendingDraft: [
				{ kind: 'cards', element: 'H', count: 2 },
				{ kind: 'module', moduleId: 'coolant-loop' },
				{ kind: 'patch', patchId: 'patch-coolant' }
			],
			pendingDraftKind: 'contract'
		})
	});
	await page.goto('/');
	await page.getByRole('button', { name: /continue run/i }).click();

	await expect(page.getByRole('dialog')).toBeVisible();
	await axeIsClean(page);
});

test('research and settings have no axe violations', async ({ page }) => {
	await seed(page);
	await page.goto('/');

	await page.getByRole('button', { name: /research lab/i }).click();
	await expect(page.getByRole('heading', { name: /research lab/i })).toBeVisible();
	await axeIsClean(page);

	await page.getByRole('button', { name: /back/i }).click();
	await page.getByRole('button', { name: /^settings$/i }).click();
	await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();
	await axeIsClean(page);
});

async function tabTo(page: Page, pattern: RegExp): Promise<void> {
	for (let step = 0; step < 120; step += 1) {
		await page.keyboard.press('Tab');
		const active = await page.evaluate(() => {
			const element = document.activeElement as HTMLElement | null;
			if (!element || element === document.body) return null;
			return {
				tag: element.tagName,
				label: element.getAttribute('aria-label') ?? element.textContent ?? ''
			};
		});
		if (active && (active.tag === 'BUTTON' || active.tag === 'A') && pattern.test(active.label))
			return;
	}
	throw new Error(`Could not reach ${pattern} by tabbing`);
}

test('fuses and delivers a contract with the keyboard', async ({ page }) => {
	const grid = emptyGrid();
	grid[12] = 'H';
	await seed(page, { run: runFixture({ grid, hand: ['H', 'H', 'H', 'H', 'H'] }) });
	await page.goto('/');

	await tabTo(page, /continue run/i);
	await page.keyboard.press('Enter');

	await tabTo(page, /hydrogen card 1/i);
	await page.keyboard.press('Enter');

	await tabTo(page, /cell 13/i);
	await page.keyboard.press('Enter');

	await expect(page.getByRole('dialog', { name: /preview/i })).toBeVisible();
	await tabTo(page, /^confirm$/i);
	await page.keyboard.press('Enter');

	const deliver = page.getByRole('button', { name: /deliver helium/i });
	await expect(deliver).toBeEnabled();
	await deliver.focus();
	await page.keyboard.press('Enter');

	await expect(page.locator('.complete')).toBeVisible();
});

test('picks a draft option with the keyboard', async ({ page }) => {
	await seed(page, {
		run: runFixture({
			pendingDraft: [
				{ kind: 'cards', element: 'H', count: 2 },
				{ kind: 'module', moduleId: 'coolant-loop' },
				{ kind: 'patch', patchId: 'patch-coolant' }
			],
			pendingDraftKind: 'contract'
		})
	});
	await page.goto('/');

	await tabTo(page, /continue run/i);
	await page.keyboard.press('Enter');

	await expect(page.getByRole('dialog')).toBeVisible();
	await expect(page.getByRole('button', { name: /hydrogen × 2/i })).toBeFocused();
	await page.keyboard.press('Enter');

	await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('every visible target is at least 44px', async ({ page }) => {
	await seed(page);
	await page.goto('/');
	await page.getByRole('button', { name: /continue run/i }).click();

	const small = await page.evaluate(() =>
		[...document.querySelectorAll('button:not([disabled]), a[href]')]
			.filter((element) => {
				const rect = element.getBoundingClientRect();
				const style = getComputedStyle(element);
				return (
					rect.width > 0 &&
					rect.height > 0 &&
					style.visibility !== 'hidden' &&
					(rect.width < 44 || rect.height < 44)
				);
			})
			.map((element) => element.textContent?.trim().slice(0, 24) ?? '')
	);

	expect(small).toEqual([]);
});
