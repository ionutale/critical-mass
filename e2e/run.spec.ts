import { expect, test } from '@playwright/test';
import { SAVE_KEY, gridWith, seedRun } from './fixtures';

test('a two-step chain preview matches its commit and plays back', async ({ page }) => {
	// Be placed on 13 fuses with both H neighbours; the default branch makes N,
	// which then fuses with the second H into Si.
	await seedRun(page, {
		grid: gridWith({ 12: 'H', 8: 'H' }),
		hand: ['Be', 'H', 'H', 'H', 'H']
	});
	await page.goto('/');
	await page.getByRole('button', { name: /continue run/i }).click();

	await page.getByRole('button', { name: /card 1/i }).click();
	await page.getByRole('button', { name: /cell 13, empty/i }).click();

	const preview = page.getByRole('dialog', { name: /placement preview/i });
	await expect(preview).toBeVisible();
	await expect(preview.getByRole('list', { name: /chain steps/i }).locator('li')).toHaveCount(2);
	await expect(preview.getByTestId('preview-result')).toHaveText('Silicon');
	await expect(preview.getByTestId('preview-score')).toHaveText('+22');
	await expect(preview.getByTestId('preview-heat')).toHaveText('12 / 100');
	await preview.getByRole('button', { name: /^confirm$/i }).click();

	// Choreography: the playback layer and its motion markers exist only while
	// the chain plays, then clean themselves up.
	await expect(page.getByTestId('chain-playback')).toBeVisible();
	await expect(page.locator('[data-motion="score"]')).toHaveCount(1);
	await expect(page.locator('[data-motion="heat"]')).toHaveCount(1);
	await expect(page.getByTestId('chain-playback')).toHaveCount(0, { timeout: 5000 });

	await expect(page.getByRole('button', { name: /cell 13, Si Silicon/i })).toBeVisible();
	await expect(page.getByRole('button', { name: /cell 12, empty/i })).toBeVisible();
	await expect(page.getByRole('button', { name: /cell 8, empty/i })).toBeVisible();
	await expect(page.getByTestId('score-value')).toHaveText('22');
	await expect(page.getByRole('meter', { name: 'Heat' })).toHaveAttribute('aria-valuenow', '12');
	await expect(page.getByText(/TURN 2/)).toBeVisible();
});

test('a short hot run ends on Overload and tallies the save', async ({ page }) => {
	await seedRun(page, {
		heat: 90,
		turn: 20,
		milestonesCrossed: 3,
		score: 40,
		bestChain: 2
	});
	await page.goto('/');
	await page.getByRole('button', { name: /continue run/i }).click();

	const heat = page.getByRole('meter', { name: 'Heat' });
	const cells = [
		page.getByRole('button', { name: /cell 0, empty/i }),
		page.getByRole('button', { name: /cell 24, empty/i }),
		page.getByRole('button', { name: /cell 12, empty/i })
	];

	for (const cell of cells.slice(0, 2)) {
		await page.getByRole('button', { name: /card 1, H Hydrogen/i }).click();
		await cell.click();
		await page
			.getByRole('dialog', { name: /placement preview/i })
			.getByRole('button', { name: /^confirm$/i })
			.click();
	}

	await expect(heat).toHaveAttribute('aria-valuenow', '98');

	// The third placement cannot survive the passive Heat; the preview says so.
	await page.getByRole('button', { name: /card 1, H Hydrogen/i }).click();
	await cells[2].click();
	const preview = page.getByRole('dialog', { name: /placement preview/i });
	await expect(preview.getByRole('alert')).toContainText(/passive heat ends the run/i);
	await expect(preview.getByTestId('preview-heat')).toHaveText('100 / 100');
	await preview.getByRole('button', { name: /^confirm$/i }).click();

	const end = page.getByRole('dialog', { name: /run over/i });
	await expect(end).toBeVisible();
	await expect(end.getByTestId('final-score')).toHaveText('40');
	await expect(end.getByTestId('runs')).toHaveText('1');
	await expect(end.getByRole('heading', { name: /run over/i })).toBeVisible();
	await expect(heat).toHaveAttribute('aria-valuenow', '100');

	const save = JSON.parse(
		(await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY)) ?? '{}'
	);
	expect(save.run.status).toBe('overload');
	expect(save.run.heat).toBe(100);
	expect(save.meta.runs).toBe(1);
	expect(save.meta.bestScore).toBe(40);

	// A finished run is replaced, not resumed.
	await end.getByRole('button', { name: /play again/i }).click();
	await expect(end).toHaveCount(0);
	await expect(heat).toHaveAttribute('aria-valuenow', '0');
	await expect(page.getByText(/TURN 1/)).toBeVisible();
});

