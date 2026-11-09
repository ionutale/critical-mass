import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { beforeEach, describe, expect, it } from 'vitest';
import RunScreen from './RunScreen.svelte';
import { initGame } from '../stores/game';
import { runFixture } from '../test/fixtures';

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
		expect(screen.getByLabelText(/pressure 5 of 100/i)).toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: /deliver helium/i }));

		const draft = screen.getByRole('dialog', { name: /choose one upgrade/i });
		expect(draft).toBeInTheDocument();
		const options = within(draft).getAllByRole('button');
		expect(options).toHaveLength(3);

		await fireEvent.click(options[0]);
		expect(screen.queryByRole('dialog', { name: /choose one upgrade/i })).not.toBeInTheDocument();
		expect(screen.getByText(/contract 2\/5/i)).toBeInTheDocument();
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
		expect(screen.getByLabelText(/pressure 5 of 100/i)).toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: /vent/i }));
		expect(screen.getByRole('dialog', { name: /vent pressure/i })).toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: /hydrogen, discard 1/i }));

		expect(screen.getByLabelText(/pressure 0 of 100/i)).toBeInTheDocument();
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
