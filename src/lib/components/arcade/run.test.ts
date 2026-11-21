import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { previewPlacement } from '../../game/arcade/fusion';
import { createRun } from '../../game/arcade/turn';
import type { RunState } from '../../game/arcade/turn';
import { initGame, place, save } from '../../stores/arcade';
import type { ElementSymbol } from '../../types';
import Board from './Board.svelte';
import Hand from './Hand.svelte';
import HeatBar from './HeatBar.svelte';
import RunScreen from './RunScreen.svelte';
import ScoreDisplay from './ScoreDisplay.svelte';

const CENTER = 12;
const CHAIN_TILES: readonly (readonly [number, ElementSymbol])[] = [
	[7, 'H'],
	[13, 'H'],
	[17, 'H']
];
/** Three different fusable neighbours: H -> Ne, Li -> Si, Na -> Fe. */
const BRANCH_TILES: readonly (readonly [number, ElementSymbol])[] = [
	[7, 'H'],
	[13, 'Li'],
	[17, 'Na']
];
const FULL_HAND: ElementSymbol[] = ['H', 'Li', 'He', 'Be', 'Na'];

const STABILIZE_DELTA = { pointerId: 2, button: 0, clientX: 40, clientY: 320 };
const DRAG_START = { pointerId: 1, button: 0, clientX: 20, clientY: 320 };
const DRAG_OVER = { pointerId: 1, button: 0, clientX: 150, clientY: 140 };

function gridWith(tiles: readonly (readonly [number, ElementSymbol])[]): (ElementSymbol | null)[] {
	const grid: (ElementSymbol | null)[] = Array(25).fill(null);
	for (const [cell, symbol] of tiles) grid[cell] = symbol;
	return grid;
}

/** A deterministic active run with a 3-step chain available at the centre. */
function arcadeRun(overrides: Partial<RunState> = {}): RunState {
	return {
		...createRun(7),
		grid: gridWith(CHAIN_TILES),
		hand: [...FULL_HAND],
		deck: [...FULL_HAND],
		discard: [],
		heat: 10,
		turn: 1,
		...overrides
	};
}

/** A run whose centre placement offers three different first-step branches. */
function branchRun(overrides: Partial<RunState> = {}): RunState {
	return arcadeRun({
		grid: gridWith(BRANCH_TILES),
		hand: ['C', 'H', 'Li', 'He', 'Be'],
		...overrides
	});
}

/** Drag a hand card onto a cell: pick up, hover, release. */
async function dragCardToCell(card: HTMLElement, cell: HTMLElement): Promise<void> {
	await fireEvent.pointerDown(card, DRAG_START);
	await fireEvent.pointerMove(cell, DRAG_OVER);
	await fireEvent.pointerUp(cell, DRAG_OVER);
}

beforeEach(() => {
	window.localStorage.clear();
	initGame();
});

describe('board', () => {
	it('renders 25 cells plus filled and target styling', async () => {
		const onCell = vi.fn();
		render(Board, {
			props: { grid: gridWith([[CENTER, 'H']]), targets: [13], onCell }
		});

		expect(screen.getAllByRole('button', { name: /^cell \d+/i })).toHaveLength(25);

		const filled = screen.getByRole('button', { name: /^cell 12/i });
		expect(filled).toHaveTextContent('Hydrogen');
		expect(filled).toHaveAttribute('aria-label', expect.stringContaining('valence 1'));
		expect(filled).toHaveAttribute('aria-label', expect.stringContaining('mass 1'));
		expect(filled).toHaveClass('filled');

		const target = screen.getByRole('button', { name: /^cell 13/i });
		expect(target).toHaveTextContent('empty');
		expect(target).toHaveClass('target');

		await fireEvent.click(target);
		expect(onCell).toHaveBeenCalledWith(13);
	});
});

describe('hand', () => {
	it('renders cards with valence and mass and reports selection', async () => {
		const onSelect = vi.fn();
		render(Hand, { props: { cards: ['H', 'He'], selected: 1, onSelect } });

		const hydrogen = screen.getByRole('button', { name: /hydrogen card 1/i });
		expect(hydrogen).toHaveTextContent('Hydrogen');
		expect(hydrogen).toHaveTextContent('V 1');
		expect(hydrogen).toHaveTextContent('M 1');
		expect(hydrogen).toHaveAttribute('aria-label', expect.stringContaining('valence 1'));
		expect(hydrogen).toHaveAttribute('aria-pressed', 'false');

		const helium = screen.getByRole('button', { name: /helium card 2/i });
		expect(helium).toHaveAttribute('aria-pressed', 'true');

		await fireEvent.click(hydrogen);
		expect(onSelect).toHaveBeenCalledWith(0);
	});
});

describe('heat bar', () => {
	it('shows heat, cap, and the 25/50/75 milestones', () => {
		const { unmount } = render(HeatBar, { props: { heat: 30, cap: 100 } });

		const meter = screen.getByRole('meter', { name: /heat/i });
		expect(meter).toHaveAttribute('aria-valuenow', '30');
		expect(meter).toHaveAttribute('aria-valuemin', '0');
		expect(meter).toHaveAttribute('aria-valuemax', '100');

		const milestones = screen.getByRole('list', { name: /heat milestones/i });
		const items = within(milestones).getAllByRole('listitem');
		expect(items.map((item) => item.textContent?.trim())).toEqual(['25', '50', '75']);
		expect(items[0]).toHaveClass('reached');
		expect(items[1]).not.toHaveClass('reached');
		expect(items[2]).not.toHaveClass('reached');
		unmount();

		render(HeatBar, { props: { heat: 80, cap: 100 } });
		const reached = within(screen.getByRole('list', { name: /heat milestones/i })).getAllByRole(
			'listitem'
		);
		expect(reached.every((item) => item.classList.contains('reached'))).toBe(true);
	});
});

