<script lang="ts">
	let {
		score,
		best,
		runs
	}: {
		score: number;
		best: number;
		/** Lifetime completed runs; omitted when the surface does not show it. */
		runs?: number;
	} = $props();
</script>

<section class="score" aria-label="Score">
	<p class="label mono">SCORE</p>
	<p class="value mono" data-testid="score-value" aria-live="polite">{score}</p>
	<p class="best mono">Best {best}</p>
	{#if runs !== undefined}
		<p class="runs mono">{runs} completed {runs === 1 ? 'run' : 'runs'}</p>
	{/if}
</section>

<style>
	.score {
		text-align: right;
	}

	.label {
		margin: 0;
		font-size: 8px;
		letter-spacing: 0.18em;
		color: var(--muted);
	}

	.value {
		margin: 0;
		font-size: 24px;
		font-weight: 700;
		line-height: 1.1;
		color: var(--cyan);
		font-variant-numeric: tabular-nums;
	}

	.best,
	.runs {
		margin: 0;
		font-size: 9px;
		letter-spacing: 0.06em;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
</style>
