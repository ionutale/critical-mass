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
		expect(document.body.style.touchAction).toBe('none');

		await fireEvent.pointerMove(cell, DRAG_OVER);
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