describe('score display', () => {
	it('shows the current and best score and labels runs as completed runs', () => {
		render(ScoreDisplay, { props: { score: 120, best: 500, runs: 3 } });

		const region = screen.getByRole('region', { name: /score/i });
		expect(within(region).getByTestId('score-value')).toHaveTextContent('120');
		expect(region).toHaveTextContent(/best 500/i);
		expect(region).toHaveTextContent(/3 completed runs/i);
	});
});

describe('run screen', () => {
	it('renders the seeded board, the hand, heat, and score', () => {
		initGame({ run: arcadeRun() });
		render(RunScreen);

		expect(screen.getAllByRole('button', { name: /^cell \d+/i })).toHaveLength(25);
		expect(screen.getByRole('button', { name: /^cell 7,/i })).toHaveTextContent('Hydrogen');
		expect(screen.getByRole('button', { name: /hydrogen card 1/i })).toHaveTextContent('Hydrogen');
		expect(screen.getByRole('meter', { name: /heat/i })).toHaveAttribute('aria-valuenow', '10');
		expect(screen.getByRole('region', { name: /score/i })).toHaveTextContent('0');
	});

	it('previews a placement from the engine and confirms it', async () => {
		const before = arcadeRun();
		const expected = previewPlacement(before, 0, CENTER);
		expect(expected).not.toBeNull();
		initGame({ run: before });
		render(RunScreen);

		await fireEvent.click(screen.getByRole('button', { name: /hydrogen card 1/i }));
		await fireEvent.click(screen.getByRole('button', { name: /^cell 12,/i }));

		const dialog = screen.getByRole('dialog', { name: /placement preview/i });
		expect(within(dialog).getAllByRole('listitem')).toHaveLength(expected!.steps.length);
		expect(dialog).toHaveTextContent(/hydrogen \+ hydrogen/i);
		expect(dialog).toHaveTextContent(/neon/i);
		expect(within(dialog).getByTestId('preview-score')).toHaveTextContent(
			`+${expected!.scoreGain}`
		);
		expect(within(dialog).getByTestId('preview-heat')).toHaveTextContent(
			String(expected!.heatAfterTurn)
		);
		expect(within(dialog).getByTestId('preview-chain-heat')).toHaveTextContent(
			String(expected!.heatAfter)
		);
		expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();

		await fireEvent.click(within(dialog).getByRole('button', { name: /confirm/i }));

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: /^cell 12,/i })).toHaveTextContent('Neon');
		expect(screen.getByRole('button', { name: /^cell 7,/i })).toHaveTextContent('empty');
		expect(screen.getByRole('meter', { name: /heat/i })).toHaveAttribute(
			'aria-valuenow',
			String(expected!.heatAfterTurn)
		);
		expect(screen.getByRole('region', { name: /score/i })).toHaveTextContent(
			String(expected!.scoreGain)
		);
	});

	it('cancels a preview without touching the board', async () => {
		initGame({ run: arcadeRun() });
		render(RunScreen);

		await fireEvent.click(screen.getByRole('button', { name: /hydrogen card 1/i }));
		await fireEvent.click(screen.getByRole('button', { name: /^cell 12,/i }));
		expect(screen.getByRole('dialog', { name: /placement preview/i })).toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: /^cell 12,/i })).toHaveTextContent('empty');
		expect(screen.getByRole('meter', { name: /heat/i })).toHaveAttribute('aria-valuenow', '10');
	});

	it('warns when a preview would overload and locks the run after it does', async () => {
		const before = arcadeRun({ heat: 99 });
		const expected = previewPlacement(before, 0, CENTER);
		expect(expected?.overload).toBe(true);
		expect(expected?.overloadAfterTurn).toBe(true);
		initGame({ run: before });
		render(RunScreen);

		await fireEvent.click(screen.getByRole('button', { name: /hydrogen card 1/i }));
		await fireEvent.click(screen.getByRole('button', { name: /^cell 12,/i }));

		const dialog = screen.getByRole('dialog', { name: /placement preview/i });
		expect(within(dialog).getByRole('alert')).toHaveTextContent(/overload/i);
		expect(within(dialog).getByTestId('preview-heat')).toHaveTextContent('100');

		await fireEvent.click(within(dialog).getByRole('button', { name: /confirm/i }));

		expect(screen.getByRole('alert')).toHaveTextContent(/overload/i);
		expect(screen.getByRole('button', { name: /stabilize/i })).toBeDisabled();
		expect(screen.getByRole('button', { name: /scrap tile/i })).toBeDisabled();
	});

	it('warns when the end-of-turn passive Heat crosses the cap', async () => {
		const before = arcadeRun({ heat: 95, grid: gridWith([[13, 'H']]) });
		const expected = previewPlacement(before, 0, CENTER)!;
		expect(expected.heatAfter).toBe(97);
		expect(expected.overload).toBe(false);
		expect(expected.heatAfterTurn).toBe(100);
		expect(expected.overloadAfterTurn).toBe(true);
		initGame({ run: before });
		render(RunScreen);

		await fireEvent.click(screen.getByRole('button', { name: /hydrogen card 1/i }));
		await fireEvent.click(screen.getByRole('button', { name: /^cell 12,/i }));

		const dialog = screen.getByRole('dialog', { name: /placement preview/i });
		expect(within(dialog).getByTestId('preview-heat')).toHaveTextContent('100 / 100');
		expect(within(dialog).getByTestId('preview-chain-heat')).toHaveTextContent('97');
		expect(within(dialog).getByRole('alert')).toHaveTextContent(/overload/i);

		await fireEvent.click(within(dialog).getByRole('button', { name: /confirm/i }));

		expect(screen.getByRole('meter', { name: /heat/i })).toHaveAttribute('aria-valuenow', '100');
		expect(screen.getByRole('alert')).toHaveTextContent(/overload/i);
		expect(screen.getByRole('button', { name: /stabilize/i })).toBeDisabled();
	});

	it('disables Scrap once the per-turn limit is spent', () => {
		initGame({ run: arcadeRun({ scrapsUsed: 1 }) });
		render(RunScreen);

		expect(screen.getByRole('button', { name: /stabilize/i })).toBeEnabled();
		expect(screen.getByRole('button', { name: /scrap tile/i })).toBeDisabled();
	});

	it('disables Stabilize with an empty hand', () => {
		initGame({ run: arcadeRun({ hand: [] }) });
		render(RunScreen);

		expect(screen.getByRole('button', { name: /^cell 12,/i })).toHaveTextContent('empty');
		expect(screen.getByRole('button', { name: /stabilize/i })).toBeDisabled();
	});

	it('disables both actions while an upgrade draft is pending', () => {
		initGame({ run: arcadeRun({ pendingDrafts: 1 }) });
		render(RunScreen);

		expect(screen.getByRole('button', { name: /stabilize/i })).toBeDisabled();
		expect(screen.getByRole('button', { name: /scrap tile/i })).toBeDisabled();
		expect(screen.getByRole('button', { name: /hydrogen card 1/i })).toBeDisabled();
	});

	it('scraps a tile by selecting Scrap and tapping the tile', async () => {
		initGame({ run: arcadeRun() });
		render(RunScreen);

		await fireEvent.click(screen.getByRole('button', { name: /scrap tile/i }));
		expect(screen.getByRole('button', { name: /scrap tile/i })).toHaveAttribute(
			'aria-pressed',
			'true'
		);

		await fireEvent.click(screen.getByRole('button', { name: /^cell 7,/i }));

		expect(screen.getByRole('button', { name: /^cell 7,/i })).toHaveTextContent('empty');
		expect(screen.getByRole('button', { name: /scrap tile/i })).toBeDisabled();
	});

	it('stabilizes with the tapped card when no card was selected', async () => {
		initGame({ run: arcadeRun({ heat: 20, turn: 5 }) });
		render(RunScreen);

		await fireEvent.click(screen.getByRole('button', { name: /stabilize/i }));
		await fireEvent.click(screen.getByRole('button', { name: /helium card 3/i }));

		expect(screen.queryByRole('button', { name: /helium card/i })).not.toBeInTheDocument();
		expect(screen.getByRole('meter', { name: /heat/i })).toHaveAttribute('aria-valuenow', '18');
		expect(screen.getByRole('region', { name: /score/i })).toHaveTextContent('0');
	});
});

