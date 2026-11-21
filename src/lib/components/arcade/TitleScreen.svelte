<script lang="ts">
	import { fly } from 'svelte/transition';
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
</script>

<main
	class="app title"
	in:fly|global={{ y: 10, duration: hydrated ? transitionDuration($reducedMotion, 200) : 0 }}
>
	<p class="kicker mono">REACTOR CONTROL // CORE ONLINE</p>
	<h1>CRITICAL MASS</h1>
	<p class="tagline">
		Fuse the alpha ladder, chain the reactor, and climb the score before the heat cap melts the run.
	</p>

	{#if $run}
		<p class="seed mono" data-testid="title-seed">SEED {$run.seed}</p>
	{/if}

	<div class="actions">
		{#if active}
			<button class="primary" type="button" onclick={onContinue}>Continue run</button>
			<button type="button" onclick={onPlay}>New run</button>
		{:else}
			<button class="primary" type="button" onclick={onPlay}>New run</button>
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
</style>
