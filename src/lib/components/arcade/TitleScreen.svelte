<script lang="ts">
	import { fly } from 'svelte/transition';
	import { trapFocus } from '../../actions/trapFocus';
	import { UNLOCKS } from '../../data/arcade/unlocks';
	import { run, save } from '../../stores/arcade';
	import { reducedMotion, transitionDuration } from '../../stores/motion';

	let {
		hydrated = true,
		onPlay,
		onContinue,
		onHowTo,
		onUnlocks,
		onSettings
	}: {
		/** False on the first paint, before initGame() loads the saved settings. */
		hydrated?: boolean;
		onPlay: () => void;
		onContinue: () => void;
		onHowTo: () => void;
		onUnlocks: () => void;
		onSettings: () => void;
	} = $props();

	const active = $derived($run?.status === 'active');
	const unlocked = $derived($save.meta.unlocks.length);
	const total = UNLOCKS.length;

	/** A new run silently discarded the active one; ask first. */
	let confirming = $state(false);

	function requestNewRun(): void {
		if (active) {
			confirming = true;
			return;
		}
		onPlay();
	}

	function confirmAbandon(): void {
		confirming = false;
		onPlay();
	}
</script>

<main
	class="app title"
	in:fly|global={{ y: 10, duration: hydrated ? transitionDuration($reducedMotion, 200) : 0 }}
>
	<p class="kicker mono">REACTOR CONTROL // CORE ONLINE</p>
	<h1>CRITICAL MASS</h1>
	<p class="tagline">
		Fuse light elements, chain the reactor, and climb the score before the heat cap melts the run.
	</p>

	{#if $run}
		<p class="seed mono" data-testid="title-seed">SEED {$run.seed}</p>
	{/if}

	<div class="actions">
		{#if active}
			<button class="primary" type="button" onclick={onContinue}>Continue run</button>
			<button type="button" onclick={requestNewRun}>New run</button>
		{:else}
			<button class="primary" type="button" onclick={requestNewRun}>New run</button>
		{/if}
	</div>

	<div class="stats" aria-label="Lifetime stats">
		<div>
			<p class="stat-label mono">BEST SCORE</p>
			<p class="stat-value mono" data-testid="best-score">{$save.meta.bestScore}</p>
		</div>
		<div>
			<p class="stat-label mono">RUNS</p>
			<p class="stat-value mono">{$save.meta.runs}</p>
		</div>
		<div>
			<p class="stat-label mono">BEST CHAIN</p>
			<p class="stat-value mono">{$save.meta.bestChain}</p>
		</div>
	</div>

	<div class="menu">
		<button type="button" onclick={onHowTo}>How to play</button>
		<button type="button" onclick={onUnlocks}>
			<span>Unlocks</span>
			<span class="mono balance">{unlocked} of {total} unlocks</span>
		</button>
		<button type="button" onclick={onSettings}>
			<span>Settings</span>
			<span class="mono balance">Sound and motion</span>
		</button>
	</div>
</main>

{#if confirming}
	<div class="backdrop">
		<div
			class="confirm"
			role="dialog"
			aria-modal="true"
			aria-label="Abandon run"
			use:trapFocus={{ onEscape: () => (confirming = false) }}
		>
			<h2>Abandon this run?</h2>
			<p>
				Starting a new run discards seed {$run?.seed ?? '—'} and its board. Best scores and unlocks stay.
			</p>
			<div class="confirm-actions">
				<button class="danger" type="button" onclick={confirmAbandon}>Abandon run</button>
				<button type="button" onclick={() => (confirming = false)}>Keep playing</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.title {
		justify-content: center;
		text-align: left;
	}

	.kicker {
		margin: 0 0 8px;
		font-size: 9px;
		letter-spacing: 0.2em;
		color: var(--cyan);
	}

	h1 {
		font-size: clamp(2.2rem, 11vw, 4rem);
		line-height: 0.95;
		text-shadow: 0 0 30px rgba(56, 225, 255, 0.25);
	}

	.tagline {
		max-width: 36ch;
		margin: 12px 0 8px;
		font-size: 14px;
		line-height: 1.5;
		color: var(--muted);
	}

	.seed {
		margin: 0 0 18px;
		font-size: 9px;
		letter-spacing: 0.14em;
		color: var(--muted);
	}

	.actions {
		display: grid;
		gap: 8px;
		margin: 16px 0;
	}

	button {
		min-height: 44px;
		padding: 10px 12px;
		font-size: 13px;
		font-weight: 700;
		color: var(--text);
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: 8px;
	}

	button.primary {
		color: var(--void);
		background: var(--cyan);
		border-color: var(--cyan);
		box-shadow: 0 0 22px rgba(56, 225, 255, 0.22);
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
		margin-bottom: 16px;
	}

	.stats div {
		padding: 8px 10px;
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: 8px;
	}

	.stat-label {
		margin: 0;
		font-size: 8px;
		letter-spacing: 0.14em;
		color: var(--muted);
	}

	.stat-value {
		margin: 2px 0 0;
		font-size: 18px;
		font-weight: 700;
		color: var(--cyan);
		font-variant-numeric: tabular-nums;
	}

	.menu {
		display: grid;
		gap: 8px;
	}

	.menu button {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		text-align: left;
	}

	.balance {
		font-size: 9px;
		font-weight: 400;
		letter-spacing: 0.02em;
		color: var(--muted);
	}

	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 30;
		display: grid;
		place-items: center;
		padding: 22px;
		background: rgba(3, 6, 12, 0.8);
		backdrop-filter: blur(4px);
	}

	.confirm {
		width: min(340px, 100%);
		padding: 20px;
		background: var(--panel);
		border: 1px solid var(--danger);
		border-radius: 14px;
		box-shadow: 0 0 30px rgba(255, 91, 110, 0.18);
	}

	.confirm h2 {
		font-size: 1.3rem;
	}

	.confirm p {
		margin: 8px 0 16px;
		font-size: 12px;
		line-height: 1.5;
		color: var(--muted);
	}

	.confirm-actions {
		display: grid;
		gap: 8px;
	}

	.confirm-actions button {
		min-height: 44px;
	}

	.confirm-actions .danger {
		color: var(--void);
		background: var(--danger);
		border-color: var(--danger);
	}
</style>