describe('run screen drag', () => {
	it('drags a card onto a cell and commits exactly the live preview', async () => {
		const before = arcadeRun();
		const expected = previewPlacement(before, 0, CENTER)!;
		initGame({ run: before });
		render(RunScreen);

		const card = screen.getByRole('button', { name: /hydrogen card 1/i });
		const cell = screen.getByRole('button', { name: /^cell 12,/i });

		await fireEvent.pointerDown(card, DRAG_START);
		expect(document.querySelector('[data-drag-ghost]')).not.toBeNull();
		// Nothing is claimed until the pointer actually starts dragging.
		expect(document.body.style.touchAction).toBe('');

		await fireEvent.pointerMove(cell, DRAG_OVER);
		expect(document.body.style.touchAction).toBe('none');
		const live = screen.getByRole('dialog', { name: /placement preview/i });
		expect(within(live).getByTestId('preview-score')).toHaveTextContent(`+${expected.scoreGain}`);
		expect(within(live).getByTestId('preview-heat')).toHaveTextContent(
			String(expected.heatAfterTurn)
		);

		await fireEvent.pointerUp(cell, DRAG_OVER);

		expect(document.querySelector('[data-drag-ghost]')).toBeNull();
		expect(document.body.style.touchAction).toBe('');
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: /^cell 12,/i })).toHaveTextContent('Neon');
		expect(screen.getByRole('button', { name: /^cell 7,/i })).toHaveTextContent('empty');
		expect(screen.getByRole('meter', { name: /heat/i })).toHaveAttribute(
			'aria-valuenow',
			String(expected.heatAfterTurn)
		);
		expect(screen.getByRole('region', { name: /score/i })).toHaveTextContent(
			String(expected.scoreGain)
		);
	});

	it('keeps the live preview in step while hovering another cell', async () => {
		const before = arcadeRun();
		const atCentre = previewPlacement(before, 0, CENTER)!;
		const atCorner = previewPlacement(before, 0, 18)!;
		expect(atCorner.scoreGain).not.toBe(atCentre.scoreGain);
		initGame({ run: before });
		render(RunScreen);

		const card = screen.getByRole('button', { name: /hydrogen card 1/i });
		await fireEvent.pointerDown(card, DRAG_START);

		await fireEvent.pointerMove(screen.getByRole('button', { name: /^cell 12,/i }), DRAG_OVER);
		expect(within(screen.getByRole('dialog')).getByTestId('preview-score')).toHaveTextContent(
			`+${atCentre.scoreGain}`
		);

		await fireEvent.pointerMove(screen.getByRole('button', { name: /^cell 18,/i }), {
			...DRAG_OVER,
			clientX: 220,
			clientY: 220
		});
		expect(within(screen.getByRole('dialog')).getByTestId('preview-score')).toHaveTextContent(
			`+${atCorner.scoreGain}`
		);

		await fireEvent.pointerUp(screen.getByRole('button', { name: /^cell 18,/i }), {
			...DRAG_OVER,
			clientX: 220,
			clientY: 220
		});

		expect(screen.getByRole('button', { name: /^cell 18,/i })).toHaveTextContent('Carbon');
		expect(screen.getByRole('button', { name: /^cell 12,/i })).toHaveTextContent('empty');
	});

	it('cancels when the pointer is released outside the board', async () => {
		initGame({ run: arcadeRun() });
		render(RunScreen);

		const card = screen.getByRole('button', { name: /hydrogen card 1/i });
		await fireEvent.pointerDown(card, DRAG_START);
		await fireEvent.pointerMove(screen.getByRole('button', { name: /^cell 12,/i }), DRAG_OVER);
		await fireEvent.pointerUp(document.body, { ...DRAG_OVER, clientX: 5, clientY: 5 });

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(document.querySelector('[data-drag-ghost]')).toBeNull();
		expect(screen.getByRole('button', { name: /^cell 12,/i })).toHaveTextContent('empty');
		expect(screen.getByRole('meter', { name: /heat/i })).toHaveAttribute('aria-valuenow', '10');
	});

	it('cancels a drag with a downward swipe', async () => {
		initGame({ run: arcadeRun() });
		render(RunScreen);

		const card = screen.getByRole('button', { name: /hydrogen card 1/i });
		await fireEvent.pointerDown(card, DRAG_START);
		await fireEvent.pointerMove(document.body, { ...DRAG_START, clientY: 460 });
		await fireEvent.pointerUp(document.body, { ...DRAG_START, clientY: 460 });

		expect(document.querySelector('[data-drag-ghost]')).toBeNull();
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: /^cell 12,/i })).toHaveTextContent('empty');
	});

	it('scraps a placed tile dragged off its cell', async () => {
		initGame({ run: arcadeRun() });
		render(RunScreen);

		const tile = screen.getByRole('button', { name: /^cell 7,/i });
		const away = screen.getByRole('button', { name: /^cell 0,/i });

		await fireEvent.pointerDown(tile, DRAG_START);
		await fireEvent.pointerMove(away, DRAG_OVER);
		await fireEvent.pointerUp(away, DRAG_OVER);

		expect(screen.getByRole('button', { name: /^cell 7,/i })).toHaveTextContent('empty');
		expect(screen.getByRole('button', { name: /scrap tile/i })).toBeDisabled();
		expect(screen.getByRole('meter', { name: /heat/i })).toHaveAttribute('aria-valuenow', '10');
	});

	it('commits the identical play under reduced motion', async () => {
		const before = arcadeRun();
		const expected = previewPlacement(before, 0, CENTER)!;
		initGame({ run: before, settings: { sound: true, reduceMotion: true } });
		render(RunScreen);

		await dragCardToCell(
			screen.getByRole('button', { name: /hydrogen card 1/i }),
			screen.getByRole('button', { name: /^cell 12,/i })
		);

		expect(screen.getByRole('button', { name: /^cell 12,/i })).toHaveTextContent('Neon');
		expect(screen.getByRole('meter', { name: /heat/i })).toHaveAttribute(
			'aria-valuenow',
			String(expected.heatAfterTurn)
		);
	});

	it('does not commit a release that was never previewed', async () => {
		initGame({ run: arcadeRun() });
		render(RunScreen);

		const card = screen.getByRole('button', { name: /hydrogen card 1/i });
		await fireEvent.pointerDown(card, DRAG_START);
		await fireEvent.pointerMove(screen.getByRole('button', { name: /^cell 12,/i }), DRAG_OVER);
		expect(screen.getByTestId('preview-result')).toHaveTextContent('Neon');

		// The pointer is released over another cell without ever previewing it.
		await fireEvent.pointerUp(screen.getByRole('button', { name: /^cell 18,/i }), {
			...DRAG_OVER,
			clientX: 220,
			clientY: 220
		});

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: /^cell 12,/i })).toHaveTextContent('empty');
		expect(screen.getByRole('button', { name: /^cell 18,/i })).toHaveTextContent('empty');
		expect(screen.getByRole('meter', { name: /heat/i })).toHaveAttribute('aria-valuenow', '10');
	});

	it('hides branch buttons in the drag dock and commits the default preview', async () => {
		const before = branchRun();
		const expected = previewPlacement(before, 0, CENTER)!;
		expect(expected.grid[CENTER]).toBe('Ne');
		initGame({ run: before });
		render(RunScreen);

		const card = screen.getByRole('button', { name: /carbon card 1/i });
		const cell = screen.getByRole('button', { name: /^cell 12,/i });
		await fireEvent.pointerDown(card, DRAG_START);
		await fireEvent.pointerMove(cell, DRAG_OVER);

		const dock = screen.getByRole('dialog', { name: /placement preview/i });
		expect(within(dock).queryAllByRole('button', { name: /→/ })).toHaveLength(0);
		expect(within(dock).queryByTestId('preview-option-1-0')).not.toBeInTheDocument();
		expect(within(dock).getByTestId('preview-score')).toHaveTextContent(`+${expected.scoreGain}`);

		await fireEvent.pointerUp(cell, DRAG_OVER);

		expect(screen.getByRole('button', { name: /^cell 12,/i })).toHaveTextContent('Neon');
		expect(screen.getByRole('region', { name: /score/i })).toHaveTextContent(
			String(expected.scoreGain)
		);
	});

	it('restores page scroll only after the last of two drags ends', async () => {
		initGame({ run: arcadeRun() });
		render(RunScreen);

		const first = screen.getByRole('button', { name: /hydrogen card 1/i });
		const second = screen.getByRole('button', { name: /helium card 3/i });
		const centre = screen.getByRole('button', { name: /^cell 12,/i });
		const corner = screen.getByRole('button', { name: /^cell 18,/i });

		await fireEvent.pointerDown(first, { pointerId: 1, button: 0, clientX: 20, clientY: 320 });
		await fireEvent.pointerMove(centre, { pointerId: 1, button: 0, clientX: 150, clientY: 140 });
		expect(document.body.style.touchAction).toBe('none');

		await fireEvent.pointerDown(second, { pointerId: 2, button: 0, clientX: 320, clientY: 320 });
		await fireEvent.pointerMove(corner, { pointerId: 2, button: 0, clientX: 220, clientY: 140 });
		expect(document.body.style.touchAction).toBe('none');

		await fireEvent.pointerUp(centre, { pointerId: 1, button: 0, clientX: 150, clientY: 140 });
		// One owner is still live, so scroll must stay locked.
		expect(document.body.style.touchAction).toBe('none');

		await fireEvent.pointerUp(corner, { pointerId: 2, button: 0, clientX: 220, clientY: 140 });
		expect(document.body.style.touchAction).toBe('');
	});

	it('keeps native scrolling for a horizontal swipe on the hand', async () => {
		initGame({ run: arcadeRun() });
		render(RunScreen);

		const card = screen.getByRole('button', { name: /hydrogen card 1/i });
		await fireEvent.pointerDown(card, { pointerId: 3, button: 0, clientX: 20, clientY: 320 });
		await fireEvent.pointerMove(card, { pointerId: 3, button: 0, clientX: 160, clientY: 326 });
		expect(document.body.style.touchAction).toBe('');

		await fireEvent.pointerUp(card, { pointerId: 3, button: 0, clientX: 160, clientY: 326 });

		expect(document.body.style.touchAction).toBe('');
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: /^cell 12,/i })).toHaveTextContent('empty');
	});
});

