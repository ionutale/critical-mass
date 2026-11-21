import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { readFileSync } from 'node:fs';
import { mount, unmount } from 'svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { previewPlacement } from '../../game/arcade/fusion';
import { PASSIVE_HEAT } from '../../game/arcade/heat';
import { createRun } from '../../game/arcade/turn';
import type { RunState } from '../../game/arcade/turn';
import { initGame, place, save } from '../../stores/arcade';
import type { ElementSymbol } from '../../types';
import Board from './Board.svelte';
import ChainPlayback from './ChainPlayback.svelte';
import Hand from './Hand.svelte';
import HeatBar from './HeatBar.svelte';
import RunScreen from './RunScreen.svelte';
import ScoreDisplay from './ScoreDisplay.svelte';
import type { PlaybackModel } from './choreography';

const sound = vi.hoisted(() => ({
	playSound: vi.fn(() => true),
	setSoundEnabled: vi.fn(),
	resetSound: vi.fn(),
	setSoundContextFactory: vi.fn()
}));

vi.mock('../../game/sound', () => sound);

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
		// Stays below the 25 Heat milestone after a full centre chain + passive Heat.
		heat: 9,
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

/**
 * jsdom has no Web Animations API, and the choreography only mounts when it
 * exists. Stub it for the DOM-marker tests; return a restore for the original.
 */
function stubAnimations(): () => void {
	const animate = vi.fn(
		() =>
			({
				cancel: vi.fn(),
				addEventListener: vi.fn()
			}) as unknown as Animation
	);
	const original = Object.getOwnPropertyDescriptor(Element.prototype, 'animate');
	Object.defineProperty(Element.prototype, 'animate', {
		configurable: true,
		writable: true,
		value: animate
	});
	return () => {
		if (original) Object.defineProperty(Element.prototype, 'animate', original);
		else Reflect.deleteProperty(Element.prototype, 'animate');
	};
}

/** The playback model a committed centre placement would capture. */
function centrePlayback(run: RunState): PlaybackModel {
	const preview = previewPlacement(run, 0, CENTER)!;
	return {
		id: 99,
		originCell: CENTER,
		card: 'H',
		steps: preview.steps,
		ghosts: [
			...preview.steps.map((step, index) => ({
				cell: step.cell,
				step: index,
				symbol: run.grid[step.cell] ?? step.b,
				box: null,
				surviving: false
			})),
			{
				cell: CENTER,
				step: 'result' as const,
				symbol: preview.grid[CENTER] ?? 'Ne',
				box: null,
				surviving: true
			}
		],
		flight: null,
		discard: null,
		score: null,
		scoreFrom: run.score,
		scoreTo: run.score + preview.scoreGain,
		heatFrom: run.heat,
		heatTo: preview.heatAfterTurn,
		keptHand: run.hand.length - 1,
		overload: preview.overloadAfterTurn
	};
}

