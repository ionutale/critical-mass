import { expect, test } from '@playwright/test';

test('fuses helium, delivers the contract, and persists after reload', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByRole('heading', { name: /critical mass/i })).toBeVisible();
	await page.getByRole('button', { name: /continue run/i }).click();
	await expect(page.getByText('0 / 100')).toBeVisible();

	await page.getByRole('button', { name: /hydrogen card 1/i }).click();
	await page.getByRole('button', { name: /cell 13/i }).click();
	await expect(page.getByRole('dialog', { name: /preview/i })).toBeVisible();
	await page.getByRole('button', { name: /confirm/i }).click();

	await expect(page.getByRole('button', { name: /cell 13/i })).toContainText('He');
	await expect(page.getByText('5 / 100')).toBeVisible();

	await page.getByRole('button', { name: /deliver helium/i }).click();
	const draft = page.getByRole('dialog', { name: /choose one upgrade/i });
	await expect(draft).toBeVisible();
	await draft.getByRole('button').first().click();
	await expect(page.getByText(/contract 2\/5/i)).toBeVisible();

	await page.reload();
	await page.getByRole('button', { name: /continue run/i }).click();
	await expect(page.getByText(/contract 2\/5/i)).toBeVisible();
	await expect(page.getByText('5 / 100')).toBeVisible();
});