describe('run screen scroll handling', () => {
	it('leaves the resting board scrollable and claims it only during a vertical swipe', async () => {
		initGame({ run: arcadeRun() });
		render(RunScreen);

		const board = screen.getByRole('group', { name: /reactor board/i });
		const empty = screen.getByRole('button', { name: /^cell 0,/i });
		expect(board.style.touchAction).toBe('');

		await fireEvent.pointerDown(empty, { pointerId: 7, button: 0, clientX: 40, clientY: 320 });
		expect(board.style.touchAction).toBe('');

		// A short jitter stays below the movement threshold: native scroll.
		await fireEvent.pointerMove(empty, { pointerId: 7, button: 0, clientX: 40, clientY: 324 });
		expect(board.style.touchAction).toBe('');
		await fireEvent.pointerUp(empty, { pointerId: 7, button: 0, clientX: 40, clientY: 324 });
		expect(board.style.touchAction).toBe('');

		// A vertical swipe past the threshold claims the gesture...
		await fireEvent.pointerDown(empty, { pointerId: 8, button: 0, clientX: 40, clientY: 320 });
		await fireEvent.pointerMove(empty, { pointerId: 8, button: 0, clientX: 40, clientY: 300 });
		expect(board.style.touchAction).toBe('none');

		// ...and hands it back as soon as the pointer is released.
		await fireEvent.pointerUp(empty, { pointerId: 8, button: 0, clientX: 40, clientY: 300 });
		expect(board.style.touchAction).toBe('');
	});

	it('does not claim a horizontal press on the board', async () => {
		initGame({ run: arcadeRun() });
		render(RunScreen);

		const board = screen.getByRole('group', { name: /reactor board/i });
		const empty = screen.getByRole('button', { name: /^cell 0,/i });
		await fireEvent.pointerDown(empty, { pointerId: 9, button: 0, clientX: 40, clientY: 320 });
		await fireEvent.pointerMove(empty, { pointerId: 9, button: 0, clientX: 160, clientY: 322 });
		expect(board.style.touchAction).toBe('');
		await fireEvent.pointerUp(empty, { pointerId: 9, button: 0, clientX: 160, clientY: 322 });
	});

	it('cancels rather than scraps when a placed tile is swiped down', async () => {
		initGame({ run: arcadeRun() });
		render(RunScreen);

		const tile = screen.getByRole('button', { name: /^cell 7,/i });
		await fireEvent.pointerDown(tile, DRAG_START);
		await fireEvent.pointerMove(document.body, { ...DRAG_START, clientY: 400 });
		await fireEvent.pointerUp(document.body, { ...DRAG_START, clientY: 400 });

		expect(document.querySelector('[data-drag-ghost]')).toBeNull();
		expect(screen.getByRole('button', { name: /^cell 7,/i })).toHaveTextContent('Hydrogen');
		expect(screen.getByRole('button', { name: /scrap tile/i })).toBeEnabled();
	});

	it('still scraps a tile dragged horizontally off its cell', async () => {
		initGame({ run: arcadeRun() });
		render(RunScreen);

		const tile = screen.getByRole('button', { name: /^cell 7,/i });
		const away = screen.getByRole('button', { name: /^cell 0,/i });
		await fireEvent.pointerDown(tile, DRAG_START);
		await fireEvent.pointerMove(away, { ...DRAG_START, clientX: 200 });
		await fireEvent.pointerUp(away, { ...DRAG_START, clientX: 200 });

		expect(screen.getByRole('button', { name: /^cell 7,/i })).toHaveTextContent('empty');
		expect(screen.getByRole('button', { name: /scrap tile/i })).toBeDisabled();
	});
});

