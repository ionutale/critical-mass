<script lang="ts">
	import { ELEMENT_BY_SYMBOL } from '../../data/elements';
	import type { ElementSymbol } from '../../types';

	let {
		grid,
		targets = null,
		disabled = false,
		onCell
	}: {
		grid: readonly (ElementSymbol | null)[];
		/** Empty cells that a selected card could land on. */
		targets?: readonly number[] | null;
		disabled?: boolean;
		onCell?: (cell: number) => void;
	} = $props();

	const CELL_COUNT = 25;

	const targetSet = $derived(new Set(targets ?? []));
</script>

<div class="board" role="group" aria-label="Reactor board">
	{#each Array.from({ length: CELL_COUNT }, (_, cell) => cell) as cell (cell)}
		{@const tile = grid[cell] ?? null}
		{@const record = tile ? ELEMENT_BY_SYMBOL.get(tile) : undefined}
		<button
			type="button"
			class="cell"
			class:filled={tile !== null}
			class:target={targetSet.has(cell)}
			aria-label={record
				? `cell ${cell}, ${record.name}, valence ${record.valence}, mass ${record.mass}`
				: `cell ${cell}, empty`}
			{disabled}
			onclick={() => onCell?.(cell)}
		>
			{#if tile && record}
				<span class="symbol" aria-hidden="true">{tile}</span>
				<span class="name" aria-hidden="true">{record.name}</span>
				<span class="stats" aria-hidden="true">V {record.valence} · M {record.mass}</span>
			{:else}
				<span class="void" aria-hidden="true">·</span>
				<span class="visually-hidden">empty</span>
			{/if}
		</button>
	{/each}
</div>

<style>
	.board {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 6px;
		padding: 10px;
		background: rgba(13, 20, 36, 0.7);
		border: 1px solid var(--line);
		border-radius: 12px;
		box-shadow: inset 0 0 26px rgba(56, 225, 255, 0.05);
	}

	.cell {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1px;
		min-width: 44px;
		min-height: 44px;
		aspect-ratio: 1;
		padding: 3px;
		color: var(--muted);
		background: rgba(56, 225, 255, 0.03);
		border: 1px dashed rgba(56, 225, 255, 0.2);
		border-radius: 6px;
		transition:
			border-color 120ms ease,
			box-shadow 120ms ease,
			background-color 120ms ease;
	}

	.cell.filled {
		background: var(--panel-2);
		border: 1px solid rgba(56, 225, 255, 0.55);
		box-shadow:
			inset 0 0 14px rgba(56, 225, 255, 0.18),
			0 0 10px rgba(56, 225, 255, 0.12);
	}

	.cell.target {
		border-color: var(--amber);
		box-shadow:
			inset 0 0 18px rgba(255, 179, 71, 0.3),
			0 0 14px rgba(255, 179, 71, 0.28);
	}

	.cell:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.symbol {
		font-family: 'JetBrains Mono Variable', ui-monospace, monospace;
		font-size: 18px;
		font-weight: 700;
		color: var(--cyan);
		text-shadow: 0 0 10px rgba(56, 225, 255, 0.5);
	}

	.name {
		max-width: 100%;
		font-size: 7px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.stats {
		font-family: 'JetBrains Mono Variable', ui-monospace, monospace;
		font-size: 7px;
		letter-spacing: 0.04em;
		color: var(--muted);
	}

	.void {
		font-size: 18px;
		color: rgba(143, 163, 194, 0.25);
	}
</style>
