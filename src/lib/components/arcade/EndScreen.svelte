<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { trapFocus } from '../../actions/trapFocus';
	import { UNLOCKS } from '../../data/arcade/unlocks';
	import { newRun, run, save } from '../../stores/arcade';
	import { reducedMotion, transitionDuration } from '../../stores/motion';

	let {
		onPlayAgain,
		onMenu
	}: {
		/** Called after the fresh run is installed, so the host can reset local state. */
		onPlayAgain?: () => void;
		onMenu?: () => void;
	} = $props();

	const score = $derived($run?.score ?? 0);
	const chain = $derived($run?.bestChain ?? 0);
	const unlocked = $derived($save.meta.unlocks.length);
	const total = UNLOCKS.length;
	const percent = $derived(total === 0 ? 0 : Math.round((unlocked / total) * 100));

	function playAgain(): void {
		newRun();
		onPlayAgain?.();
	}
</script>

<div class="backdrop" in:fade={{ duration: transitionDuration($reducedMotion, 200) }}>
	<div
		class="end"
		role="dialog"
		aria-modal="true"
		aria-labelledby="end-title"
		in:fly={{ y: 10, duration: transitionDuration($reducedMotion, 200) }}
		use:trapFocus={{ initialFocus: '.again' }}
	>
		<p class="kicker mono">REACTOR OVERLOAD // RUN OVER</p>
		<h2 id="end-title">Run over</h2>
		<p class="copy">The reactor melted down. Your best score, chains, and unlocks survived.</p>

		<dl class="stats">
			<div>
				<dt>Score</dt>
				<dd class="mono score" data-testid="final-score">{score}</dd>
			</div>
			<div>
				<dt>Best score</dt>
				<dd class="mono" data-testid="best-score">{$save.meta.bestScore}</dd>
			</div>
			<div>
				<dt>Chain</dt>
				<dd class="mono" data-testid="run-chain">{chain}</dd>
			</div>
			<div>
				<dt>Best chain</dt>
				<dd class="mono" data-testid="best-chain">{$save.meta.bestChain}</dd>
			</div>
			<div>
				<dt>Completed runs</dt>
				<dd class="mono" data-testid="runs">{$save.meta.runs}</dd>
			</div>
		</dl>

		<section class="unlocks" aria-label="Unlock progress">
			<p class="unlocks-copy mono" data-testid="unlock-progress">
				{unlocked} of {total} unlocks ({percent}%)
			</p>
			<div
				class="track"
				role="meter"
				aria-label="Unlocks earned"
				aria-valuemin="0"
				aria-valuemax={total}
				aria-valuenow={unlocked}
				aria-valuetext={`${unlocked} of ${total} unlocks`}
			>
				<div class="fill" style:width={`${percent}%`}></div>
			</div>
		</section>

		<div class="actions">
			<button class="again" type="button" onclick={playAgain}>Play again</button>
			{#if onMenu}
				<button type="button" onclick={onMenu}>Title</button>
			{/if}
		</div>
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 40;
		display: grid;
		place-items: center;
		padding: 22px;
		background: rgba(3, 6, 12, 0.88);
		backdrop-filter: blur(4px);
	}

	.end {
		width: min(380px, 100%);
		max-height: calc(100vh - 44px);
		max-height: calc(100dvh - 44px);
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: 22px;
		background: var(--panel);
		border: 1px solid var(--magenta);
		border-radius: 14px;
		box-shadow: 0 0 40px rgba(255, 79, 216, 0.24);
	}

	.kicker {
		margin: 0 0 6px;
		font-size: 9px;
		letter-spacing: 0.2em;
		color: var(--magenta);
	}

	h2 {
		font-size: 1.8rem;
	}

	.copy {
		margin: 8px 0 14px;
		font-size: 12px;
		line-height: 1.5;
		color: var(--muted);
	}

	.stats {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
		margin: 0 0 14px;
	}

	.stats div {
		padding: 8px 10px;
		background: var(--panel-2);
		border-radius: 6px;
	}

	dt {
		font-size: 8px;
		letter-spacing: 0.14em;
		color: var(--muted);
		text-transform: uppercase;
	}

	dd {
		margin: 2px 0 0;
		font-size: 16px;
		font-weight: 700;
		color: var(--text);
		font-variant-numeric: tabular-nums;
	}

	dd.score {
		color: var(--cyan);
	}

	.unlocks {
		margin-bottom: 16px;
	}

	.unlocks-copy {
		margin: 0 0 6px;
		font-size: 9px;
		letter-spacing: 0.1em;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}

	.track {
		height: 6px;
		overflow: hidden;
		background: var(--panel-2);
		border-radius: 999px;
	}

	.fill {
		height: 100%;
		background: linear-gradient(90deg, var(--cyan), var(--lime));
		border-radius: inherit;
	}

	.actions {
		display: grid;
		gap: 8px;
	}

	button {
		width: 100%;
		min-height: 44px;
		font-size: 13px;
		font-weight: 700;
		color: var(--text);
		background: var(--panel-2);
		border: 1px solid var(--line);
		border-radius: 8px;
	}

	button.again {
		color: var(--void);
		background: var(--magenta);
		border-color: var(--magenta);
	}
</style>
