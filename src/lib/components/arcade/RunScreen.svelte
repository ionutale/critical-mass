<script lang="ts">
	import { previewPlacement } from '../../game/arcade/fusion';
	import type { PlacementPreview } from '../../game/arcade/fusion';
	import { scrapLimit } from '../../game/arcade/turn';
	import { locked, place, run, save, scrap, stabilize } from '../../stores/arcade';
	import Board from './Board.svelte';
	import Hand from './Hand.svelte';
	import HeatBar from './HeatBar.svelte';
	import PreviewPanel from './PreviewPanel.svelte';
	import ScoreDisplay from './ScoreDisplay.svelte';

	type Mode = 'place' | 'stabilize' | 'scrap';

	let selected = $state<number | null>(null);
	let targetCell = $state<number | null>(null);
	let preview = $state<PlacementPreview | null>(null);
	let mode = $state<Mode>('place');

	const selectedCard = $derived(selected !== null ? ($run?.hand[selected] ?? null) : null);
	const handEmpty = $derived(!$run || $run.hand.length === 0);
	const scrapsSpent = $derived(!$run || $run.scrapsUsed >= scrapLimit($run));
	const targets = $derived.by(() => {
		if (selected === null || !$run) return null;
		return $run.grid.flatMap((tile, cell) => (tile === null ? [cell] : []));
	});
	const hint = $derived(
		mode === 'stabilize'
			? 'Choose a card to Stabilize.'
			: mode === 'scrap'
				? 'Choose a placed tile to Scrap.'
				: selected !== null
					? 'Choose an empty cell.'
					: 'Choose a card.'
	);

	function resetPreview(): void {
		preview = null;
		targetCell = null;
	}

	function chooseCard(index: number): void {
		if (!$run || $locked) return;

		if (mode === 'stabilize') {
			stabilize(index);
			mode = 'place';
			selected = null;
			resetPreview();
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

		const next = previewPlacement(state, selected, cell);
		if (!next) return;
		preview = next;
		targetCell = cell;
	}

	function toggleStabilize(): void {
		if (!$run || $locked || handEmpty) return;

		if (selected !== null) {
			stabilize(selected);
			mode = 'place';
			selected = null;
			resetPreview();
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

	function confirm(): void {
		if (!$run || $locked || selected === null || targetCell === null) return;
		place(selected, targetCell);
		mode = 'place';
		selected = null;
		resetPreview();
	}

	function cancel(): void {
		resetPreview();
	}
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

		<p class="hint" role="status">{hint}</p>

		<Board grid={$run.grid} {targets} disabled={$locked} onCell={chooseCell} />

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

		<Hand cards={$run.hand} {selected} disabled={$locked} onSelect={chooseCard} />

		<p class="counts mono">DECK {$run.deck.length} · DISCARD {$run.discard.length}</p>

		{#if $run.status === 'overload'}
			<p class="overload" role="alert">Overload! The reactor has melted down.</p>
		{/if}
	</main>

	{#if preview && selectedCard && targetCell !== null}
		<PreviewPanel
			{preview}
			card={selectedCard}
			cell={targetCell}
			heatCap={$run.heatCap}
			onConfirm={confirm}
			onCancel={cancel}
		/>
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
