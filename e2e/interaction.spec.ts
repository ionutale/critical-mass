import { expect, test } from '@playwright/test';
import {
	gridWith,
	pointerCancels,
	realTouchDrag,
	seedRun,
	tabTo,
	touchDrag,
	touchSwipe,
	watchPointerCancels
} from './fixtures';

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

test('keyboard opens the branch choices and commits a non-default path', async ({ page }) => {
	// C at the centre can fuse with H, Li, or Na: three different results.
	await seedRun(page, {
		grid: gridWith({ 7: 'H', 13: 'Li', 17: 'Na' }),
		hand: ['C', 'H', 'Li', 'He', 'Be']
	});
	await page.goto('/');
	await tabTo(page, /continue run/i);
	await page.keyboard.press('Enter');

	await tabTo(page, /card 1, C Carbon/i);
	for (const key of ['ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowRight']) {
		await page.keyboard.press(key);
	}
	await expect(page.getByTestId('preview-result')).toHaveText('Neon');

	// Enter opens the branch modal; the first option owns focus.
	await page.keyboard.press('Enter');
	const modal = page.getByRole('dialog', { name: /placement preview/i });
	await expect(modal).toBeVisible();
	await expect(modal.getByText(/choose a branch/i)).toBeVisible();
	await expect(modal.getByTestId('preview-option-1-0')).toBeFocused();

	await modal.getByRole('button', { name: /sodium\s*→\s*iron/i }).click();
	await expect(modal.getByTestId('preview-result')).toHaveText('Iron');
	await modal.getByRole('button', { name: /^confirm$/i }).click();

	await expect(page.getByRole('button', { name: /cell 12, Fe Iron/i })).toBeVisible();
	await expect(page.getByRole('button', { name: /cell 17, empty/i })).toBeVisible();
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

	test('drag release opens the branch modal and commits a non-default path', async ({ page }) => {
		await seedRun(page, {
			grid: gridWith({ 7: 'H', 13: 'Li', 17: 'Na' }),
			hand: ['C', 'H', 'Li', 'He', 'Be']
		});
		await page.goto('/');
		await page.getByRole('button', { name: /continue run/i }).click();

		await touchDrag(
			page,
			page.getByRole('button', { name: /card 1, C Carbon/i }),
			page.getByRole('button', { name: /cell 12, empty/i })
		);

		const modal = page.getByRole('dialog', { name: /placement preview/i });
		await expect(modal).toBeVisible();
		await expect(modal.getByText(/choose a branch/i)).toBeVisible();
		await expect(modal.getByTestId('preview-option-1-0')).toBeFocused();
		await expect(modal.getByTestId('preview-result')).toHaveText('Neon');
		await expect(modal.getByRole('button', { name: /→/i })).toHaveCount(3);

		await modal.getByRole('button', { name: /sodium\s*→\s*iron/i }).click();
		await expect(modal.getByTestId('preview-result')).toHaveText('Iron');
		await modal.getByRole('button', { name: /^confirm$/i }).click();

		await expect(page.getByRole('button', { name: /cell 12, Fe Iron/i })).toBeVisible();
		await expect(page.getByRole('button', { name: /cell 17, empty/i })).toBeVisible();
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

/**
 * A real browser gesture, not synthetic DOM events. Chrome latches
 * `touch-action` when the finger lands, so a JS-only scroll lock cannot save a
 * drag that resolves the pan natively: the browser would claim the gesture and
 * fire `pointercancel`. These tests require a genuine commit and zero cancels.
 */
for (const viewport of [
	{ width: 390, height: 844 },
	{ width: 375, height: 667 }
]) {
	test.describe(`real touch drag at ${viewport.width}×${viewport.height}`, () => {
		test.use({ viewport, isMobile: true, hasTouch: true });

		test('commits a drag without a pointercancel', async ({ page }) => {
			// The target is on the bottom row so both the card and the cell fit
			// together above the fold on the shorter viewport.
			await seedRun(page, { grid: gridWith({ 21: 'N' }) });
			await page.goto('/');
			await page.getByRole('button', { name: /continue run/i }).click();

			const card = page.getByRole('button', { name: /card 1, H Hydrogen/i });
			const cell = page.getByRole('button', { name: /cell 22, empty/i });
			await cell.scrollIntoViewIfNeeded();
			await card.scrollIntoViewIfNeeded();

			const cellBox = await cell.boundingBox();
			const cardBox = await card.boundingBox();
			expect(cellBox).not.toBeNull();
			expect(cardBox).not.toBeNull();
			// A drag test that cannot see both endpoints proves nothing.
			expect(cellBox!.y).toBeGreaterThanOrEqual(0);
			expect(cellBox!.y + cellBox!.height).toBeLessThanOrEqual(viewport.height);
			expect(cardBox!.y).toBeGreaterThanOrEqual(0);
			expect(cardBox!.y + cardBox!.height).toBeLessThanOrEqual(viewport.height);

			await watchPointerCancels(page);
			await realTouchDrag(page, card, cell);

			await expect(page.getByRole('button', { name: /cell 22, Si Silicon/i })).toBeVisible();
			await expect(page.getByRole('button', { name: /cell 21, empty/i })).toBeVisible();
			await expect(page.getByTestId('score-value')).toHaveText('8');
			expect(await pointerCancels(page)).toBe(0);
		});

		test('reaches the board and hand by scrolling', async ({ page }) => {
			await seedRun(page, { grid: gridWith({ 6: 'N' }) });
			await page.goto('/');
			await page.getByRole('button', { name: /continue run/i }).click();

			const board = page.getByRole('group', { name: /reactor board/i });
			await expect(board).toBeVisible();

			const hand = page.getByRole('region', { name: /hand/i });
			await hand.scrollIntoViewIfNeeded();
			await expect(hand).toBeInViewport();
			await expect(page.getByRole('button', { name: /card 1, H Hydrogen/i })).toBeInViewport();

			// Layout must not push a target off the side of the screen.
			const overflow = await page.evaluate(
				() => document.documentElement.scrollWidth - document.documentElement.clientWidth
			);
			expect(overflow).toBeLessThanOrEqual(1);
		});
	});
}


test('a fusion restarts the board-local particle burst', async ({ page }) => {
	await seedRun(page, { grid: gridWith({ 6: 'N' }) });
	await page.goto('/');
	await page.getByRole('button', { name: /continue run/i }).click();

	const canvas = page.locator('canvas.particles');
	await expect(canvas).toHaveCount(1);
	await expect(canvas).toHaveAttribute('data-burst', '0');
	// Behind the board in DOM order, and inert.
	await expect(canvas).toHaveAttribute('aria-hidden', 'true');

	await page.getByRole('button', { name: /card 1, H Hydrogen/i }).click();
	await page.getByRole('button', { name: /cell 7, empty/i }).click();
	await page
		.getByRole('dialog', { name: /placement preview/i })
		.getByRole('button', { name: /^confirm$/i })
		.click();

	await expect(canvas).toHaveAttribute('data-burst', '1');
	await expect(canvas).toHaveAttribute('data-mode', 'fusion');
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

	// No chain playback, no ghost layer, no particles, and no motion markers.
	await expect(page.getByTestId('chain-playback')).toHaveCount(0);
	await expect(page.locator('canvas.particles')).toHaveCount(0);
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