describe('run screen keyboard', () => {
	it('moves a ghost with the arrow keys and commits the preview on Enter', async () => {
		const before = arcadeRun();
		const expected = previewPlacement(before, 0, 6)!;
		initGame({ run: before });
		render(RunScreen);

		const card = screen.getByRole('button', { name: /hydrogen card 1/i });
		card.focus();
		await fireEvent.keyDown(card, { key: 'ArrowDown' });
		expect(screen.getByRole('button', { name: /^cell 5,/i })).toHaveAttribute('data-ghost', 'true');

		await fireEvent.keyDown(card, { key: 'ArrowRight' });
		const target = screen.getByRole('button', { name: /^cell 6,/i });
		expect(target).toHaveAttribute('data-ghost', 'true');

		const live = screen.getByRole('dialog', { name: /placement preview/i });
		expect(within(live).getByTestId('preview-score')).toHaveTextContent(`+${expected.scoreGain}`);
		expect(screen.getByRole('status')).toHaveTextContent(/preview/i);
		expect(screen.getByRole('status')).toHaveTextContent(/heat/i);

		await fireEvent.keyDown(card, { key: 'Enter' });

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: /^cell 6,/i })).toHaveTextContent('Helium');
		expect(screen.getByRole('button', { name: /^cell 7,/i })).toHaveTextContent('empty');
		expect(screen.getByRole('meter', { name: /heat/i })).toHaveAttribute(
			'aria-valuenow',
			String(expected.heatAfterTurn)
		);
	});

	it('commits with Space as well', async () => {
		const before = arcadeRun();
		const expected = previewPlacement(before, 0, 5)!;
		initGame({ run: before });
		render(RunScreen);

		const card = screen.getByRole('button', { name: /hydrogen card 1/i });
		card.focus();
		await fireEvent.keyDown(card, { key: 'ArrowDown' });
		await fireEvent.keyDown(card, { key: ' ' });

		expect(screen.getByRole('button', { name: /^cell 5,/i })).toHaveTextContent('Hydrogen');
		expect(screen.getByRole('meter', { name: /heat/i })).toHaveAttribute(
			'aria-valuenow',
			String(expected.heatAfterTurn)
		);
	});

	it('cancels the ghost placement with Escape', async () => {
		initGame({ run: arcadeRun() });
		render(RunScreen);

		const card = screen.getByRole('button', { name: /hydrogen card 1/i });
		card.focus();
		await fireEvent.keyDown(card, { key: 'ArrowDown' });
		await fireEvent.keyDown(card, { key: 'ArrowRight' });
		expect(screen.getByRole('dialog', { name: /placement preview/i })).toBeInTheDocument();

		await fireEvent.keyDown(card, { key: 'Escape' });

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(document.querySelector('[data-ghost]')).toBeNull();
		expect(screen.getByRole('button', { name: /^cell 6,/i })).toHaveTextContent('empty');
		expect(screen.getByRole('meter', { name: /heat/i })).toHaveAttribute('aria-valuenow', '10');
	});

	it('cancels with Escape while focus is inside the preview dock', async () => {
		initGame({ run: branchRun() });
		render(RunScreen);

		const card = screen.getByRole('button', { name: /carbon card 1/i });
		card.focus();
		await fireEvent.keyDown(card, { key: 'ArrowDown' });
		await fireEvent.keyDown(card, { key: 'ArrowRight' });

		const dock = screen.getByRole('dialog', { name: /placement preview/i });
		const option = within(dock).getByTestId('preview-option-1-0');
		option.focus();
		await fireEvent.keyDown(option, { key: 'Escape' });

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: /^cell 6,/i })).toHaveTextContent('empty');
		expect(screen.getByRole('button', { name: /^cell 7,/i })).toHaveTextContent('Hydrogen');
	});
});

