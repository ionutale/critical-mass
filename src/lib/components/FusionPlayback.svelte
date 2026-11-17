<script lang="ts">
	import { onMount } from 'svelte';
	import { ELEMENT_BY_SYMBOL } from '../data/elements';
	import type { FusionStep } from '../game/fusion';

	let {
		steps,
		grid,
		originCell,
		reducedMotion,
		onDone
	}: {
		steps: FusionStep[];
		grid: (string | null)[];
		originCell: number;
		reducedMotion: boolean;
		onDone: () => void;
	} = $props();

	// The engine can chain up to 24 steps. Shrinking the stagger keeps the whole
	// path inside a fixed 700ms budget: for two steps it is 90ms, for eight or
	// more it is 700 / steps.length.
	const BUDGET = 700;
	const CELL_MS = 300;
	const stagger = $derived(steps.length > 0 ? Math.min(90, BUDGET / steps.length) : 0);
	const surviveDelay = $derived(steps.length * stagger);

	type Ghost = { cell: number; symbol: string; delay: number };

	// One ghost per consumed cell, in path order. Later steps can never repeat a
	// cell, but dedupe defensively so the ghost never stacks on itself.
	const ghosts = $derived.by<Ghost[]>(() => {
		const seen: number[] = [];
		const list: Ghost[] = [];

		steps.forEach((step, index) => {
			if (seen.includes(step.cell)) return;
			seen.push(step.cell);
			list.push({
				cell: step.cell,
				symbol: grid[step.cell] ?? step.b,
				delay: index * stagger
			});
		});

		return list;
	});

	onMount(() => {
		// A new placement unmounts this instance through its keyed block, which
		// clears this timer before the next chain starts.
		const timer = setTimeout(onDone, BUDGET + CELL_MS);
		return () => clearTimeout(timer);
	});
</script>

{#if !reducedMotion && steps.length > 0}
	<div class="ghost-layer" data-testid="fusion-playback" aria-hidden="true">
		{#each ghosts as ghost (ghost.cell)}
			<div
				class="ghost fusion-ghost"
				data-testid="fusion-ghost"
				data-cell={ghost.cell}
				style:grid-row={String(Math.floor(ghost.cell / 5) + 1)}
				style:grid-column={String((ghost.cell % 5) + 1)}
				style:animation-delay={`${ghost.delay}ms`}
			>
				<span class="symbol">
					{ELEMENT_BY_SYMBOL.get(ghost.symbol)?.symbol ?? ghost.symbol}
				</span>
			</div>
		{/each}

		<div
			class="ghost fusion-ghost surviving"
			data-testid="fusion-ghost"
			data-cell={originCell}
			style:grid-row={String(Math.floor(originCell / 5) + 1)}
			style:grid-column={String((originCell % 5) + 1)}
			style:animation-delay={`${surviveDelay}ms`}
		></div>
	</div>
{/if}

<style>
	/* Matches .reactor exactly: same 5 columns, gap, padding, and rows that fill
	   the reactor's content box, so every ghost lands on its real cell. */
	.ghost-layer {
		position: absolute;
		inset: 0;
		z-index: 2;
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		grid-template-rows: repeat(5, 1fr);
		gap: 6px;
		padding: 10px;
		pointer-events: none;
	}

	.ghost {
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid rgba(56, 225, 255, 0.45);
		border-radius: 6px;
		background: rgba(13, 20, 36, 0.82);
		box-shadow: inset 0 0 12px rgba(56, 225, 255, 0.18);
	}

	.symbol {
		font-family: 'JetBrains Mono Variable', monospace;
		font-size: 18px;
		font-weight: 700;
		color: var(--cyan);
		text-shadow: 0 0 10px rgba(56, 225, 255, 0.5);
	}

	.surviving {
		background: rgba(255, 179, 71, 0.08);
		border-color: var(--amber);
	}
</style>