beforeEach(() => {
	window.localStorage.clear();
	initGame();
	sound.playSound.mockClear();
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
		expect(filled).toHaveAttribute('aria-label', expect.stringContaining('V 1'));
		expect(filled).toHaveAttribute('aria-label', expect.stringContaining('M 1'));
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

		const hydrogen = screen.getByRole('button', { name: /card 1,/i });
		expect(hydrogen).toHaveTextContent('Hydrogen');
		expect(hydrogen).toHaveTextContent('V 1');
		expect(hydrogen).toHaveTextContent('M 1');
		expect(hydrogen).toHaveAttribute('aria-label', expect.stringContaining('V 1'));
		expect(hydrogen).toHaveAttribute('aria-pressed', 'false');

		const helium = screen.getByRole('button', { name: /card 2,/i });
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
		expect(screen.getByRole('button', { name: /card 1,/i })).toHaveTextContent('Hydrogen');
		expect(screen.getByRole('meter', { name: /heat/i })).toHaveAttribute('aria-valuenow', '9');
		expect(screen.getByRole('region', { name: /score/i })).toHaveTextContent('0');
	});

	it('previews a placement from the engine and confirms it', async () => {
		const before = arcadeRun();
		const expected = previewPlacement(before, 0, CENTER);
		expect(expected).not.toBeNull();
		initGame({ run: before });
		render(RunScreen);

		await fireEvent.click(screen.getByRole('button', { name: /card 1,/i }));
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

		await fireEvent.click(screen.getByRole('button', { name: /card 1,/i }));
		await fireEvent.click(screen.getByRole('button', { name: /^cell 12,/i }));
		expect(screen.getByRole('dialog', { name: /placement preview/i })).toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: /^cell 12,/i })).toHaveTextContent('empty');
		expect(screen.getByRole('meter', { name: /heat/i })).toHaveAttribute('aria-valuenow', '9');
	});

	it('warns when a preview would overload and locks the run after it does', async () => {
		const before = arcadeRun({ heat: 99 });
		const expected = previewPlacement(before, 0, CENTER);
		expect(expected?.overload).toBe(true);
		expect(expected?.overloadAfterTurn).toBe(true);
		initGame({ run: before });
		render(RunScreen);

		await fireEvent.click(screen.getByRole('button', { name: /card 1,/i }));
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

		await fireEvent.click(screen.getByRole('button', { name: /card 1,/i }));
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

	it('allows Stabilize as a pure pass with an empty hand', async () => {
		initGame({ run: arcadeRun({ hand: [], deck: [], discard: [], heat: 20, turn: 5 }) });
		render(RunScreen);

		const stabilize = screen.getByRole('button', { name: /stabilize/i });
		expect(stabilize).toBeEnabled();

		await fireEvent.click(stabilize);

		// No picker and no discard: just the passive Heat and the next turn.
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(screen.getByRole('meter', { name: /heat/i })).toHaveAttribute(
			'aria-valuenow',
			String(20 + PASSIVE_HEAT)
		);
		expect(screen.getByText(/TURN 6/)).toBeInTheDocument();
		expect(stabilize).toBeEnabled();
	});

	it('reaches Overload from an empty hand by passing', async () => {
		initGame({
			run: arcadeRun({
				hand: [],
				deck: [],
				discard: [],
				heat: 96,
				turn: 23,
				milestonesCrossed: 3
			})
		});
		render(RunScreen);

		await fireEvent.click(screen.getByRole('button', { name: /stabilize/i }));

		expect(screen.getByRole('meter', { name: /heat/i })).toHaveAttribute('aria-valuenow', '100');
		expect(screen.getByRole('dialog', { name: /run over/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /stabilize/i })).toBeDisabled();
	});

	it('disables both actions while an upgrade draft is pending', () => {
		initGame({ run: arcadeRun({ pendingDrafts: 1 }) });
		render(RunScreen);

		expect(screen.getByRole('button', { name: /stabilize/i })).toBeDisabled();
		expect(screen.getByRole('button', { name: /scrap tile/i })).toBeDisabled();
		expect(screen.getByRole('button', { name: /card 1,/i })).toBeDisabled();
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
		const card = screen.getByRole('button', { name: /card 3,/i });
		// A real tap fires pointerdown before click. That press must not drop the
		// Stabilize mode and turn the tap into a placement selection.
		await fireEvent.pointerDown(card, STABILIZE_DELTA);
		await fireEvent.pointerUp(card, STABILIZE_DELTA);
		await fireEvent.click(card);

		expect(screen.queryByRole('button', { name: /card 3, He Helium/i })).not.toBeInTheDocument();
		expect(screen.getByRole('meter', { name: /heat/i })).toHaveAttribute(
			'aria-valuenow',
			String(PASSIVE_HEAT * 5 + PASSIVE_HEAT)
		);
		expect(screen.getByRole('region', { name: /score/i })).toHaveTextContent('0');
	});
});