describe('run screen branch choices', () => {
	it('lists every step option, previews the chosen branch, and commits it', async () => {
		const before = branchRun();
		const defaultPreview = previewPlacement(before, 0, CENTER, [0])!;
		const chosenPreview = previewPlacement(before, 0, CENTER, [2])!;
		expect(defaultPreview.grid[CENTER]).toBe('Ne');
		expect(chosenPreview.grid[CENTER]).toBe('Fe');
		initGame({ run: before });
		render(RunScreen);

		await fireEvent.click(screen.getByRole('button', { name: /carbon card 1/i }));
		await fireEvent.click(screen.getByRole('button', { name: /^cell 12,/i }));

		const dialog = screen.getByRole('dialog', { name: /placement preview/i });
		const options = within(dialog).getAllByRole('button', { name: /→/i });
		expect(options).toHaveLength(3);
		expect(within(dialog).getByRole('button', { name: /hydrogen.*neon/i })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		expect(within(dialog).getByTestId('preview-result')).toHaveTextContent('Neon');
		expect(within(dialog).getByTestId('preview-score')).toHaveTextContent(
			`+${defaultPreview.scoreGain}`
		);

		await fireEvent.click(within(dialog).getByRole('button', { name: /sodium.*iron/i }));

		expect(within(dialog).getByRole('button', { name: /sodium.*iron/i })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		expect(within(dialog).getByTestId('preview-result')).toHaveTextContent('Iron');
		expect(within(dialog).getByTestId('preview-score')).toHaveTextContent(
			`+${chosenPreview.scoreGain}`
		);
		expect(within(dialog).getByTestId('preview-heat')).toHaveTextContent(
			String(chosenPreview.heatAfterTurn)
		);

		await fireEvent.click(within(dialog).getByRole('button', { name: /confirm/i }));

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: /^cell 12,/i })).toHaveTextContent('Iron');
		expect(screen.getByRole('button', { name: /^cell 17,/i })).toHaveTextContent('empty');
		expect(screen.getByRole('button', { name: /^cell 7,/i })).toHaveTextContent('Hydrogen');
		expect(screen.getByRole('region', { name: /score/i })).toHaveTextContent(
			String(chosenPreview.scoreGain)
		);
		expect(screen.getByRole('meter', { name: /heat/i })).toHaveAttribute(
			'aria-valuenow',
			String(chosenPreview.heatAfterTurn)
		);
	});

	it('falls back to the first branch for an out-of-range choice', () => {
		const before = branchRun();
		const fallback = previewPlacement(before, 0, CENTER, [0])!;
		initGame({ run: before });

		place(0, CENTER, [99]);

		const state = get(save).run!;
		expect(state.grid).toEqual(fallback.grid);
		expect(state.score).toBe(fallback.scoreGain);
		expect(state.heat).toBe(fallback.heatAfterTurn);
	});

	it('opens the tap preview with focus on Confirm, not the branch buttons', async () => {
		initGame({ run: branchRun() });
		render(RunScreen);

		await fireEvent.click(screen.getByRole('button', { name: /carbon card 1/i }));
		await fireEvent.click(screen.getByRole('button', { name: /^cell 12,/i }));

		const dialog = screen.getByRole('dialog', { name: /placement preview/i });
		expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: /confirm/i }));
	});
});

