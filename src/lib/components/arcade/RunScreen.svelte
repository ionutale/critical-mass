<script lang="ts">
	import { firstEmptyCell, stepCell } from '../../actions/arcadeDrag';
	import type { DragPlacementHandlers } from '../../actions/arcadeDrag';
	import { ELEMENT_BY_SYMBOL } from '../../data/elements';
	import { previewPlacement } from '../../game/arcade/fusion';
	import { scrapLimit } from '../../game/arcade/turn';
	import { locked, place, run, save, scrap, stabilize } from '../../stores/arcade';
	import Board from './Board.svelte';
	import Hand from './Hand.svelte';
	import HeatBar from './HeatBar.svelte';
	import PreviewPanel from './PreviewPanel.svelte';
	import ScoreDisplay from './ScoreDisplay.svelte';
	import StabilizePicker from './StabilizePicker.svelte';

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

	const hand = $derived($run?.hand ?? []);
	const activeIndex = $derived(dragIndex ?? selected);
	const activeCard = $derived(activeIndex === null ? null : (hand[activeIndex] ?? null));
	const preview = $derived.by(() => {
		if (!$run || activeIndex === null || targetCell === null) return null;
		return previewPlacement($run, activeIndex, targetCell, choices);
	});
	const handEmpty = $derived(hand.length === 0);
	const scrapsSpent = $derived(!$run || $run.scrapsUsed >= scrapLimit($run));
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
			stabilize(index);
			finishTurn();
			return;
		}

		mode = 'place';
		selected = selected === index ? null : index;
		resetPreview();
	}

	function chooseCell(cell: number): void {
		const state = $run;
		if (!state || $locked) return;

		if (mode === 'scrap') {
			if (state.grid[cell] == null) return;
			scrap(cell);
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
		if (!previewPlacement(state, index, cell, committedChoices)) {
			cancelPlacement();
			return;
		}

		place(index, cell, committedChoices);
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
			dragIndex = index;
			mode = 'place';
			ghost = null;
			targetCell = null;
			choices = [];
		},
		hover(cell) {
			if (dragIndex === null) return;
			if (cell === null || !$run || $run.grid[cell] != null) {
				targetCell = null;
				choices = [];
				return;
			}
			if (cell !== targetCell) {
				targetCell = cell;
				choices = [];
			}
		},
		commit(index, cell) {
			commitPlacement(index, cell);
		},
		cancel() {
			cancelPlacement();
		}
	};

	function scrapTile(cell: number): void {
		if (!$run || $locked || scrapsSpent) return;
		scrap(cell);
		mode = 'place';
		selected = null;
		clearPlacement();
	}

	function openStabilizePicker(): void {
		if (!$run || $locked || handEmpty) return;
		clearPlacement();
		pickerOpen = true;
	}

	function pickStabilize(index: number): void {
		pickerOpen = false;
		if (!$run || $locked) return;
		stabilize(index);
		finishTurn();
	}

	function toggleStabilize(): void {
		if (!$run || $locked || handEmpty) return;

		if (selected !== null) {
			stabilize(selected);
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
		dragIndex !== null
			? ('drag' as const)
			: ghost !== null
				? ('keyboard' as const)
				: ('modal' as const)
	);
</script>

{#if $run}
	<main class="app arcade-run">
		<header class="top">
			<div>
				<p class="kicker mono">REACTOR // TURN {$run.turn}</p>
				<h1>CRITICAL MASS</h1>
				<p class="seed mono">SEED {$run.seed}</p>
			</div>
			<ScoreDisplay score={$run.score} best={$save.meta.bestScore} runs={$save.meta.runs} />
		</header>

		<HeatBar heat={$run.heat} cap={$run.heatCap} />

		<p class="hint" role="status" aria-live="polite" data-testid="preview-live">{hint}</p>

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
				disabled={$locked || handEmpty}
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

		<Hand
			cards={$run.hand}
			{selected}
			disabled={$locked}
			onSelect={chooseCard}
			drag={dragHandlers}
			onKeyDown={onCardKey}
		/>

		<p class="counts mono">DECK {$run.deck.length} · DISCARD {$run.discard.length}</p>

		{#if $run.status === 'overload'}
			<p class="overload" role="alert">Overload! The reactor has melted down.</p>
		{/if}
	</main>

	{#if pickerOpen}
		<StabilizePicker cards={$run.hand} onPick={pickStabilize} onCancel={cancel} />
	{/if}
{/if}

<style>
	.arcade-run {
		gap: 10px;
	}

	.top {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 2px;
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
