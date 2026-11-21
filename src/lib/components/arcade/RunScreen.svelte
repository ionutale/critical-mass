<script lang="ts">
	import { untrack } from 'svelte';
	import { fly } from 'svelte/transition';
	import { get } from 'svelte/store';
	import { firstEmptyCell, stepCell } from '../../actions/arcadeDrag';
	import type { DragPlacementHandlers } from '../../actions/arcadeDrag';
	import { ELEMENT_BY_SYMBOL } from '../../data/elements';
	import { previewPlacement } from '../../game/arcade/fusion';
	import type { PlacementPreview } from '../../game/arcade/fusion';
	import { playSound } from '../../game/sound';
	import { scrapLimit } from '../../game/arcade/turn';
	import type { RunState } from '../../game/arcade/turn';
	import { locked, place, run, save, scrap, stabilize } from '../../stores/arcade';
	import { reducedMotion, transitionDuration } from '../../stores/motion';
	import Board from './Board.svelte';
	import ChainPlayback from './ChainPlayback.svelte';
	import { animationsAvailable, capturePlayback, boxOf, flyProxy } from './choreography';
	import type { PlaybackModel } from './choreography';
	import DraftOverlay from './DraftOverlay.svelte';
	import EndScreen from './EndScreen.svelte';
	import Hand from './Hand.svelte';
	import HeatBar from './HeatBar.svelte';
	import PreviewPanel from './PreviewPanel.svelte';
	import ParticleField from './ParticleField.svelte';
	import ScoreDisplay from './ScoreDisplay.svelte';
	import StabilizePicker from './StabilizePicker.svelte';

	let { onMenu }: { onMenu?: () => void } = $props();

	type Mode = 'place' | 'stabilize' | 'scrap';

	let selected = $state<number | null>(null);
	/** Card held by a pointer drag, separate from the tap selection. */
	let dragIndex = $state<number | null>(null);
	/** Cell under the pointer, or the keyboard ghost. */
	let targetCell = $state<number | null>(null);
	/** Keyboard ghost cursor; non-null only on the keyboard path. */
	let ghost = $state<number | null>(null);
	/** Per-step branch choices, indexed by 0-based chain step. */
	let choices = $state<number[]>([]);
	let mode = $state<Mode>('place');
	let pickerOpen = $state(false);
	/** True when a gesture ended on a branching play and the modal must confirm it. */
	let branchPrompt = $state(false);

	/** Chain playback mounted after a commit; a new placement replaces it. */
	let playback = $state<PlaybackModel | null>(null);
	let playbackId = 0;

	/** Restarts the board-local particle burst; 0 is the resting field. */
	let burst = $state(0);
	let particleMode = $state<'fusion' | 'meltdown'>('fusion');

	/**
	 * The End screen waits for the Overload surge so the shake and bar pulse are
	 * visible. Reduced motion (or no WAAPI) shows it immediately.
	 */
	let endReady = $state(false);

	$effect(() => {
		const status = $run?.status;
		if (status !== 'overload') {
			endReady = false;
			return;
		}
		if (motionEnabled()) {
			const delay = untrack(() => (playback?.overload ? 1200 : 250));
			const timer = setTimeout(() => {
				endReady = true;
			}, delay);
			return () => clearTimeout(timer);
		}
		endReady = true;
	});

	/** DOM nodes captured before a commit drives the playback. */
	let stageEl = $state<HTMLElement | null>(null);
	let handEl = $state<HTMLElement | null>(null);
	let heatEl = $state<HTMLElement | null>(null);
	let scoreEl = $state<HTMLElement | null>(null);
	let countsEl = $state<HTMLElement | null>(null);

	const hand = $derived($run?.hand ?? []);
	const activeIndex = $derived(dragIndex ?? selected);
	const activeCard = $derived(activeIndex === null ? null : (hand[activeIndex] ?? null));
	const preview = $derived.by(() => {
		if (!$run || activeIndex === null || targetCell === null) return null;
		return previewPlacement($run, activeIndex, targetCell, choices);
	});
	const scrapsSpent = $derived(!$run || $run.scrapsUsed >= scrapLimit($run));
	/** Playback markers: no playback means no `data-motion` attribute at all. */
	const scoreMotion = $derived(
		playback && playback.scoreTo > playback.scoreFrom ? 'score' : undefined
	);
	const heatMotion = $derived(playback ? 'heat' : undefined);
	const overloadMotion = $derived(playback?.overload ? 'overload' : undefined);
	const targets = $derived.by(() => {
		if (activeIndex === null || !$run) return null;
		return $run.grid.flatMap((tile, cell) => (tile === null ? [cell] : []));
	});
	const resultName = $derived.by(() => {
		if (!preview || targetCell === null || !activeCard) return '';
		const tile = preview.grid[targetCell] ?? activeCard;
		return ELEMENT_BY_SYMBOL.get(tile)?.name ?? tile;
	});
	const hint = $derived.by(() => {
		if (hand.length === 0) return 'Hand empty. Stabilize to pass the turn.';
		if (mode === 'stabilize') return 'Choose a card to Stabilize.';
		if (mode === 'scrap') return 'Choose a placed tile to Scrap.';
		if (preview && targetCell !== null) {
			const overload = preview.overloadAfterTurn ? ', overload' : '';
			return `Preview: ${resultName}, +${preview.scoreGain} points, heat ${preview.heatAfterTurn} of ${$run?.heatCap ?? 0}${overload}.`;
		}
		if (dragIndex !== null) return 'Drag onto an empty cell to place.';
		if (selected !== null) return 'Choose an empty cell, or use the arrow keys.';
		return 'Choose a card.';
	});

	function clearPlacement(): void {
		targetCell = null;
		ghost = null;
		choices = [];
		branchPrompt = false;
	}

	function finishTurn(): void {
		selected = null;
		dragIndex = null;
		clearPlacement();
		mode = 'place';
	}

	function resetPreview(): void {
		clearPlacement();
	}

	/** Motion runs only when the user allows it and the browser can animate. */
	function motionEnabled(): boolean {
		return !$reducedMotion && animationsAvailable();
	}

	/**
	 * True when any chain step offers more than one neighbour. A gesture must
	 * not silently commit the default branch: it opens the preview modal with
	 * the target already chosen so the player can pick the path.
	 */
	function hasBranches(result: PlacementPreview | null): boolean {
		return result !== null && result.steps.some((step) => step.options.length > 1);
	}

	/** Play the Overload cue only on the active → Overload transition. */
	function announceOverload(before: RunState | null): boolean {
		if (before?.status === 'overload') return false;
		if (get(run)?.status !== 'overload') return false;
		playSound('meltdown');
		emitBurst('meltdown');
		return true;
	}

	/** Kick one short particle burst behind the reactor. */
	function emitBurst(kind: 'fusion' | 'meltdown'): void {
		burst += 1;
		particleMode = kind;
	}

	/** Discard the Stabilize card with a flight into the discard counter. */
	function commitStabilize(handIndex: number): void {
		const state = $run;
		if (!state || $locked) return;
		const card = state.hand[handIndex];
		if (!card) return;

		if (motionEnabled()) {
			flyProxy({
				symbol: card,
				from: boxOf(handEl?.querySelectorAll<HTMLElement>('.cards > button')[handIndex]),
				to: countsEl
			});
		}

		stabilize(handIndex);
		playSound('vent');
		announceOverload(state);
	}

	/**
	 * Stabilize without a card: an empty hand is a pure pass, so the run can
	 * still advance into Overload instead of dead-locking. No picker opens.
	 */
	function stabilizePass(): void {
		const state = $run;
		if (!state || $locked) return;
		stabilize(0);
		playSound('vent');
		announceOverload(state);
		finishTurn();
	}

	function cancelPlacement(): void {
		dragIndex = null;
		clearPlacement();
	}

	function cancelAll(): void {
		selected = null;
		pickerOpen = false;
		finishTurn();
	}

	function chooseCard(index: number): void {
		if (!$run || $locked) return;

		if (mode === 'stabilize') {
			commitStabilize(index);
			finishTurn();
			return;
		}

		mode = 'place';
		selected = selected === index ? null : index;
		if (selected !== null) playSound('pick');
		resetPreview();
	}

	function chooseCell(cell: number): void {
		const state = $run;
		if (!state || $locked) return;

		if (mode === 'scrap') {
			if (state.grid[cell] == null) return;
			scrap(cell);
			playSound('contract');
			mode = 'place';
			return;
		}

		if (selected === null || state.grid[cell] != null) return;

		ghost = null;
		if (cell !== targetCell) choices = [];
		targetCell = cell;
	}

	/** Commit the play already shown by the live preview, with the same `choices`. */
	function commitPlacement(index: number, cell: number): void {
		const state = $run;
		if (!state || $locked || state.grid[cell] != null) {
			cancelPlacement();
			return;
		}

		if (cell !== targetCell) {
			targetCell = cell;
			choices = [];
		}

		const committedChoices = choices;
		const result = previewPlacement(state, index, cell, committedChoices);
		const placed = state.hand[index];
		if (!result || !placed) {
			cancelPlacement();
			return;
		}

		// Capture before the store commit: `place` resolves synchronously, so the
		// consumed tiles and the hand card are already gone when playback mounts.
		// A fresh placement replaces any chain still playing.
		const snapshot = motionEnabled()
			? capturePlayback({
					id: ++playbackId,
					stage: stageEl,
					hand: handEl,
					heat: heatEl,
					score: scoreEl,
					discard: countsEl,
					handIndex: index,
					cell,
					card: placed,
					grid: state.grid,
					handBefore: state.hand,
					finalGrid: result.grid,
					steps: result.steps,
					scoreFrom: state.score,
					scoreTo: state.score + result.scoreGain,
					heatFrom: state.heat,
					heatTo: result.heatAfterTurn,
					overload: result.overloadAfterTurn
				})
			: null;

		place(index, cell, committedChoices);
		playSound(result.steps.length > 0 ? 'fusion' : 'pick');
		if (!announceOverload(state) && result.steps.length > 0) emitBurst('fusion');
		playback = snapshot;
		finishTurn();
	}

	/** Clear a finished playback unless a newer placement already replaced it. */
	function finishPlayback(id: number): void {
		if (playback?.id === id) playback = null;
	}

	/** Play again installs a fresh run; drop every trace of the finished one. */
	function resetForNewRun(): void {
		playback = null;
		pickerOpen = false;
		burst = 0;
		particleMode = 'fusion';
		finishTurn();
	}

	function confirm(): void {
		if (activeIndex === null || targetCell === null) return;
		commitPlacement(activeIndex, targetCell);
	}

	function chooseOption(step: number, option: number): void {
		if (!$run || $locked) return;
		// Rebuilding the prefix keeps earlier branches and drops stale later ones.
		const next = Array.from({ length: step + 1 }, (_, index) => choices[index] ?? 0);
		next[step] = option;
		choices = next;
	}

	const dragHandlers: DragPlacementHandlers = {
		begin(index) {
			if ($locked) return;
			// A press that becomes a tap must keep the active Stabilize mode so the
			// click can commit it; only a real drag switches back to placement.
			dragIndex = index;
			ghost = null;
			targetCell = null;
			choices = [];
			if (mode !== 'stabilize') playSound('pick');
		},
		hover(cell) {
			if (dragIndex === null) return;
			if (cell === null || !$run || $run.grid[cell] != null) {
				targetCell = null;
				choices = [];
				return;
			}
			mode = 'place';
			if (cell !== targetCell) {
				targetCell = cell;
				choices = [];
			}
		},
		commit(index, cell) {
			const state = $run;
			if (!state || $locked || state.grid[cell] != null) {
				cancelPlacement();
				return;
			}

			// Hand the gesture's play to the modal when it offers a branch; a
			// drag-only player must still be able to choose the path.
			dragIndex = null;
			selected = index;
			if (cell !== targetCell) {
				targetCell = cell;
				choices = [];
			}
			const result = previewPlacement(state, index, cell, choices);
			if (hasBranches(result)) {
				branchPrompt = true;
				return;
			}

			commitPlacement(index, cell);
		},
		cancel() {
			cancelPlacement();
		}
	};

	function scrapTile(cell: number): void {
		if (!$run || $locked || scrapsSpent) return;
		scrap(cell);
		playSound('contract');
		mode = 'place';
		selected = null;
		clearPlacement();
	}

	function openStabilizePicker(): void {
		if (!$run || $locked) return;
		clearPlacement();
		if ($run.hand.length === 0) {
			stabilizePass();
			return;
		}
		pickerOpen = true;
	}

	function pickStabilize(index: number): void {
		pickerOpen = false;
		if (!$run || $locked) return;
		commitStabilize(index);
		finishTurn();
	}

	function toggleStabilize(): void {
		if (!$run || $locked) return;

		if ($run.hand.length === 0) {
			stabilizePass();
			return;
		}

		if (selected !== null) {
			commitStabilize(selected);
			finishTurn();
			return;
		}

		mode = mode === 'stabilize' ? 'place' : 'stabilize';
	}

	function toggleScrap(): void {
		if (!$run || $locked || scrapsSpent) return;
		mode = mode === 'scrap' ? 'place' : 'scrap';
		selected = null;
		resetPreview();
	}

	function cancel(): void {
		cancelAll();
	}

	function isArrow(key: string): boolean {
		return key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight';
	}

	/**
	 * Keyboard parity: the focused card owns a ghost on the board. Arrows move
	 * it (skipping tiles), Enter/Space commits the same preview, Escape cancels.
	 */
	function onCardKey(event: KeyboardEvent, index: number): void {
		const state = $run;
		if (!state || $locked || mode !== 'place') return;

		if (event.key === 'Escape') {
			if (targetCell !== null || ghost !== null || dragIndex !== null) {
				event.preventDefault();
				cancel();
			}
			return;
		}

		if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
			if (selected === index && targetCell !== null && preview) {
				event.preventDefault();
				// Branches get the modal too, so the keyboard path lands on the
				// option buttons instead of silently taking option 0.
				if (hasBranches(preview)) {
					branchPrompt = true;
					return;
				}
				commitPlacement(index, targetCell);
			}
			return;
		}

		if (!isArrow(event.key)) return;
		event.preventDefault();

		if (selected !== index) {
			selected = index;
			ghost = firstEmptyCell(state.grid);
			targetCell = ghost;
			choices = [];
			playSound('pick');
		}

		const from = ghost ?? firstEmptyCell(state.grid);
		if (from === null) {
			ghost = null;
			targetCell = null;
			return;
		}

		const next = stepCell(from, event.key, state.grid) ?? from;
		ghost = next;
		targetCell = next;
		if (next !== from) choices = [];
	}

	const previewMode = $derived(
		branchPrompt
			? ('modal' as const)
			: dragIndex !== null
				? ('drag' as const)
				: ghost !== null
					? ('keyboard' as const)
					: ('modal' as const)
	);