describe('run screen choreography', () => {
	/** Confirm the tapped card at the centre cell through the modal preview. */
	async function confirmCentrePlacement(): Promise<void> {
		await fireEvent.click(screen.getByRole('button', { name: /hydrogen card 1/i }));
		await fireEvent.click(screen.getByRole('button', { name: /^cell 12,/i }));
		const dialog = screen.getByRole('dialog', { name: /placement preview/i });
		await fireEvent.click(within(dialog).getByRole('button', { name: /confirm/i }));
	}

	it('lays one merge ghost per involved cell over a committed chain', async () => {
		const before = arcadeRun();
		const expected = previewPlacement(before, 0, CENTER)!;
		expect(expected.steps.length).toBeGreaterThan(1);
		initGame({ run: before });
		render(RunScreen);

		await confirmCentrePlacement();

		const layer = screen.getByTestId('chain-playback');
		expect(layer).toHaveAttribute('aria-hidden', 'true');
		expect(layer).toHaveAttribute('data-choreography', 'chain');
		// The layer must not participate in layout: absolutely positioned, inert.
		expect(layer.style.position).toBe('absolute');
		expect(layer.style.pointerEvents).toBe('none');

		const ghosts = within(layer).getAllByTestId('chain-ghost');
		const involved = new Set([CENTER, ...expected.steps.map((step) => step.cell)]);
		expect(ghosts).toHaveLength(involved.size);
		expect(new Set(ghosts.map((ghost) => Number(ghost.dataset.cell)))).toEqual(involved);

		// The result cell carries the surviving pop; consumed cells carry their step.
		const surviving = ghosts.find((ghost) => ghost.dataset.cell === String(CENTER));
		expect(surviving).toHaveClass('surviving');
		expect(surviving).toHaveAttribute('data-step', 'result');
		// The survivor starts as the placed card and steps through each result.
		expect(surviving).toHaveTextContent(before.hand[0]!);

		expected.steps.forEach((step, index) => {
			const ghost = ghosts.find((element) => element.dataset.cell === String(step.cell));
			expect(ghost).toHaveAttribute('data-step', String(index));
			expect(ghost).toHaveTextContent(before.grid[step.cell]!);
		});

		// The flown card is drawn as a proxy at the hand before the chain resolves.
		expect(within(layer).getByTestId('flight-ghost')).toHaveTextContent('H');
	});

	it('still flies the placed card when nothing fuses', async () => {
		initGame({ run: arcadeRun({ grid: gridWith([[0, 'H']]) }) });
		render(RunScreen);

		await confirmCentrePlacement();

		const layer = screen.getByTestId('chain-playback');
		const ghosts = within(layer).getAllByTestId('chain-ghost');
		expect(ghosts).toHaveLength(1);
		expect(ghosts[0]).toHaveClass('surviving');
		expect(ghosts[0]).toHaveAttribute('data-cell', String(CENTER));
		expect(within(layer).getByTestId('flight-ghost')).toHaveTextContent('H');
	});

	it('marks the score float and the heat tween for the playback', async () => {
		initGame({ run: arcadeRun() });
		render(RunScreen);

		await confirmCentrePlacement();

		const scoreSlot = screen.getByTestId('score-value').closest('[data-motion]');
		expect(scoreSlot).toHaveAttribute('data-motion', 'score');
		const heatSlot = screen.getByRole('meter', { name: /heat/i }).closest('[data-motion]');
		expect(heatSlot).toHaveAttribute('data-motion', 'heat');

		const layer = screen.getByTestId('chain-playback');
		expect(within(layer).getByTestId('score-float')).toHaveTextContent(
			`+${previewPlacement(arcadeRun(), 0, CENTER)!.scoreGain}`
		);
	});

	it('adds no motion layer and commits instantly under reduced motion', async () => {
		const before = arcadeRun();
		const expected = previewPlacement(before, 0, CENTER)!;
		initGame({ run: before, settings: { sound: true, reduceMotion: true } });
		render(RunScreen);

		await confirmCentrePlacement();

		expect(screen.queryByTestId('chain-playback')).not.toBeInTheDocument();
		expect(document.querySelector('[data-motion]')).toBeNull();
		expect(screen.getByRole('button', { name: /^cell 12,/i })).toHaveTextContent('Neon');
		expect(screen.getByRole('meter', { name: /heat/i })).toHaveAttribute(
			'aria-valuenow',
			String(expected.heatAfterTurn)
		);
	});

	it('cancels the previous playback when a new placement lands', async () => {
		initGame({
			run: arcadeRun({
				grid: gridWith([
					[2, 'H'],
					[21, 'H']
				]),
				hand: ['H', 'H', 'H'],
				deck: ['H']
			})
		});
		render(RunScreen);

		await fireEvent.click(screen.getByRole('button', { name: /hydrogen card 1/i }));
		await fireEvent.click(screen.getByRole('button', { name: /^cell 3,/i }));
		await fireEvent.click(
			within(screen.getByRole('dialog', { name: /placement preview/i })).getByRole('button', {
				name: /confirm/i
			})
		);

		const first = screen.getByTestId('chain-playback');
		expect(
			new Set(
				within(first)
					.getAllByTestId('chain-ghost')
					.map((ghost) => Number(ghost.dataset.cell))
			)
		).toEqual(new Set([2, 3]));

		// No input lock: the next placement is accepted while the first chain plays.
		await fireEvent.click(screen.getByRole('button', { name: /hydrogen card 1/i }));
		await fireEvent.click(screen.getByRole('button', { name: /^cell 22,/i }));
		await fireEvent.click(
			within(screen.getByRole('dialog', { name: /placement preview/i })).getByRole('button', {
				name: /confirm/i
			})
		);

		const layers = screen.getAllByTestId('chain-playback');
		expect(layers).toHaveLength(1);
		expect(
			new Set(
				within(layers[0])
					.getAllByTestId('chain-ghost')
					.map((ghost) => Number(ghost.dataset.cell))
			)
		).toEqual(new Set([21, 22]));
	});

	it('keeps the board rect stable while the playback layer is mounted', async () => {
		initGame({ run: arcadeRun() });
		render(RunScreen);

		const board = screen.getByRole('group', { name: /reactor board/i });
		const before = board.getBoundingClientRect();

		await confirmCentrePlacement();

		const layer = screen.getByTestId('chain-playback');
		expect(layer.contains(board)).toBe(false);
		const after = board.getBoundingClientRect();
		expect(after.width).toBe(before.width);
		expect(after.height).toBe(before.height);
		expect(after.left).toBe(before.left);
		expect(after.top).toBe(before.top);
	});

	it('flies a stabilized card into the discard pile when WAAPI is present', async () => {
		type Listener = () => void;
		const listeners: Listener[] = [];
		const animate = vi.fn(
			() =>
				({
					cancel: vi.fn(),
					addEventListener: (_type: string, listener: Listener) => listeners.push(listener)
				}) as unknown as Animation
		);
		const original = Object.getOwnPropertyDescriptor(Element.prototype, 'animate');
		Object.defineProperty(Element.prototype, 'animate', {
			configurable: true,
			writable: true,
			value: animate
		});
		initGame({ run: arcadeRun({ heat: 20, turn: 5 }) });
		render(RunScreen);

		try {
			await fireEvent.click(screen.getByRole('button', { name: /stabilize/i }));
			await fireEvent.click(screen.getByRole('button', { name: /helium card 3/i }));

			expect(animate).toHaveBeenCalled();
			const proxy = document.querySelector('.discard-ghost');
			expect(proxy).not.toBeNull();
			expect(proxy).toHaveTextContent('He');

			for (const listener of listeners) listener();
			expect(document.querySelector('.discard-ghost')).toBeNull();
		} finally {
			if (original) Object.defineProperty(Element.prototype, 'animate', original);
			else Reflect.deleteProperty(Element.prototype, 'animate');
		}
	});
});

