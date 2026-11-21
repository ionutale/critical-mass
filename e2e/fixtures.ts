import type { Page } from '@playwright/test';

export const SAVE_KEY = 'critical-mass:save:v1';

/** A 25-cell reactor grid: a symbol per cell, or null when empty. */
export function emptyGrid(): (string | null)[] {
	return Array<string | null>(25).fill(null);
}

/** Build a grid from sparse `cell: symbol` entries. */
export function gridWith(tiles: Record<number, string>): (string | null)[] {
	const grid = emptyGrid();
	for (const [cell, symbol] of Object.entries(tiles)) grid[Number(cell)] = symbol;
	return grid;
}

/**
 * A valid arcade run (save schema v2). Overrides are shallow, so callers pass a
 * complete `grid`/`hand` when they need one.
 */
export function runFixture(overrides: Record<string, unknown> = {}) {
	return {
		seed: 42,
		rngState: 503953318,
		turn: 1,
		grid: emptyGrid(),
		deck: [],
		hand: ['H', 'H', 'H', 'H', 'H'],
		discard: [],
		heat: 0,
		heatCap: 100,
		score: 0,
		bestChain: 0,
		status: 'active',
		pendingDrafts: 0,
		upgrades: [],
		scrapsUsed: 0,
		milestonesCrossed: 0,
		heatSinkUsed: false,
		echoUsed: false,
		unlocked: [],
		...overrides
	};
}

/** A valid save with a run, lifetime meta, and settings. */
export function saveFixture(overrides: Record<string, unknown> = {}) {
	return {
		version: 2,
		run: runFixture(),
		meta: {
			bestScore: 0,
			totalScore: 0,
			runs: 0,
			bestChain: 0,
			unlocks: []
		},
		settings: { sound: false, reduceMotion: false },
		...overrides
	};
}

/**
 * Seed localStorage before the first load. The guard means a later reload keeps
 * whatever the app autosaved instead of restoring the fixture.
 */
export async function seed(page: Page, overrides: Record<string, unknown> = {}): Promise<void> {
	await page.addInitScript(
		([key, save]) => {
			if (!localStorage.getItem(key)) localStorage.setItem(key, save);
		},
		[SAVE_KEY, JSON.stringify(saveFixture(overrides))] as const
	);
}

/** Seed a run fixture inside an otherwise default save. */
export async function seedRun(
	page: Page,
	run: Record<string, unknown> = {},
	save: Record<string, unknown> = {}
): Promise<void> {
	await seed(page, { ...save, run: runFixture(run) });
}

/** Read the persisted arcade save. */
export async function readSave(page: Page): Promise<{
	version: number;
	run: Record<string, unknown> & {
		grid: (string | null)[];
		hand: string[];
		upgrades: string[];
		status: string;
		heat: number;
	};
	meta: Record<string, number | string[]>;
}> {
	return page.evaluate((key) => {
		const raw = localStorage.getItem(key);
		return raw ? JSON.parse(raw) : null;
	}, SAVE_KEY);
}

/**
 * Keyboard traversal helper: press Tab until a button or link matches. This
 * keeps keyboard coverage honest instead of calling `.focus()` directly.
 */
