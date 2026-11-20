import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { previewPlacement } from '../../game/arcade/fusion';
import { createRun } from '../../game/arcade/turn';
import type { RunState } from '../../game/arcade/turn';
import { initGame } from '../../stores/arcade';
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
const FULL_HAND: ElementSymbol[] = ['H', 'Li', 'He', 'Be', 'Na'];

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
			String(expected!.heatAfter)
		);
		expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();

		await fireEvent.click(within(dialog).getByRole('button', { name: /confirm/i }));

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: /^cell 12,/i })).toHaveTextContent('Neon');
		expect(screen.getByRole('button', { name: /^cell 7,/i })).toHaveTextContent('empty');
		expect(screen.getByRole('meter', { name: /heat/i })).toHaveAttribute(
			'aria-valuenow',
			String(expected!.heatAfter + 3)
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
