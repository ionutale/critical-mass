import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DRAFT_UPGRADE_BY_ID, UNLOCKS } from '../../data/arcade/unlocks';
import { generateDraft } from '../../game/arcade/draft';
import { createMeta } from '../../game/arcade/meta';
import { createRun } from '../../game/arcade/turn';
import type { RunState } from '../../game/arcade/turn';
import { initGame, run, save } from '../../stores/arcade';
import App from '../App.svelte';
import DraftOverlay from './DraftOverlay.svelte';
import EndScreen from './EndScreen.svelte';
import HowToPlay from './HowToPlay.svelte';
import RunScreen from './RunScreen.svelte';
import SettingsScreen from './SettingsScreen.svelte';
import TitleScreen from './TitleScreen.svelte';
import UnlocksScreen from './UnlocksScreen.svelte';

/** A deterministic run; overrides carry the case under test. */
function arcadeRun(overrides: Partial<RunState> = {}): RunState {
	return { ...createRun(7), heat: 10, ...overrides };
}

function titleProps() {
	return {
		onPlay: vi.fn(),
		onContinue: vi.fn(),
		onHowTo: vi.fn(),
		onUnlocks: vi.fn(),
		onSettings: vi.fn()
	};
}

beforeEach(() => {
	window.localStorage.clear();
	initGame();
});

describe('draft overlay', () => {
	it('shows the three deterministic options and commits the clicked one', async () => {
		const before = arcadeRun({ pendingDrafts: 1 });
		const options = generateDraft(before);
		initGame({ run: before });
		render(DraftOverlay);

		const dialog = screen.getByRole('dialog', { name: /upgrade draft/i });
		const buttons = within(dialog).getAllByRole('button');
		expect(buttons).toHaveLength(3);
		buttons.forEach((button, index) => {
			expect(button).toHaveTextContent(DRAFT_UPGRADE_BY_ID.get(options[index]!)!.name);
		});

		await fireEvent.click(buttons[1]);

		const after = get(run)!;
		expect(after.pendingDrafts).toBe(0);
		expect(after.upgrades).toEqual([options[1]]);
	});

	it('picks with the number keys', async () => {
		const before = arcadeRun({ pendingDrafts: 1 });
		const options = generateDraft(before);
		initGame({ run: before });
		render(DraftOverlay);

		await fireEvent.keyDown(window, { key: '3' });

		const after = get(run)!;
		expect(after.pendingDrafts).toBe(0);
		expect(after.upgrades).toEqual([options[2]]);
	});

	it('consumes one draft when a digit and a click land in the same task', () => {
		const before = arcadeRun({ pendingDrafts: 2 });
		initGame({ run: before });
		render(DraftOverlay);

		const buttons = screen.getAllByRole('button');
		// A focused option plus the window digit handler can deliver both in one
		// task; only the first activation may spend a pending draft.
		window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }));
		buttons[0]!.click();

		expect(get(run)!.pendingDrafts).toBe(1);
	});

	it('renders unlock-only bonus upgrades by name', async () => {
		const onPick = vi.fn();
		initGame({ run: arcadeRun({ pendingDrafts: 1 }) });
		render(DraftOverlay, {
			props: { options: ['add-n', 'add-mg', 'add-si'], onPick }
		});

		const buttons = screen.getAllByRole('button');
		expect(buttons[0]).toHaveTextContent('Nitrogen Stock');
		expect(buttons[0]).toHaveTextContent('Add 1 Nitrogen card');
		expect(buttons[1]).toHaveTextContent('Magnesium Stock');
		expect(buttons[2]).toHaveTextContent('Silicon Stock');

		await fireEvent.click(buttons[2]);
		expect(onPick).toHaveBeenCalledWith(2);
	});

	it('appears over the run and unlocks the board once chosen', async () => {
		initGame({ run: arcadeRun({ pendingDrafts: 1 }) });
		render(RunScreen);

		const dialog = screen.getByRole('dialog', { name: /upgrade draft/i });
		expect(within(dialog).getAllByRole('button')).toHaveLength(3);
		expect(screen.getByRole('button', { name: /stabilize/i })).toBeDisabled();

		await fireEvent.click(within(dialog).getAllByRole('button')[0]);

		expect(screen.queryByRole('dialog', { name: /upgrade draft/i })).not.toBeInTheDocument();
		expect(get(run)!.pendingDrafts).toBe(0);
		expect(screen.getByRole('button', { name: /stabilize/i })).toBeEnabled();
	});
});

