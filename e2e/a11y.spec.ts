import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { gridWith, seed, seedRun } from './fixtures';

/**
 * Axe reads a mid-transition opacity as a contrast failure. These audits run
 * with reduced motion so Svelte enters instantly, then wait a frame for the
 * browser to paint the committed state.
 */
test.beforeEach(async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
});

async function axeIsClean(page: Page): Promise<void> {
	await page.waitForTimeout(250);
	const results = await new AxeBuilder({ page }).analyze();
	expect(results.violations.map((violation) => violation.id)).toEqual([]);
}

async function smallTargets(page: Page): Promise<string[]> {
	return page.evaluate(() =>
		[...document.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]')]
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
}

test('title and how-to have no axe violations', async ({ page }) => {
	await seed(page);
	await page.goto('/');
	await expect(page.getByRole('heading', { name: /critical mass/i })).toBeVisible();
	await axeIsClean(page);

	await page.getByRole('button', { name: /how to play/i }).click();
	await expect(page.getByRole('heading', { name: /how to play/i })).toBeVisible();
	await axeIsClean(page);
});

test('run screen has no axe violations', async ({ page }) => {
	await seedRun(page, { grid: gridWith({ 6: 'N', 12: 'He' }), heat: 18, turn: 5 });
	await page.goto('/');
	await page.getByRole('button', { name: /continue run/i }).click();
	await expect(page.getByText(/TURN 5/)).toBeVisible();
	await axeIsClean(page);
});

test('upgrade draft has no axe violations', async ({ page }) => {
	await seedRun(page, {
		heat: 24,
		turn: 7,
		milestonesCrossed: 1,
		pendingDrafts: 1
	});
	await page.goto('/');
	await page.getByRole('button', { name: /continue run/i }).click();
	await expect(page.getByRole('dialog', { name: /upgrade draft/i })).toBeVisible();
	await axeIsClean(page);
});

test('end screen has no axe violations', async ({ page }) => {
	await seedRun(page, {
		grid: gridWith({ 6: 'N' }),
		heat: 94,
		turn: 21,
		score: 64,
		milestonesCrossed: 3
	});
	await page.goto('/');
	await page.getByRole('button', { name: /continue run/i }).click();

	await page.getByRole('button', { name: /card 1, H Hydrogen/i }).click();
	await page.getByRole('button', { name: /cell 7, empty/i }).click();
	await page
		.getByRole('dialog', { name: /placement preview/i })
		.getByRole('button', { name: /^confirm$/i })
		.click();

	await expect(page.getByRole('dialog', { name: /run over/i })).toBeVisible();
	await axeIsClean(page);
});

test('every visible target on the title is at least 44px', async ({ page }) => {
	await seed(page);
	await page.goto('/');
	await expect(page.getByRole('button', { name: /continue run/i })).toBeVisible();
	expect(await smallTargets(page)).toEqual([]);
});

test('every visible target on the run and the draft is at least 44px', async ({ page }) => {
	await seedRun(page, {
		grid: gridWith({ 6: 'N', 12: 'He' }),
		heat: 24,
		turn: 7,
		milestonesCrossed: 1,
		pendingDrafts: 1
	});
	await page.goto('/');
	await page.getByRole('button', { name: /continue run/i }).click();

	// The run screen is mounted behind the draft; both layers must pass.
	await expect(page.getByRole('dialog', { name: /upgrade draft/i })).toBeVisible();
	expect(await smallTargets(page)).toEqual([]);
});

test('every visible target on the end screen is at least 44px', async ({ page }) => {
	await seedRun(page, {
		grid: gridWith({ 6: 'N' }),
		heat: 94,
		turn: 21,
		score: 64,
		milestonesCrossed: 3
	});
	await page.goto('/');
	await page.getByRole('button', { name: /continue run/i }).click();

	await page.getByRole('button', { name: /card 1, H Hydrogen/i }).click();
	await page.getByRole('button', { name: /cell 7, empty/i }).click();
	await page
		.getByRole('dialog', { name: /placement preview/i })
		.getByRole('button', { name: /^confirm$/i })
		.click();

	await expect(page.getByRole('dialog', { name: /run over/i })).toBeVisible();
	expect(await smallTargets(page)).toEqual([]);
});