test('an upgrade draft offers 1 of 3 and persists its choice', async ({ page }) => {
	await seedRun(page, {
		heat: 24,
		turn: 7,
		milestonesCrossed: 1,
		pendingDrafts: 1,
		grid: gridWith({ 0: 'H', 24: 'Li' })
	});
	await page.goto('/');
	await page.getByRole('button', { name: /continue run/i }).click();

	const draft = page.getByRole('dialog', { name: /upgrade draft/i });
	await expect(draft).toBeVisible();
	await expect(draft.getByRole('heading', { name: /choose one upgrade/i })).toBeVisible();
	await expect(draft.getByRole('button')).toHaveCount(3);

	await draft.getByRole('button').first().click();
	await expect(draft).toHaveCount(0);

	const afterPick = JSON.parse(
		(await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY)) ?? '{}'
	).run;
	expect(afterPick.pendingDrafts).toBe(0);
	expect(afterPick.upgrades).toHaveLength(1);

	// Reload: the run resumes with the chosen upgrade and no pending draft.
	await page.reload();
	await page.getByRole('button', { name: /continue run/i }).click();
	await expect(page.getByRole('dialog', { name: /upgrade draft/i })).toHaveCount(0);
	await expect(page.getByText(/TURN 7/)).toBeVisible();
	await expect(page.getByRole('meter', { name: 'Heat' })).toHaveAttribute('aria-valuenow', '24');
});

test('a mid-run reload keeps the board, score, heat, and turn', async ({ page }) => {
	await seedRun(page, {
		grid: gridWith({ 6: 'N', 12: 'He' }),
		hand: ['Li', 'H', 'H', 'H', 'H'],
		heat: 42,
		turn: 9,
		score: 100,
		bestChain: 2,
		milestonesCrossed: 2
	});
	await page.goto('/');
	await page.getByRole('button', { name: /continue run/i }).click();

	await expect(page.getByText(/TURN 9/)).toBeVisible();
	await expect(page.getByTestId('score-value')).toHaveText('100');
	await expect(page.getByRole('meter', { name: 'Heat' })).toHaveAttribute('aria-valuenow', '42');
	await expect(page.getByRole('button', { name: /cell 6, N Nitrogen/i })).toBeVisible();
	await expect(page.getByRole('button', { name: /cell 12, He Helium/i })).toBeVisible();

	await page.reload();
	await page.getByRole('button', { name: /continue run/i }).click();

	await expect(page.getByText(/TURN 9/)).toBeVisible();
	await expect(page.getByTestId('score-value')).toHaveText('100');
	await expect(page.getByRole('meter', { name: 'Heat' })).toHaveAttribute('aria-valuenow', '42');
	await expect(page.getByRole('button', { name: /cell 6, N Nitrogen/i })).toBeVisible();
	await expect(page.getByRole('button', { name: /cell 12, He Helium/i })).toBeVisible();
	await expect(page.getByRole('button', { name: /card 1, Li Lithium/i })).toBeVisible();
});

test('an empty hand can still Stabilize into Overload', async ({ page }) => {
	// Five Stabilizes with a card in hand empty the hand without drawing. Before
	// the fix, handEmpty disabled Stabilize and no card could be placed, so the
	// run could never advance or overload.
	await seedRun(page, {
		grid: gridWith({ 0: 'H' }),
		hand: [],
		deck: [],
		discard: [],
		heat: 96,
		turn: 23,
		milestonesCrossed: 3
	});
	await page.goto('/');
	await page.getByRole('button', { name: /continue run/i }).click();

	const stabilize = page.getByRole('button', { name: /^stabilize$/i });
	await expect(stabilize).toBeEnabled();
	await stabilize.click();

	// A pure pass: no picker, only the passive Heat, straight into Overload.
	await expect(page.getByRole('dialog', { name: /^stabilize$/i })).toHaveCount(0);
	await expect(page.getByRole('meter', { name: 'Heat' })).toHaveAttribute('aria-valuenow', '100');
	await expect(page.getByRole('dialog', { name: /run over/i })).toBeVisible();
	await expect(page.getByTestId('runs')).toHaveText('1');
});

test('Stabilize cools the reactor and Scrap clears one tile for free', async ({ page }) => {
	await seedRun(page, {
		grid: gridWith({ 0: 'H' }),
		heat: 60,
		turn: 10,
		score: 25,
		milestonesCrossed: 2
	});
	await page.goto('/');
	await page.getByRole('button', { name: /continue run/i }).click();

	await page.getByRole('button', { name: /scrap tile/i }).click();
	await page.getByRole('button', { name: /cell 0, H Hydrogen/i }).click();
	await expect(page.getByRole('button', { name: /cell 0, empty/i })).toBeVisible();
	await expect(page.getByRole('button', { name: /scrap tile/i })).toBeDisabled();
	await expect(page.getByText(/TURN 10/)).toBeVisible();

	await page.getByRole('button', { name: /^stabilize$/i }).click();
	await expect(page.getByTestId('preview-live')).toHaveText(/choose a card to stabilize/i);
	await page.getByRole('button', { name: /card 1, H Hydrogen/i }).click();

	// Stabilize discards a card, cools 15 (not below the floor of 4 × turn 10),
	// and ends the turn with the +4 passive Heat.
	await expect(page.getByText(/TURN 11/)).toBeVisible();
	await expect(page.getByRole('meter', { name: 'Heat' })).toHaveAttribute('aria-valuenow', '49');
	await expect(page.getByText(/HAND \/\/ 4/)).toBeVisible();

	const run = JSON.parse(
		(await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY)) ?? '{}'
	).run;
	expect(run.turn).toBe(11);
	expect(run.heat).toBe(49);
	expect(run.discard).toHaveLength(1);
	expect(run.grid[0]).toBe(null);
	// The replacement turn refreshes the once-per-turn Scrap.
	expect(run.scrapsUsed).toBe(0);
	await expect(page.getByRole('button', { name: /scrap tile/i })).toBeEnabled();
});
