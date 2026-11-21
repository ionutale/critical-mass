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

type Target = {
	label: string;
	width: number;
	height: number;
	enabled: boolean;
	visible: boolean;
};

/** Measure matching controls so a size check can also prove what it covered. */
async function measureTargets(page: Page, selector: string): Promise<Target[]> {
	return page.evaluate(
		(sel) =>
			[...document.querySelectorAll<HTMLElement>(sel)].map((element) => {
				const rect = element.getBoundingClientRect();
				return {
					label: element.getAttribute('aria-label') ?? element.textContent?.trim() ?? '',
					width: rect.width,
					height: rect.height,
					enabled: !element.matches(':disabled'),
					visible:
						rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== 'hidden'
				};
			}),
		selector
	);
}

/** Every measured target must be visible, enabled, and at least 44×44. */
function targetFailures(targets: Target[]): string[] {
	return targets
		.filter(
			(target) => !target.visible || !target.enabled || target.width < 44 || target.height < 44
		)
		.map(
			(target) =>
				`${target.label.slice(0, 40) || '(unlabeled)'} — ${Math.round(target.width)}×${Math.round(
					target.height
				)}, ${target.visible ? (target.enabled ? 'enabled' : 'disabled') : 'hidden'}`
		);
}

async function smallTargets(page: Page): Promise<string[]> {
	return (await measureTargets(page, 'button:not([disabled]), a[href]'))
		.filter((target) => target.visible && (target.width < 44 || target.height < 44))
		.map((target) => target.label.slice(0, 24));
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

test('the unlocked run screen has 44px board, Stabilize, Scrap, and hand targets', async ({
	page
}) => {
	// No pending draft: every run control is enabled, so the measurement covers
	// the board, both actions, and the hand instead of only the enabled leftovers.
	await seedRun(page, {
		grid: gridWith({ 6: 'N', 12: 'He' }),
		heat: 24,
		turn: 7,
		milestonesCrossed: 1
	});
	await page.goto('/');
	await page.getByRole('button', { name: /continue run/i }).click();
	await expect(page.getByText(/TURN 7/)).toBeVisible();
	await expect(page.getByRole('dialog', { name: /upgrade draft/i })).toHaveCount(0);

	expect(await measureTargets(page, 'main.arcade-run button[data-cell]')).toHaveLength(25);
	expect(
		await measureTargets(page, 'main.arcade-run section[aria-label="Hand"] button')
	).toHaveLength(5);
	expect(
		(await measureTargets(page, 'main.arcade-run .actions button')).map((target) => target.label)
	).toEqual(['Stabilize', 'Scrap tile']);

	// Board cells, Stabilize, Scrap, hand cards, and Menu: all enabled and 44px.
	expect(targetFailures(await measureTargets(page, 'main.arcade-run button'))).toEqual([]);
});

test('every upgrade draft option is at least 44px', async ({ page }) => {
	await seedRun(page, {
		heat: 24,
		turn: 7,
		milestonesCrossed: 1,
		pendingDrafts: 1
	});
	await page.goto('/');
	await page.getByRole('button', { name: /continue run/i }).click();
	await expect(page.getByRole('dialog', { name: /upgrade draft/i })).toBeVisible();

	// A queued draft locks the run behind the overlay, so measure the options it
	// leaves enabled instead of the disabled run controls underneath.
	await expect(page.getByRole('button', { name: 'Stabilize' })).toBeDisabled();
	const options = await measureTargets(page, '[role="dialog"][aria-label="Upgrade draft"] button');
	expect(options).toHaveLength(3);
	expect(targetFailures(options)).toEqual([]);
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
