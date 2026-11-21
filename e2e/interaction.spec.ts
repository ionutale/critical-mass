import { expect, test } from '@playwright/test';
import { gridWith, seedRun, tabTo, touchDrag, touchSwipe } from './fixtures';

test('places a card with the keyboard only (arrows + Enter)', async ({ page }) => {
	// Cell 1 is occupied, so the keyboard ghost starts on 0 and ArrowRight skips
	// to empty cell 2, where H fuses with the N on 1.
	await seedRun(page, { grid: gridWith({ 1: 'N' }) });
	await page.goto('/');

	await tabTo(page, /continue run/i);
	await page.keyboard.press('Enter');
	await expect(page.getByText(/TURN 1/)).toBeVisible();

	await tabTo(page, /card 1, H Hydrogen/i);
	await page.keyboard.press('ArrowRight');

	// The keyboard path shows the same inline preview the pointer flow uses.
	await expect(page.getByRole('dialog', { name: /placement preview/i })).toBeVisible();
	await expect(page.getByTestId('preview-result')).toHaveText('Silicon');
	await expect(page.getByTestId('preview-heat')).toHaveText('8 / 100');

	await page.keyboard.press('Enter');

	await expect(page.getByRole('button', { name: /cell 2, Si Silicon/i })).toBeVisible();
	await expect(page.getByRole('button', { name: /cell 1, empty/i })).toBeVisible();
	await expect(page.getByTestId('score-value')).toHaveText('8');
	await expect(page.getByRole('meter', { name: 'Heat' })).toHaveAttribute('aria-valuenow', '8');
});

test('Escape cancels a keyboard placement without committing', async ({ page }) => {
	await seedRun(page, { grid: gridWith({ 1: 'H' }) });
	await page.goto('/');
	await tabTo(page, /continue run/i);
	await page.keyboard.press('Enter');

	await tabTo(page, /card 1, H Hydrogen/i);
	await page.keyboard.press('ArrowRight');
	await expect(page.getByRole('dialog', { name: /placement preview/i })).toBeVisible();

	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog', { name: /placement preview/i })).toHaveCount(0);
	await expect(page.getByTestId('score-value')).toHaveText('0');
	await expect(page.getByRole('meter', { name: 'Heat' })).toHaveAttribute('aria-valuenow', '0');
});

test.describe('touch on a 390×844 phone', () => {
	test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

	test('drags a card with a touch pointer', async ({ page }) => {
		await seedRun(page, { grid: gridWith({ 6: 'N' }) });
		await page.goto('/');
		await page.getByRole('button', { name: /continue run/i }).click();

		await touchDrag(
			page,
			page.getByRole('button', { name: /card 1, H Hydrogen/i }),
			page.getByRole('button', { name: /cell 7, empty/i })
		);

		await expect(page.getByRole('button', { name: /cell 7, Si Silicon/i })).toBeVisible();
		await expect(page.getByRole('button', { name: /cell 6, empty/i })).toBeVisible();
		await expect(page.getByRole('meter', { name: 'Heat' })).toHaveAttribute('aria-valuenow', '8');
		await expect(page.getByTestId('score-value')).toHaveText('8');
	});

	test('swipe up on the reactor opens the Stabilize picker', async ({ page }) => {
		await seedRun(page, {
			grid: gridWith({ 0: 'H' }),
			heat: 60,
			turn: 10,
			milestonesCrossed: 2
		});
		await page.goto('/');
		await page.getByRole('button', { name: /continue run/i }).click();

		await touchSwipe(page, page.getByRole('button', { name: /cell 12, empty/i }), -70);

		const picker = page.getByRole('dialog', { name: /^stabilize$/i });
		await expect(picker).toBeVisible();
		await expect(picker.getByRole('button')).toHaveCount(6);
		await picker
			.getByRole('button', { name: /stabilize with hydrogen/i })
			.first()
			.click();

		await expect(picker).toHaveCount(0);
		await expect(page.getByText(/TURN 11/)).toBeVisible();
		await expect(page.getByRole('meter', { name: 'Heat' })).toHaveAttribute('aria-valuenow', '49');
	});
});

test('reduced motion commits instantly and mounts no motion layer', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await seedRun(page, { grid: gridWith({ 6: 'N' }) });
	await page.goto('/');
	await page.getByRole('button', { name: /continue run/i }).click();

	expect(
		await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
	).toBe(true);

	await page.getByRole('button', { name: /card 1, H Hydrogen/i }).click();
	await page.getByRole('button', { name: /cell 7, empty/i }).click();
	await page
		.getByRole('dialog', { name: /placement preview/i })
		.getByRole('button', { name: /^confirm$/i })
		.click();

	// No chain playback, no ghost layer, and no motion markers at all.
	await expect(page.getByTestId('chain-playback')).toHaveCount(0);
	await expect(page.locator('[data-motion]')).toHaveCount(0);
	await expect(page.locator('.chain-ghost, .flight-ghost, .score-float')).toHaveCount(0);

	// The committed state is already final.
	await expect(page.getByRole('button', { name: /cell 7, Si Silicon/i })).toBeVisible();
	await expect(page.getByTestId('score-value')).toHaveText('8');
	await expect(page.getByRole('meter', { name: 'Heat' })).toHaveAttribute('aria-valuenow', '8');
});

test('the reduced-motion setting removes choreography for the run', async ({ page }) => {
	await seedRun(
		page,
		{ grid: gridWith({ 6: 'N' }) },
		{ settings: { sound: false, reduceMotion: true } }
	);
	await page.goto('/');
	await page.getByRole('button', { name: /continue run/i }).click();

	await page.getByRole('button', { name: /card 1, H Hydrogen/i }).click();
	await page.getByRole('button', { name: /cell 7, empty/i }).click();
	await page
		.getByRole('dialog', { name: /placement preview/i })
		.getByRole('button', { name: /^confirm$/i })
		.click();

	await expect(page.getByTestId('chain-playback')).toHaveCount(0);
	await expect(page.locator('[data-motion]')).toHaveCount(0);
	await expect(page.getByRole('button', { name: /cell 7, Si Silicon/i })).toBeVisible();
});
