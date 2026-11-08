import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { metaFixture } from '../test/fixtures';
import { initGame, run, save } from '../stores/game';
import HowToPlay from './HowToPlay.svelte';
import ResearchLab from './ResearchLab.svelte';
import SettingsScreen from './SettingsScreen.svelte';
import TitleScreen from './TitleScreen.svelte';

beforeEach(() => {
	window.localStorage.clear();
	initGame();
});

function titleProps() {
	return {
		onContinue: vi.fn(),
		onNewRun: vi.fn(),
		onResearch: vi.fn(),
		onSettings: vi.fn(),
		onHowTo: vi.fn()
	};
}

describe('title screen', () => {
	it('offers Continue for an active run', async () => {
		const props = titleProps();
		render(TitleScreen, { props });

		expect(screen.getByRole('button', { name: /continue run/i })).toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: /continue run/i }));
		expect(props.onContinue).toHaveBeenCalled();
	});

	it('offers New run when there is no run', () => {
		initGame({ run: null });
		render(TitleScreen, { props: titleProps() });

		expect(screen.queryByRole('button', { name: /continue run/i })).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: /new run/i })).toBeInTheDocument();
	});
});

describe('research lab', () => {
	it('buys an unlock with a confirmation and marks it owned', async () => {
		initGame({ meta: metaFixture({ research: 10 }) });
		render(ResearchLab, { props: { onBack: vi.fn() } });

		await fireEvent.click(screen.getByRole('button', { name: /unlock carbon stocks/i }));
		const dialog = screen.getByRole('dialog', { name: /confirm research purchase/i });
		expect(within(dialog).getByText(/3 RP/)).toBeInTheDocument();

		await fireEvent.click(within(dialog).getByRole('button', { name: /confirm purchase/i }));
		expect(get(save).meta.research).toBe(7);
		expect(get(save).meta.unlocks).toContain('card-carbon');
		expect(screen.getByRole('button', { name: /owned/i })).toBeDisabled();
	});

	it('disables an unaffordable node', () => {
		initGame({ meta: metaFixture({ research: 1 }) });
		render(ResearchLab, { props: { onBack: vi.fn() } });

		expect(screen.getAllByRole('button', { name: /not enough research/i })[0]).toBeDisabled();
	});
});

describe('settings', () => {
	it('toggles sound and reduced motion', async () => {
		initGame({ settings: { sound: true, reduceMotion: false } });
		render(SettingsScreen, { props: { onBack: vi.fn() } });

		await fireEvent.click(screen.getByRole('button', { name: /sound on/i }));
		expect(get(save).settings.sound).toBe(false);
		expect(screen.getByRole('button', { name: /sound off/i })).toHaveAttribute(
			'aria-pressed',
			'false'
		);

		await fireEvent.click(screen.getByRole('button', { name: /motion on/i }));
		expect(get(save).settings.reduceMotion).toBe(true);
	});

	it('resets the run only after a second confirmation', async () => {
		const onBack = vi.fn();
		render(SettingsScreen, { props: { onBack } });

		await fireEvent.click(screen.getByRole('button', { name: /^reset run$/i }));
		const dialog = screen.getByRole('dialog', { name: /confirm reset run/i });
		await fireEvent.click(within(dialog).getByRole('button', { name: /cancel/i }));
		expect(get(run)).not.toBeNull();

		await fireEvent.click(screen.getByRole('button', { name: /^reset run$/i }));
		await fireEvent.click(screen.getByRole('button', { name: /confirm reset run/i }));
		expect(get(run)).toBeNull();
		expect(onBack).toHaveBeenCalled();
	});

	it('resets all progress separately from the run', async () => {
		initGame({ meta: metaFixture({ research: 9, unlocks: ['card-carbon'] }) });
		render(SettingsScreen, { props: { onBack: vi.fn() } });

		await fireEvent.click(screen.getByRole('button', { name: /reset all progress/i }));
		await fireEvent.click(screen.getByRole('button', { name: /confirm reset all/i }));

		expect(get(run)).toBeNull();
		expect(get(save).meta.research).toBe(0);
		expect(get(save).meta.unlocks).toEqual([]);
	});
});

describe('how to play', () => {
	it('covers the loop without a carousel', () => {
		render(HowToPlay, { props: { onBack: vi.fn() } });

		for (const heading of [/the turn/i, /fusion/i, /pressure/i, /contracts/i, /preview/i]) {
			expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
		}
	});
});