export async function tabTo(page: Page, pattern: RegExp, limit = 200): Promise<void> {
	for (let step = 0; step < limit; step += 1) {
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

/**
 * Dispatch a real pointer session with `pointerType: 'touch'`. Playwright has
 * no touch-drag API, so the phone test drives the same DOM events a finger
 * would: pointerdown on the card, vertical pointermove to the cell, pointerup.
 */
export async function touchDrag(
	page: Page,
	card: import('@playwright/test').Locator,
	cell: import('@playwright/test').Locator
): Promise<void> {
	await card.scrollIntoViewIfNeeded();
	const cardBox = await card.boundingBox();
	const cellBox = await cell.boundingBox();
	if (!cardBox || !cellBox) throw new Error('drag endpoints must be visible');

	const from = { x: cardBox.x + cardBox.width / 2, y: cardBox.y + cardBox.height / 2 };
	const to = { x: cellBox.x + cellBox.width / 2, y: cellBox.y + cellBox.height / 2 };

	await page.evaluate(
		({ from: start, to: end }) => {
			const fire = (
				target: EventTarget,
				type: string,
				x: number,
				y: number,
				buttons: number
			): void => {
				target.dispatchEvent(
					new PointerEvent(type, {
						bubbles: true,
						cancelable: true,
						composed: true,
						pointerId: 7,
						pointerType: 'touch',
						isPrimary: true,
						button: 0,
						buttons,
						clientX: x,
						clientY: y
					})
				);
			};

			const pressed = document.elementFromPoint(start.x, start.y);
			fire(pressed ?? document.body, 'pointerdown', start.x, start.y, 1);
			// The gesture claims the pointer only once it travels vertically.
			fire(window, 'pointermove', start.x, start.y - 24, 1);
			fire(window, 'pointermove', end.x, end.y, 1);
			fire(window, 'pointerup', end.x, end.y, 0);
		},
		{ from, to }
	);
}

/** Dispatch a vertical touch swipe across a locator's centre. */
export async function touchSwipe(
	page: Page,
	target: import('@playwright/test').Locator,
	deltaY: number
): Promise<void> {
	await target.scrollIntoViewIfNeeded();
	const box = await target.boundingBox();
	if (!box) throw new Error('swipe target must be visible');
	const x = box.x + box.width / 2;
	const y = box.y + box.height / 2;

	await page.evaluate(
		({ x: startX, y: startY, dy }) => {
			const fire = (
				node: EventTarget,
				type: string,
				clientX: number,
				clientY: number,
				buttons: number
			): void => {
				node.dispatchEvent(
					new PointerEvent(type, {
						bubbles: true,
						cancelable: true,
						composed: true,
						pointerId: 11,
						pointerType: 'touch',
						isPrimary: true,
						button: 0,
						buttons,
						clientX,
						clientY
					})
				);
			};

			const pressed = document.elementFromPoint(startX, startY);
			fire(pressed ?? document.body, 'pointerdown', startX, startY, 1);
			fire(window, 'pointermove', startX, startY + dy, 1);
			fire(window, 'pointerup', startX, startY + dy, 0);
		},
		{ x, y, dy: deltaY }
	);
}

/**
 * Count `pointercancel` events from now on. A real touch drag must complete
 * without the browser claiming the gesture for a native pan.
 */
export async function watchPointerCancels(page: Page): Promise<void> {
	await page.evaluate(() => {
		const state = window as unknown as { __pointerCancels?: number };
		state.__pointerCancels = 0;
		window.addEventListener(
			'pointercancel',
			() => {
				state.__pointerCancels = (state.__pointerCancels ?? 0) + 1;
			},
			true
		);
	});
}

/** How many pointercancel events arrived since `watchPointerCancels`. */
export function pointerCancels(page: Page): Promise<number> {
	return page.evaluate(() => {
		const state = window as unknown as { __pointerCancels?: number };
		return state.__pointerCancels ?? 0;
	});
}

/**
 * Drive a real touch drag through CDP `Input.dispatchTouchEvent`. Unlike the
 * synthetic `touchDrag` above, this is a genuine browser gesture: Chrome
 * resolves `touch-action` at touchstart and will fire `pointercancel` if the
 * page claims the pan. The gesture moves vertically from the card to the cell.
 */
export async function realTouchDrag(
	page: Page,
	card: import('@playwright/test').Locator,
	cell: import('@playwright/test').Locator
): Promise<void> {
	await card.scrollIntoViewIfNeeded();
	const cardBox = await card.boundingBox();
	const cellBox = await cell.boundingBox();
	if (!cardBox || !cellBox) throw new Error('drag endpoints must be visible');

	const start = { x: cardBox.x + cardBox.width / 2, y: cardBox.y + cardBox.height / 2 };
	const end = { x: cellBox.x + cellBox.width / 2, y: cellBox.y + cellBox.height / 2 };
	const mid = { x: start.x, y: start.y + (end.y - start.y) * 0.5 };

	const session = await page.context().newCDPSession(page);
	try {
		await session.send('Input.dispatchTouchEvent', {
			type: 'touchStart',
			touchPoints: [{ ...start, id: 1 }]
		});
		await page.waitForTimeout(30);
		await session.send('Input.dispatchTouchEvent', {
			type: 'touchMove',
			touchPoints: [{ ...mid, id: 1 }]
		});
		await page.waitForTimeout(30);
		await session.send('Input.dispatchTouchEvent', {
			type: 'touchMove',
			touchPoints: [{ ...end, id: 1 }]
		});
		await page.waitForTimeout(30);
		await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
	} finally {
		await session.detach();
	}
}