describe('end screen', () => {
	it('shows the final score, bests, completed runs, and unlock progress', () => {
		initGame({
			run: arcadeRun({ status: 'overload', score: 321, bestChain: 4 }),
			meta: createMeta({
				bestScore: 500,
				totalScore: 900,
				runs: 7,
				bestChain: 5,
				unlocks: ['starter-carbon', 'starter-sodium']
			})
		});
		render(EndScreen, { props: { onPlayAgain: vi.fn() } });

		expect(screen.getByRole('dialog', { name: /run over/i })).toBeInTheDocument();
		expect(screen.getByTestId('final-score')).toHaveTextContent('321');
		expect(screen.getByTestId('best-score')).toHaveTextContent('500');
		expect(screen.getByTestId('best-chain')).toHaveTextContent('5');
		expect(screen.getByTestId('run-chain')).toHaveTextContent('4');
		expect(screen.getByText(/^completed runs$/i)).toBeInTheDocument();
		expect(screen.getByTestId('runs')).toHaveTextContent('7');
		expect(screen.getByTestId('unlock-progress')).toHaveTextContent('2 of 8 unlocks');
		expect(screen.getByTestId('unlock-progress')).toHaveTextContent('25%');
	});

	it('starts a fresh run from Play again', async () => {
		const onPlayAgain = vi.fn();
		initGame({
			run: arcadeRun({ status: 'overload', score: 321 }),
			meta: createMeta({ bestScore: 321, totalScore: 321, runs: 1, bestChain: 4 })
		});
		render(EndScreen, { props: { onPlayAgain } });

		await fireEvent.click(screen.getByRole('button', { name: /play again/i }));

		expect(onPlayAgain).toHaveBeenCalled();
		expect(get(run)!.status).toBe('active');
		expect(get(run)!.score).toBe(0);
		expect(get(save).meta.runs).toBe(1);
	});

	it('replaces the run screen and restores the board on Play again', async () => {
		initGame({ run: arcadeRun({ status: 'overload', score: 12 }) });
		render(RunScreen);

		expect(screen.getByRole('dialog', { name: /run over/i })).toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: /play again/i }));

		expect(screen.queryByRole('dialog', { name: /run over/i })).not.toBeInTheDocument();
		expect(screen.getByRole('group', { name: /reactor board/i })).toBeInTheDocument();
		expect(screen.getByTestId('score-value')).toHaveTextContent('0');
	});
});

describe('title screen', () => {
	it('shows the best score, unlock progress, and the current seed', () => {
		initGame({
			run: createRun(987),
			meta: createMeta({
				bestScore: 1234,
				runs: 7,
				bestChain: 5,
				unlocks: ['starter-carbon']
			})
		});
		render(TitleScreen, { props: titleProps() });

		expect(screen.getByTestId('best-score')).toHaveTextContent('1234');
		expect(screen.getByTestId('title-seed')).toHaveTextContent('987');
		expect(screen.getByText(/1 of 8 unlocks/i)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /continue run/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /new run/i })).toBeInTheDocument();
	});

	it('routes Play, How to play, Unlocks, and Settings', async () => {
		const props = titleProps();
		initGame({ run: createRun(42) });
		render(TitleScreen, { props });

		await fireEvent.click(screen.getByRole('button', { name: /new run/i }));
		expect(props.onPlay).toHaveBeenCalled();

		await fireEvent.click(screen.getByRole('button', { name: /continue run/i }));
		expect(props.onContinue).toHaveBeenCalled();

		await fireEvent.click(screen.getByRole('button', { name: /how to play/i }));
		expect(props.onHowTo).toHaveBeenCalled();

		await fireEvent.click(screen.getByRole('button', { name: /^unlocks/i }));
		expect(props.onUnlocks).toHaveBeenCalled();

		await fireEvent.click(screen.getByRole('button', { name: /^settings/i }));
		expect(props.onSettings).toHaveBeenCalled();
	});

	it('offers New run when there is no active run', () => {
		initGame({ run: null });
		render(TitleScreen, { props: titleProps() });

		expect(screen.queryByRole('button', { name: /continue run/i })).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: /new run/i })).toBeInTheDocument();
		expect(screen.queryByTestId('title-seed')).not.toBeInTheDocument();
	});
});

