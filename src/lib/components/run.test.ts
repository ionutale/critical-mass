import { fireEvent, render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import RunScreen from './RunScreen.svelte';
import { ELEMENTS } from '../data/elements';
import { RECIPES } from '../data/recipes';
import { previewPlacement } from '../game/fusion';
import { initGame } from '../stores/game';
import { emptyGrid, runFixture } from '../test/fixtures';

beforeEach(() => {
	window.localStorage.clear();
	initGame();
});

describe('run screen', () => {
	it('previews and confirms a fusion, then delivers the contract', async () => {
		render(RunScreen);

		await fireEvent.click(screen.getByRole('button', { name: /hydrogen card 1/i }));
		await fireEvent.click(screen.getByRole('button', { name: /cell 13/i }));

		const preview = screen.getByRole('dialog', { name: /preview/i });
		expect(preview).toHaveTextContent(/hydrogen/i);
		expect(preview).toHaveTextContent(/helium/i);

		await fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

		expect(screen.queryByRole('dialog', { name: /preview/i })).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: /cell 13/i })).toHaveTextContent('He');
		expect(screen.getByLabelText(/pressure 11 of 100/i)).toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: /deliver helium/i }));

		const draft = screen.getByRole('dialog', { name: /choose one upgrade/i });
		expect(draft).toBeInTheDocument();
		const options = within(draft).getAllByRole('button');
		expect(options).toHaveLength(3);

		await fireEvent.click(options[0]);
		expect(screen.queryByRole('dialog', { name: /choose one upgrade/i })).not.toBeInTheDocument();
		expect(screen.getByText(/contract 2\/5/i)).toBeInTheDocument();
	});

	it('chooses a fusion branch in the preview and commits that branch', async () => {
		const grid = emptyGrid();
		grid[7] = 'Be';
		grid[13] = 'C';
		grid[11] = 'He';
		const fixture = runFixture({ grid, hand: ['He'] });
		initGame({ run: fixture });
		render(RunScreen);

		await fireEvent.click(screen.getByRole('button', { name: /helium card 1/i }));
		await fireEvent.click(screen.getByRole('button', { name: /cell 12/i }));

		const preview = screen.getByRole('dialog', { name: /preview/i });
		const firstStep = within(preview).getByRole('group', { name: /step 1 options/i });
		const options = within(firstStep).getAllByRole('button');
		expect(options).toHaveLength(3);
		expect(options[0]).toHaveTextContent('Be → C');
		expect(options[0]).toHaveTextContent('+13');
		// The trap lands on the first option and every option is a real focusable
		// control, so keyboard users can Tab through the branches.
		for (const option of options) {
			expect(option).toBeEnabled();
			expect(option).toHaveAttribute('type', 'button');
		}
		expect(options[0]).toHaveFocus();
		expect(options[0]).toHaveAttribute('aria-pressed', 'true');
		expect(options[1]).toHaveAttribute('aria-pressed', 'false');
		expect(preview).toHaveTextContent(/final tile: O/i);

		await userEvent.tab();
		expect(options[1]).toHaveFocus();
		await userEvent.tab({ shift: true });
		expect(options[0]).toHaveFocus();

		await fireEvent.click(options[1]);

		const chosenStep = within(preview).getByRole('group', { name: /step 1 options/i });
		expect(within(chosenStep).getAllByRole('button')[1]).toHaveAttribute('aria-pressed', 'true');
		expect(preview).toHaveTextContent(/final tile: Ne/i);
		expect(preview).toHaveTextContent('+35');
		expect(within(preview).getAllByRole('group')).toHaveLength(2);

		const expected = previewPlacement(fixture, 0, 12, ELEMENTS, RECIPES, [1])!;
		await fireEvent.click(within(preview).getByRole('button', { name: /confirm/i }));

		expect(screen.queryByRole('dialog', { name: /preview/i })).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: /cell 12/i })).toHaveTextContent('Ne');
		expect(screen.getByRole('button', { name: /cell 11/i })).toHaveTextContent('·');
		expect(
			screen.getByLabelText(new RegExp(`pressure ${expected.pressureAfter} of 100`, 'i'))
		).toBeInTheDocument();
	});

	it('plays a staggered ghost chain after confirming a multi-step fusion', async () => {
		const grid = emptyGrid();
		grid[7] = 'Be';
		grid[13] = 'C';
		grid[11] = 'He';
		const fixture = runFixture({ grid, hand: ['He'] });
		initGame({ run: fixture });
		render(RunScreen);

		const expected = previewPlacement(fixture, 0, 12, ELEMENTS, RECIPES, [1])!;
		expect(expected.steps.length).toBeGreaterThan(1);

		await fireEvent.click(screen.getByRole('button', { name: /helium card 1/i }));
		await fireEvent.click(screen.getByRole('button', { name: /cell 12/i }));

		const preview = screen.getByRole('dialog', { name: /preview/i });
		const firstStep = within(preview).getByRole('group', { name: /step 1 options/i });
		await fireEvent.click(within(firstStep).getAllByRole('button')[1]);
		await fireEvent.click(within(preview).getByRole('button', { name: /confirm/i }));

		const layer = screen.getByTestId('fusion-playback');
		expect(layer).toHaveAttribute('aria-hidden', 'true');

		const ghosts = within(layer).getAllByTestId('fusion-ghost');
		const involved = new Set<number>([12, ...expected.steps.map((step) => step.cell)]);
		expect(ghosts).toHaveLength(involved.size);
		expect(new Set(ghosts.map((ghost) => Number(ghost.dataset.cell)))).toEqual(involved);

		// The surviving cell pulses; consumed cells merge on a shrinking stagger so
		// even an engine-max chain finishes inside the fixed budget.
		const surviving = ghosts.find((ghost) => ghost.dataset.cell === '12');
		expect(surviving).toHaveClass('surviving');

		const stagger = Math.min(90, 700 / expected.steps.length);
		expected.steps.forEach((step, index) => {
			const ghost = ghosts.find((element) => element.dataset.cell === String(step.cell));
			expect(ghost?.style.animationDelay).toBe(`${index * stagger}ms`);
		});
		expect(surviving?.style.animationDelay).toBe(`${expected.steps.length * stagger}ms`);
	});

	it('renders no ghost chain under reduced motion', async () => {
		const grid = emptyGrid();
		grid[7] = 'Be';
		grid[13] = 'C';
		grid[11] = 'He';
		initGame({
			run: runFixture({ grid, hand: ['He'] }),
			settings: { sound: true, reduceMotion: true }
		});
		render(RunScreen);

		await fireEvent.click(screen.getByRole('button', { name: /helium card 1/i }));
		await fireEvent.click(screen.getByRole('button', { name: /cell 12/i }));
		await fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

		expect(screen.queryByTestId('fusion-playback')).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: /cell 12/i })).toHaveTextContent('Oxygen');
	});

	it('cancels the previous playback when a new placement lands', async () => {
		const grid = emptyGrid();
		grid[2] = 'H';
		grid[21] = 'H';
		initGame({ run: runFixture({ grid, hand: ['H', 'H', 'H'] }) });
		render(RunScreen);

		await fireEvent.click(screen.getByRole('button', { name: /hydrogen card 1/i }));
		await fireEvent.click(screen.getByRole('button', { name: /cell 3/i }));
		await fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

		const first = screen.getByTestId('fusion-playback');
		expect(
			new Set(
				within(first)
					.getAllByTestId('fusion-ghost')
					.map((ghost) => Number(ghost.dataset.cell))
			)
		).toEqual(new Set([2, 3]));

		// No input lock: the next placement is accepted while the first chain plays.
		await fireEvent.click(screen.getByRole('button', { name: /hydrogen card 1/i }));
		await fireEvent.click(screen.getByRole('button', { name: /cell 22/i }));
		await fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

		const layers = screen.getAllByTestId('fusion-playback');
		expect(layers).toHaveLength(1);
		expect(
			new Set(
				within(layers[0])
					.getAllByTestId('fusion-ghost')
					.map((ghost) => Number(ghost.dataset.cell))
			)
		).toEqual(new Set([21, 22]));
	});

	it('cancels without changing the board', async () => {
		render(RunScreen);

		await fireEvent.click(screen.getByRole('button', { name: /hydrogen card 1/i }));
		await fireEvent.click(screen.getByRole('button', { name: /cell 13/i }));
		await fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

		expect(screen.queryByRole('dialog', { name: /preview/i })).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: /cell 13/i })).toHaveTextContent('·');
		expect(screen.getByLabelText(/pressure 0 of 100/i)).toBeInTheDocument();
	});

	it('does not fuse the center tile without a placement', () => {
		render(RunScreen);
		expect(screen.getByRole('button', { name: /cell 12/i })).toHaveTextContent('H');
	});

	it('vents pressure by discarding a card', async () => {
		render(RunScreen);

		await fireEvent.click(screen.getByRole('button', { name: /hydrogen card 1/i }));
		await fireEvent.click(screen.getByRole('button', { name: /cell 13/i }));
		await fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
		expect(screen.getByLabelText(/pressure 11 of 100/i)).toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: /vent/i }));
		expect(screen.getByRole('dialog', { name: /vent pressure/i })).toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: /hydrogen, discard 1/i }));

		expect(screen.getByLabelText(/pressure 0 of 100/i)).toBeInTheDocument();
	});

	it('keeps surviving cards mounted when a card leaves the hand', async () => {
		initGame({ run: runFixture({ hand: ['H', 'He', 'O', 'C', 'N'] }) });
		render(RunScreen);

		const helium = screen.getByRole('button', { name: /helium card 2/i });
		await fireEvent.click(screen.getByRole('button', { name: /vent/i }));
		await fireEvent.click(screen.getByRole('button', { name: /hydrogen, discard 1/i }));

		// Stable card identity is what lets `animate:flip` slide the survivors: the
		// helium card must be the same DOM node after it shifts to the first slot.
		expect(screen.getByRole('button', { name: /helium card 1/i })).toBe(helium);
	});

	it('scraps one tile per turn', async () => {
		render(RunScreen);

		await fireEvent.click(screen.getByRole('button', { name: /scrap tile/i }));
		await fireEvent.click(screen.getByRole('button', { name: /cell 12/i }));

		expect(screen.getByRole('button', { name: /cell 12/i })).toHaveTextContent('·');
		expect(screen.getByRole('button', { name: /scrap tile/i })).toBeDisabled();
	});

	it('opens a mandatory sector transition and free module draft', async () => {
		initGame({
			run: runFixture({
				sector: 1,
				contractId: 's1-5a',
				delivered: 1,
				pendingTransition: true,
				pressure: 40
			})
		});
		render(RunScreen);

		expect(screen.getByRole('dialog', { name: /sector 2/i })).toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: /enter sector 2/i }));

		expect(screen.getByRole('dialog', { name: /choose a free module/i })).toBeInTheDocument();
		expect(screen.getAllByRole('button', { name: /module/i })).toHaveLength(3);
	});

	it('shows the victory and meltdown end screens', () => {
		initGame({ run: runFixture({ status: 'victory', researchEarned: 4 }) });
		const { unmount } = render(RunScreen);
		const victory = screen.getByRole('dialog', { name: /victory/i });
		expect(victory).toBeInTheDocument();
		expect(within(victory).getByText('+4')).toBeInTheDocument();
		unmount();

		initGame({ run: runFixture({ status: 'meltdown', pressure: 100 }) });
		render(RunScreen);
		expect(screen.getByRole('alert')).toHaveTextContent(/meltdown/i);
	});
});