describe('run screen drag', () => {
	it('drags a card onto a cell, then confirms the branching modal', async () => {
		const before = arcadeRun();
		const expected = previewPlacement(before, 0, CENTER)!;
		initGame({ run: before });
		render(RunScreen);

		const card = screen.getByRole('button', { name: /card 1,/i });
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

		// The release hands the branching chain to the modal instead of silently
		// committing option 0.
		await fireEvent.pointerUp(cell, DRAG_OVER);

		expect(document.querySelector('[data-drag-ghost]')).toBeNull();
		expect(document.body.style.touchAction).toBe('');
		const modal = screen.getByRole('dialog', { name: /placement preview/i });
		expect(within(modal).getAllByRole('button', { name: /→/i }).length).toBeGreaterThan(0);
		expect(screen.getByRole('button', { name: /^cell 12,/i })).toHaveTextContent('empty');

		await fireEvent.click(within(modal).getByRole('button', { name: /^confirm$/i }));

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

	it('commits a non-branching drag directly', async () => {
		// One fusable neighbour means one path: the release is the commit.
		const before = arcadeRun({ grid: gridWith([[7, 'H']]) });
		const expected = previewPlacement(before, 0, CENTER)!;
		expect(expected.steps[0]?.options).toHaveLength(1);
		initGame({ run: before });
		render(RunScreen);

		const card = screen.getByRole('button', { name: /card 1,/i });
		const cell = screen.getByRole('button', { name: /^cell 12,/i });
		await fireEvent.pointerDown(card, DRAG_START);
		await fireEvent.pointerMove(cell, DRAG_OVER);
		await fireEvent.pointerUp(cell, DRAG_OVER);

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: /^cell 12,/i })).toHaveTextContent('Helium');
		expect(screen.getByRole('meter', { name: /heat/i })).toHaveAttribute(
			'aria-valuenow',
			String(expected.heatAfterTurn)
		);
	});

	it('keeps the live preview in step while hovering another cell', async () => {
		const before = arcadeRun();
		const atCentre = previewPlacement(before, 0, CENTER)!;
		const atCorner = previewPlacement(before, 0, 18)!;
		expect(atCorner.scoreGain).not.toBe(atCentre.scoreGain);
		initGame({ run: before });
		render(RunScreen);

		const card = screen.getByRole('button', { name: /card 1,/i });
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

		// Releasing on a branch still requires the modal's confirmation.
		await fireEvent.click(
			within(screen.getByRole('dialog', { name: /placement preview/i })).getByRole('button', {
				name: /^confirm$/i
			})
		);

		expect(screen.getByRole('button', { name: /^cell 18,/i })).toHaveTextContent('Carbon');
		expect(screen.getByRole('button', { name: /^cell 12,/i })).toHaveTextContent('empty');
	});

	it('cancels when the pointer is released outside the board', async () => {
		initGame({ run: arcadeRun() });
		render(RunScreen);

		const card = screen.getByRole('button', { name: /card 1,/i });
		await fireEvent.pointerDown(card, DRAG_START);
		await fireEvent.pointerMove(screen.getByRole('button', { name: /^cell 12,/i }), DRAG_OVER);
		await fireEvent.pointerUp(document.body, { ...DRAG_OVER, clientX: 5, clientY: 5 });

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(document.querySelector('[data-drag-ghost]')).toBeNull();
		expect(screen.getByRole('button', { name: /^cell 12,/i })).toHaveTextContent('empty');
		expect(screen.getByRole('meter', { name: /heat/i })).toHaveAttribute('aria-valuenow', '9');
	});

	it('cancels a drag with a downward swipe', async () => {
		initGame({ run: arcadeRun() });
		render(RunScreen);

		const card = screen.getByRole('button', { name: /card 1,/i });
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
		expect(screen.getByRole('meter', { name: /heat/i })).toHaveAttribute('aria-valuenow', '9');
	});

	it('commits the identical play under reduced motion', async () => {
		const before = arcadeRun();
		const expected = previewPlacement(before, 0, CENTER)!;
		initGame({ run: before, settings: { sound: true, reduceMotion: true } });
		render(RunScreen);

		await dragCardToCell(
			screen.getByRole('button', { name: /card 1,/i }),
			screen.getByRole('button', { name: /^cell 12,/i })
		);
		// Reduced motion removes the choreography, not the branch choice.
		await fireEvent.click(
			within(screen.getByRole('dialog', { name: /placement preview/i })).getByRole('button', {
				name: /^confirm$/i
			})
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

		const card = screen.getByRole('button', { name: /card 1,/i });
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
		expect(screen.getByRole('meter', { name: /heat/i })).toHaveAttribute('aria-valuenow', '9');
	});

	it('opts a drag into the branch modal and commits a non-default path', async () => {
		const before = branchRun();
		const defaultPreview = previewPlacement(before, 0, CENTER)!;
		const chosenPreview = previewPlacement(before, 0, CENTER, [2])!;
		expect(defaultPreview.grid[CENTER]).toBe('Ne');
		expect(chosenPreview.grid[CENTER]).toBe('Fe');
		initGame({ run: before });
		render(RunScreen);

		const card = screen.getByRole('button', { name: /card 1,/i });
		const cell = screen.getByRole('button', { name: /^cell 12,/i });
		await fireEvent.pointerDown(card, DRAG_START);
		await fireEvent.pointerMove(cell, DRAG_OVER);

		// The live dock stays compact while the finger is down.
		const dock = screen.getByRole('dialog', { name: /placement preview/i });
		expect(within(dock).queryByTestId('preview-option-1-0')).not.toBeInTheDocument();
		expect(within(dock).getByTestId('preview-score')).toHaveTextContent(
			`+${defaultPreview.scoreGain}`
		);

		await fireEvent.pointerUp(cell, DRAG_OVER);

		// On release the modal exposes every branch and lands focus on the first
		// option, so the drag path can pick a non-default result.
		const modal = screen.getByRole('dialog', { name: /placement preview/i });
		const options = within(modal).getAllByRole('button', { name: /→/i });
		expect(options).toHaveLength(3);
		await fireEvent.click(within(modal).getByRole('button', { name: /sodium.*iron/i }));
		expect(within(modal).getByTestId('preview-result')).toHaveTextContent('Iron');
		expect(within(modal).getByTestId('preview-score')).toHaveTextContent(
			`+${chosenPreview.scoreGain}`
		);
		await fireEvent.click(within(modal).getByRole('button', { name: /^confirm$/i }));

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

	it('restores page scroll only after the last of two drags ends', async () => {
		initGame({ run: arcadeRun() });
		render(RunScreen);

		const first = screen.getByRole('button', { name: /card 1,/i });
		const second = screen.getByRole('button', { name: /card 3,/i });
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

		const card = screen.getByRole('button', { name: /card 1,/i });
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
		// One fusable neighbour: the preview has a single path, so Enter commits.
		const before = arcadeRun({ grid: gridWith([[7, 'H']]) });
		const expected = previewPlacement(before, 0, 6)!;
		expect(expected.steps[0]?.options).toHaveLength(1);
		initGame({ run: before });
		render(RunScreen);

		const card = screen.getByRole('button', { name: /card 1,/i });
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

		const card = screen.getByRole('button', { name: /card 1,/i });
		card.focus();
		await fireEvent.keyDown(card, { key: 'ArrowDown' });
		await fireEvent.keyDown(card, { key: ' ' });

		expect(screen.getByRole('button', { name: /^cell 5,/i })).toHaveTextContent('Hydrogen');
		expect(screen.getByRole('meter', { name: /heat/i })).toHaveAttribute(
			'aria-valuenow',
			String(expected.heatAfterTurn)
		);
	});

	it('opens the branch modal for the keyboard and commits the chosen path', async () => {
		const before = branchRun();
		const chosen = previewPlacement(before, 0, CENTER, [2])!;
		expect(chosen.grid[CENTER]).toBe('Fe');
		initGame({ run: before });
		render(RunScreen);

		const card = screen.getByRole('button', { name: /card 1,/i });
		card.focus();
		// Walk the ghost from 0 to the branchy centre cell 12.
		for (const key of ['ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowRight']) {
			await fireEvent.keyDown(card, { key });
		}

		const dock = screen.getByRole('dialog', { name: /placement preview/i });
		expect(within(dock).getByTestId('preview-result')).toHaveTextContent('Neon');

		await fireEvent.keyDown(card, { key: 'Enter' });

		// Enter must not commit option 0 silently: it opens the modal with focus
		// on the first branch button.
		const modal = screen.getByRole('dialog', { name: /placement preview/i });
		expect(document.activeElement).toBe(within(modal).getByTestId('preview-option-1-0'));
		expect(within(modal).getByText(/choose a branch/i)).toBeInTheDocument();

		await fireEvent.click(within(modal).getByRole('button', { name: /sodium.*iron/i }));
		expect(within(modal).getByTestId('preview-result')).toHaveTextContent('Iron');
		await fireEvent.click(within(modal).getByRole('button', { name: /^confirm$/i }));

		expect(screen.getByRole('button', { name: /^cell 12,/i })).toHaveTextContent('Iron');
		expect(screen.getByRole('region', { name: /score/i })).toHaveTextContent(
			String(chosen.scoreGain)
		);
		expect(screen.getByRole('meter', { name: /heat/i })).toHaveAttribute(
			'aria-valuenow',
			String(chosen.heatAfterTurn)
		);
	});

	it('cancels the ghost placement with Escape', async () => {
		initGame({ run: arcadeRun() });
		render(RunScreen);

		const card = screen.getByRole('button', { name: /card 1,/i });
		card.focus();
		await fireEvent.keyDown(card, { key: 'ArrowDown' });
		await fireEvent.keyDown(card, { key: 'ArrowRight' });
		expect(screen.getByRole('dialog', { name: /placement preview/i })).toBeInTheDocument();

		await fireEvent.keyDown(card, { key: 'Escape' });

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(document.querySelector('[data-ghost]')).toBeNull();
		expect(screen.getByRole('button', { name: /^cell 6,/i })).toHaveTextContent('empty');
		expect(screen.getByRole('meter', { name: /heat/i })).toHaveAttribute('aria-valuenow', '9');
	});

	it('cancels with Escape while focus is inside the preview dock', async () => {
		initGame({ run: branchRun() });
		render(RunScreen);

		const card = screen.getByRole('button', { name: /card 1,/i });
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

		await fireEvent.click(screen.getByRole('button', { name: /card 1,/i }));
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

	it('opens the tap preview with focus on the first branch option', async () => {
		initGame({ run: branchRun() });
		render(RunScreen);

		await fireEvent.click(screen.getByRole('button', { name: /card 1,/i }));
		await fireEvent.click(screen.getByRole('button', { name: /^cell 12,/i }));

		const dialog = screen.getByRole('dialog', { name: /placement preview/i });
		expect(document.activeElement).toBe(within(dialog).getByTestId('preview-option-1-0'));
	});

	it('focuses Confirm when the preview has no branches', async () => {
		initGame({ run: arcadeRun({ grid: gridWith([[7, 'H']]) }) });
		render(RunScreen);

		await fireEvent.click(screen.getByRole('button', { name: /card 1,/i }));
		await fireEvent.click(screen.getByRole('button', { name: /^cell 12,/i }));

		const dialog = screen.getByRole('dialog', { name: /placement preview/i });
		expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: /confirm/i }));
	});
});

describe('run screen choreography', () => {
	let restoreAnimations: (() => void) | null = null;

	beforeEach(() => {
		restoreAnimations = stubAnimations();
	});

	afterEach(() => {
		restoreAnimations?.();
		restoreAnimations = null;
	});

	/** Confirm the tapped card at the centre cell through the modal preview. */
	async function confirmCentrePlacement(): Promise<void> {
		await fireEvent.click(screen.getByRole('button', { name: /card 1,/i }));
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

	it('paints the placed card before the first frame, never the final fusion', () => {
		const playback = centrePlayback(arcadeRun());
		expect(playback.ghosts.at(-1)?.symbol).toBe('Ne');

		const target = document.createElement('div');
		document.body.appendChild(target);
		const component = mount(ChainPlayback, {
			target,
			props: {
				playback,
				refs: { stage: null, hand: null, heat: null, score: null, discard: null },
				reducedMotion: true,
				onDone: vi.fn()
			}
		});

		try {
			// `mount` returns before onMount flushes, so this is the first frame:
			// the survivor must not have fallen back to the committed result.
			const surviving = target.querySelector('.chain-ghost.surviving');
			expect(surviving).toHaveTextContent('H');
			expect(surviving).not.toHaveTextContent('Ne');
		} finally {
			unmount(component);
			target.remove();
		}
	});

	it('masks the committed origin cell under an opaque survivor', () => {
		const css = readFileSync('src/lib/styles/neon.css', 'utf8');
		const survivor = css.match(/\.chain-ghost\.surviving\s*\{([^}]*)\}/)?.[1] ?? '';
		const background = survivor.match(/background:\s*([^;]+);/)?.[1] ?? '';

		expect(background.trim()).toBe('var(--panel)');
		expect(background).not.toContain('rgba(');
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

	it('mounts no layer and commits instantly without the Web Animations API', async () => {
		Reflect.deleteProperty(Element.prototype, 'animate');
		const before = arcadeRun();
		const expected = previewPlacement(before, 0, CENTER)!;
		initGame({ run: before });
		render(RunScreen);

		await confirmCentrePlacement();

		expect(Element.prototype.animate).toBeUndefined();
		expect(screen.queryByTestId('chain-playback')).not.toBeInTheDocument();
		expect(document.querySelector('[data-motion]')).toBeNull();
		expect(screen.getByRole('button', { name: /^cell 12,/i })).toHaveTextContent('Neon');
		expect(screen.getByRole('meter', { name: /heat/i })).toHaveAttribute(
			'aria-valuenow',
			String(expected.heatAfterTurn)
		);
		expect(screen.getByTestId('score-value')).toHaveTextContent(String(expected.scoreGain));
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

		await fireEvent.click(screen.getByRole('button', { name: /card 1,/i }));
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
		await fireEvent.click(screen.getByRole('button', { name: /card 1,/i }));
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
			await fireEvent.click(screen.getByRole('button', { name: /card 3,/i }));

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

describe('run screen sound', () => {
	it('emits a pick cue on selection and a fusion cue on placement', async () => {
		initGame({ run: arcadeRun() });
		render(RunScreen);

		await fireEvent.click(screen.getByRole('button', { name: /card 1,/i }));
		expect(sound.playSound).toHaveBeenCalledWith('pick');

		await fireEvent.click(screen.getByRole('button', { name: /^cell 12,/i }));
		await fireEvent.click(
			within(screen.getByRole('dialog', { name: /placement preview/i })).getByRole('button', {
				name: /^confirm$/i
			})
		);

		expect(sound.playSound).toHaveBeenCalledWith('fusion');
		expect(sound.playSound).not.toHaveBeenCalledWith('meltdown');
	});

	it('emits a vent cue when Stabilize ends the turn', async () => {
		initGame({ run: arcadeRun({ heat: 40, turn: 5 }) });
		render(RunScreen);

		await fireEvent.click(screen.getByRole('button', { name: /^stabilize$/i }));
		await fireEvent.click(screen.getByRole('button', { name: /card 3,/i }));

		expect(sound.playSound).toHaveBeenCalledWith('vent');
	});

	it('emits a cue when a tile is scrapped', async () => {
		initGame({ run: arcadeRun() });
		render(RunScreen);

		await fireEvent.click(screen.getByRole('button', { name: /scrap tile/i }));
		await fireEvent.click(screen.getByRole('button', { name: /^cell 7,/i }));

		expect(sound.playSound).toHaveBeenCalledWith('contract');
	});

	it('emits the meltdown cue only when the placement overloads', async () => {
		initGame({ run: arcadeRun({ heat: 99 }) });
		render(RunScreen);

		await fireEvent.click(screen.getByRole('button', { name: /card 1,/i }));
		await fireEvent.click(screen.getByRole('button', { name: /^cell 12,/i }));
		await fireEvent.click(
			within(screen.getByRole('dialog', { name: /placement preview/i })).getByRole('button', {
				name: /^confirm$/i
			})
		);

		expect(sound.playSound).toHaveBeenCalledWith('fusion');
		expect(sound.playSound).toHaveBeenCalledWith('meltdown');
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
		expect(screen.getByRole('meter', { name: /heat/i })).toHaveAttribute(
			'aria-valuenow',
			String(PASSIVE_HEAT * 5 + PASSIVE_HEAT)
		);
	});

	it('swipe up with an empty hand passes the turn instead of opening the picker', async () => {
		initGame({ run: arcadeRun({ hand: [], deck: [], discard: [], heat: 20, turn: 5 }) });
		render(RunScreen);

		const empty = screen.getByRole('button', { name: /^cell 0,/i });
		await fireEvent.pointerDown(empty, STABILIZE_DELTA);
		await fireEvent.pointerUp(empty, { ...STABILIZE_DELTA, clientY: 240 });

		expect(screen.queryByRole('dialog', { name: /^stabilize/i })).not.toBeInTheDocument();
		expect(screen.getByRole('meter', { name: /heat/i })).toHaveAttribute(
			'aria-valuenow',
			String(20 + PASSIVE_HEAT)
		);
		expect(screen.getByText(/TURN 6/)).toBeInTheDocument();
	});

	it('swipe down on the reactor cancels the current selection', async () => {
		initGame({ run: arcadeRun() });
		render(RunScreen);

		const card = screen.getByRole('button', { name: /card 1,/i });
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