describe('unlocks screen', () => {
	it('shows every node with its threshold and locked or unlocked state', () => {
		initGame({
			meta: createMeta({
				totalScore: 150,
				bestChain: 2,
				runs: 1,
				unlocks: ['starter-carbon']
			})
		});
		render(UnlocksScreen, { props: { onBack: vi.fn() } });

		expect(screen.getByRole('heading', { name: /^unlocks$/i })).toBeInTheDocument();
		expect(screen.getByTestId('unlock-count')).toHaveTextContent('1 of 8 unlocked');

		const nodes = screen.getByRole('list', { name: /unlock nodes/i });
		const items = within(nodes).getAllByRole('listitem');
		expect(items).toHaveLength(UNLOCKS.length);

		UNLOCKS.forEach((unlock, index) => {
			const item = items[index]!;
			expect(item).toHaveTextContent(unlock.name);
			expect(within(item).getByTestId(`unlock-threshold-${unlock.id}`)).toHaveTextContent(
				String(unlock.threshold)
			);
		});

		expect(within(items[0]!).getByTestId('unlock-status-starter-carbon')).toHaveTextContent(
			'Unlocked'
		);
		expect(within(items[1]!).getByTestId('unlock-status-starter-sodium')).toHaveTextContent(
			'Locked'
		);
	});

	it('describes the metric a node reads and that unlocks are options', () => {
		initGame({ meta: createMeta({ totalScore: 150, bestChain: 2, runs: 1 }) });
		render(UnlocksScreen, { props: { onBack: vi.fn() } });

		const nodes = screen.getByRole('list', { name: /unlock nodes/i });
		const items = within(nodes).getAllByRole('listitem');
		expect(items[0]).toHaveTextContent(/100 total score/i);
		expect(items[1]).toHaveTextContent(/chain of 3/i);
		expect(items[2]).toHaveTextContent(/3 completed runs/i);
		expect(screen.getByText(/only add options/i)).toBeInTheDocument();
	});
});

describe('how to play', () => {
	it('states the valence rule with the H + H → He example', () => {
		render(HowToPlay, { props: { onBack: vi.fn() } });

		expect(screen.getByRole('heading', { name: /the valence rule/i })).toBeInTheDocument();
		expect(screen.getByTestId('valence-example')).toHaveTextContent('H + H → He');
		expect(screen.getByTestId('valence-example')).toHaveTextContent(
			/Hydrogen \+ Hydrogen → Helium/i
		);
	});

	it('covers heat, Stabilize, Scrap, milestones, and the controls', () => {
		render(HowToPlay, { props: { onBack: vi.fn() } });

		for (const heading of [/heat/i, /stabilize/i, /scrap/i, /milestones/i, /controls/i]) {
			expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
		}

		const controls = screen.getByRole('list', { name: /controls/i });
		const text = controls.textContent ?? '';
		for (const control of [
			/drag/i,
			/tap/i,
			/arrow/i,
			/enter/i,
			/escape/i,
			/swipe up/i,
			/swipe down/i
		]) {
			expect(text).toMatch(control);
		}
	});

	it('returns to the title through Back', async () => {
		const onBack = vi.fn();
		render(HowToPlay, { props: { onBack } });

		await fireEvent.click(screen.getByRole('button', { name: /back to title/i }));
		expect(onBack).toHaveBeenCalled();
	});
});

describe('settings screen', () => {
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

	it('resets all progress after a confirmation but keeps settings', async () => {
		const onBack = vi.fn();
		initGame({
			meta: createMeta({ bestScore: 50, runs: 2, unlocks: ['starter-carbon'] }),
			settings: { sound: false, reduceMotion: true }
		});
		render(SettingsScreen, { props: { onBack } });

		await fireEvent.click(screen.getByRole('button', { name: /reset all progress/i }));
		const dialog = screen.getByRole('dialog', { name: /confirm reset all progress/i });
		await fireEvent.click(within(dialog).getByRole('button', { name: /confirm reset all/i }));

		expect(get(save).meta).toEqual(createMeta());
		expect(get(save).settings).toEqual({ sound: false, reduceMotion: true });
		expect(get(run)).toBeNull();
		expect(onBack).toHaveBeenCalled();
	});
});

describe('app switchover', () => {
	it('mounts the arcade title, starts a run, and returns to the title', async () => {
		window.localStorage.clear();
		render(App);

		expect(screen.getByRole('heading', { name: /critical mass/i })).toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: /new run/i }));

		expect(screen.getByRole('group', { name: /reactor board/i })).toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: /^menu$/i }));

		expect(screen.getByRole('button', { name: /new run/i })).toBeInTheDocument();
	});
});
