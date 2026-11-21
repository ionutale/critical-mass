import { expect, test } from '@playwright/test';
import { SAVE_KEY } from './fixtures';

test('cold start shows the title and auto-creates a seed-42 run', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByRole('heading', { name: /critical mass/i, level: 1 })).toBeVisible();
	await expect(page.getByTestId('title-seed')).toHaveText('SEED 42');
	await expect(page.getByRole('button', { name: /continue run/i })).toBeVisible();
	await expect(page.getByRole('button', { name: /^new run$/i })).toBeVisible();
	await expect(page.getByTestId('best-score')).toHaveText('0');

	// The app persists the fresh save it created, not just an in-memory run.
	const saved = await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
	expect(saved).not.toBeNull();
	expect(JSON.parse(saved ?? '{}').version).toBe(2);
	expect(JSON.parse(saved ?? '{}').run.seed).toBe(42);
});

test('the first tap placement fuses H + N and survives a reload', async ({ page }) => {
	// No seeded save: seed 42 starts with Nitrogen on cell 6 and H in the hand.
	await page.goto('/');
	await page.getByRole('button', { name: /continue run/i }).click();

	await expect(page.getByRole('button', { name: /cell 6, N Nitrogen/i })).toBeVisible();
	await expect(page.getByRole('meter', { name: 'Heat' })).toHaveAttribute('aria-valuenow', '0');

	await page.getByRole('button', { name: /card 1, H Hydrogen/i }).click();
	await page.getByRole('button', { name: /cell 7, empty/i }).click();

	const preview = page.getByRole('dialog', { name: /placement preview/i });
	await expect(preview).toBeVisible();
	await expect(preview.getByTestId('preview-result')).toHaveText('Silicon');
	await expect(preview.getByTestId('preview-score')).toHaveText('+8');
	await expect(preview.getByTestId('preview-heat')).toHaveText('8 / 100');
	await preview.getByRole('button', { name: /^confirm$/i }).click();

	// The preview is the commit: one fusion consumed cell 6 and left Si on 7.
	await expect(page.getByRole('button', { name: /cell 6, empty/i })).toBeVisible();
	await expect(page.getByRole('button', { name: /cell 7, Si Silicon/i })).toBeVisible();
	await expect(page.getByTestId('score-value')).toHaveText('8');
	await expect(page.getByRole('meter', { name: 'Heat' })).toHaveAttribute('aria-valuenow', '8');

	await page.reload();
	await page.getByRole('button', { name: /continue run/i }).click();

	await expect(page.getByRole('button', { name: /cell 7, Si Silicon/i })).toBeVisible();
	await expect(page.getByTestId('score-value')).toHaveText('8');
	await expect(page.getByRole('meter', { name: 'Heat' })).toHaveAttribute('aria-valuenow', '8');

	const saved = await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
	const run = JSON.parse(saved ?? '{}').run;
	expect(run.grid[6]).toBe(null);
	expect(run.grid[7]).toBe('Si');
	expect(run.score).toBe(8);
	expect(run.status).toBe('active');
});