describe('run screen swipes', () => {
	it('swipe up on the reactor opens a Stabilize picker that requires a card', async () => {
		initGame({ run: arcadeRun({ heat: 20, turn: 5 }) });
		render(RunScreen);

		const empty = screen.getByRole('button', { name: /^cell 0,/i });
		await fireEvent.pointerDown(empty, STABILIZE_DELTA);
		await fireEvent.pointerUp(empty, { ...STABILIZE_DELTA, clientY: 240 });

		const picker = screen.getByRole('dialog', { name: /^stabilize/i });
		expect(within(picker).getAllByRole('button', { name: /stabilize with/i })).toHaveLength(5);
		expect(screen.getByRole('meter', { name: /heat/i })).toHaveAttribute('aria-valuenow', '20');

		await fireEvent.click(within(picker).getByRole('button', { name: /stabilize with helium/i }));

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /helium card/i })).not.toBeInTheDocument();
		expect(screen.getByRole('meter', { name: /heat/i })).toHaveAttribute('aria-valuenow', '18');
	});

	it('does not open the Stabilize picker with an empty hand', async () => {
		initGame({ run: arcadeRun({ hand: [] }) });
		render(RunScreen);

		const empty = screen.getByRole('button', { name: /^cell 0,/i });
		await fireEvent.pointerDown(empty, STABILIZE_DELTA);
		await fireEvent.pointerUp(empty, { ...STABILIZE_DELTA, clientY: 240 });

		expect(screen.queryByRole('dialog', { name: /^stabilize/i })).not.toBeInTheDocument();
	});

	it('swipe down on the reactor cancels the current selection', async () => {
		initGame({ run: arcadeRun() });
		render(RunScreen);

		const card = screen.getByRole('button', { name: /hydrogen card 1/i });
		await fireEvent.click(card);
		expect(card).toHaveAttribute('aria-pressed', 'true');

		const empty = screen.getByRole('button', { name: /^cell 0,/i });
		await fireEvent.pointerDown(empty, { ...STABILIZE_DELTA, clientY: 200 });
		await fireEvent.pointerUp(empty, { ...STABILIZE_DELTA, clientY: 320 });

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(card).toHaveAttribute('aria-pressed', 'false');
		expect(screen.getByRole('button', { name: /^cell 12,/i })).toHaveTextContent('empty');
	});
});
