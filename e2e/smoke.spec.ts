import { expect, test } from '@playwright/test';

test('fuses helium, delivers the contract, and persists after reload', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByRole('heading', { name: /critical mass/i })).toBeVisible();
	await expect(page.getByText('0 / 100')).toBeVisible();

	await page.getByRole('button', { name: /hydrogen card 1/i }).click();
	await page.getByRole('button', { name: /cell 13/i }).click();
	await expect(page.getByRole('dialog', { name: /preview/i })).toBeVisible();
	await page.getByRole('button', { name: /confirm/i }).click();

	await expect(page.getByRole('button', { name: /cell 13/i })).toContainText('He');
	await expect(page.getByText('5 / 100')).toBeVisible();

	await page.getByRole('button', { name: /deliver helium/i }).click();
	await expect(page.getByText('CONTRACT COMPLETE')).toBeVisible();

	await page.reload();
	await expect(page.getByText('CONTRACT COMPLETE')).toBeVisible();
	await expect(page.getByText('5 / 100')).toBeVisible();
});
