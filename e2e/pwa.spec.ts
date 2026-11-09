import { expect, test } from '@playwright/test';

test('is installable and opens offline after the first load', async ({ page, context }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: /critical mass/i })).toBeVisible();

	const manifestLink = page.locator('link[rel="manifest"]');
	await expect(manifestLink).toHaveAttribute('href', '/manifest.webmanifest');

	const manifest = await (
		await page.request.get(new URL('/manifest.webmanifest', page.url()).toString())
	).json();
	const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
	expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
	expect(manifest.display).toBe('standalone');

	await page.evaluate(async () => {
		await navigator.serviceWorker.ready;
	});

	await context.setOffline(true);
	await page.reload();
	await expect(page.getByRole('heading', { name: /critical mass/i })).toBeVisible();
	await context.setOffline(false);
});