</script>

{#if $run}
	<main class="app arcade-run" in:fly={{ y: 8, duration: transitionDuration($reducedMotion, 180) }}>
		<header class="top">
			<div>
				<p class="kicker mono">REACTOR // TURN {$run.turn}</p>
				<h1>CRITICAL MASS</h1>
				<p class="seed mono">SEED {$run.seed}</p>
			</div>
			<div class="score-slot" bind:this={scoreEl} data-motion={scoreMotion}>
				{#if onMenu}
					<button class="menu" type="button" onclick={onMenu}>Menu</button>
				{/if}
				<ScoreDisplay score={$run.score} best={$save.meta.bestScore} runs={$save.meta.runs} />
			</div>
		</header>

		<div class="heat-slot" bind:this={heatEl} data-motion={heatMotion}>
			<HeatBar heat={$run.heat} cap={$run.heatCap} />
		</div>

		<p class="hint" role="status" aria-live="polite" data-testid="preview-live">{hint}</p>

		<div class="board-stage" bind:this={stageEl} data-motion={overloadMotion}>
			<ParticleField
				seed={$run.rngState}
				{burst}
				mode={particleMode}
				reducedMotion={$reducedMotion}
			/>
			<Board
				grid={$run.grid}
				{targets}
				{ghost}
				previewCell={targetCell}
				disabled={$locked}
				onCell={chooseCell}
				onSwipeUp={openStabilizePicker}
				onSwipeDown={cancel}
				onScrapTile={scrapTile}
			/>

			{#if playback}
				{@const current = playback}
				{#key current.id}
					<ChainPlayback
						playback={current}
						refs={{
							stage: stageEl,
							hand: handEl,
							heat: heatEl,
							score: scoreEl,
							discard: countsEl
						}}
						reducedMotion={$reducedMotion}
						onDone={() => finishPlayback(current.id)}
					/>
				{/key}
			{/if}
		</div>

		{#if preview && activeCard && targetCell !== null}
			<PreviewPanel
				{preview}
				card={activeCard}
				cell={targetCell}
				heatCap={$run.heatCap}
				mode={previewMode}
				onChoose={chooseOption}
				onConfirm={confirm}
				onCancel={cancel}
			/>
		{/if}

		<div class="actions">
			<button
				type="button"
				class="action"
				class:active={mode === 'stabilize'}
				aria-pressed={mode === 'stabilize'}
				disabled={$locked}
				onclick={toggleStabilize}
			>
				Stabilize
			</button>
			<button
				type="button"
				class="action"
				class:active={mode === 'scrap'}
				aria-pressed={mode === 'scrap'}
				disabled={$locked || scrapsSpent}
				onclick={toggleScrap}
			>
				Scrap tile
			</button>
		</div>

		<div class="hand-stage" bind:this={handEl}>
			<Hand
				cards={$run.hand}
				{selected}
				disabled={$locked}
				onSelect={chooseCard}
				drag={dragHandlers}
				onKeyDown={onCardKey}
			/>
		</div>

		<p class="counts mono" bind:this={countsEl}>
			DECK {$run.deck.length} · DISCARD {$run.discard.length}
		</p>

		{#if $run.status === 'overload'}
			<p
				class="overload"
				role="alert"
				in:fly={{ y: 6, duration: transitionDuration($reducedMotion, 220) }}
			>
				Overload! The reactor has melted down.
			</p>
		{/if}
	</main>

	{#if pickerOpen}
		<StabilizePicker cards={$run.hand} onPick={pickStabilize} onCancel={cancel} />
	{/if}

	{#if $run.status === 'overload'}
		{#if endReady}
			<EndScreen {onMenu} onPlayAgain={resetForNewRun} />
		{/if}
	{:else if $run.pendingDrafts > 0}
		<DraftOverlay />
	{/if}
{/if}

<style>
	.arcade-run {
		gap: 10px;
	}

	.board-stage {
		position: relative;
		isolation: isolate;
	}

	.top {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 2px;
	}

	.score-slot {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 4px;
	}

	.menu {
		min-height: 44px;
		padding: 0 12px;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.08em;
		color: var(--muted);
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: 7px;
	}

	@media (hover: hover) {
		.menu:hover {
			color: var(--text);
			border-color: rgba(56, 225, 255, 0.55);
		}
	}

	.kicker {
		margin: 0 0 4px;
		font-size: 9px;
		letter-spacing: 0.16em;
		color: var(--cyan);
	}

	h1 {
		font-size: clamp(1.6rem, 6.6vw, 2.4rem);
		letter-spacing: 0.02em;
	}

	.seed {
		margin: 2px 0 0;
		font-size: 8px;
		letter-spacing: 0.14em;
		color: var(--muted);
	}

	.hint {
		margin: 0;
		min-height: 1.2em;
		font-size: 10px;
		color: var(--muted);
	}

	.actions {
		display: flex;
		gap: 8px;
	}

	.action {
		flex: 1;
		min-height: 44px;
		font-size: 12px;
		font-weight: 700;
		color: var(--muted);
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: 7px;
		transition:
			transform 120ms ease,
			border-color 120ms ease,
			background-color 120ms ease;
	}

	@media (hover: hover) {
		.action:not(:disabled):hover {
			transform: translateY(-2px);
			border-color: rgba(56, 225, 255, 0.55);
		}
	}

	.action:not(:disabled):active {
		transform: scale(0.97);
	}

	.action.active {
		color: var(--void);
		background: var(--amber);
		border-color: var(--amber);
	}

	.action:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.counts {
		margin: 0;
		font-size: 8px;
		letter-spacing: 0.14em;
		text-align: right;
		color: var(--muted);
	}

	.overload {
		margin: 0;
		padding: 10px 12px;
		font-size: 13px;
		font-weight: 700;
		color: var(--danger);
		background: rgba(255, 91, 110, 0.08);
		border: 1px solid rgba(255, 91, 110, 0.45);
		border-radius: 8px;
	}
</style>
