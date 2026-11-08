<script lang="ts">
	import { run, save } from '../stores/game';

	let {
		onContinue,
		onNewRun,
		onResearch,
		onSettings,
		onHowTo
	}: {
		onContinue: () => void;
		onNewRun: () => void;
		onResearch: () => void;
		onSettings: () => void;
		onHowTo: () => void;
	} = $props();

	const hasRun = $derived(Boolean($run && $run.status === 'active'));
	const finished = $derived(Boolean($run && $run.status !== 'active'));
</script>

<main class="app title">
	<p class="kicker mono">REACTOR CONTROL // CORE ONLINE</p>
	<h1>CRITICAL MASS</h1>
	<p class="tagline">
		Climb the alpha ladder, deliver the contracts, and keep the reactor under the cap.
	</p>

	<div class="actions">
		{#if hasRun}
			<button class="primary" type="button" onclick={onContinue}>Continue run</button>
		{/if}
		<button class:primary={!hasRun} type="button" onclick={onNewRun}>New run</button>
	</div>

	{#if finished}
		<p class="finished" role="status">
			The last run ended in {$run?.status}. Start a new one when you are ready.
		</p>
	{/if}

	<div class="menu">
		<button type="button" onclick={onResearch}>
			<span>Research lab</span>
			<span class="mono balance">{$save.meta.research} RP</span>
		</button>
		<button type="button" onclick={onHowTo}>How to play</button>
		<button type="button" onclick={onSettings}>Settings</button>
	</div>

	<p class="stats mono">
		RUNS {$save.meta.stats.runs} // WINS {$save.meta.stats.wins} // BEST SECTOR {$save.meta.stats
			.bestSector}
	</p>
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
		max-width: 34ch;
		margin: 12px 0 22px;
		font-size: 14px;
		line-height: 1.5;
		color: var(--muted);
	}

	.actions {
		display: grid;
		gap: 8px;
		margin-bottom: 20px;
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

	.menu {
		display: grid;
		gap: 8px;
	}

	.menu button {
		display: flex;
		align-items: center;
		justify-content: space-between;
		text-align: left;
	}

	.balance {
		font-size: 10px;
		color: var(--lime);
	}

	.finished {
		margin: -10px 0 18px;
		font-size: 11px;
		color: var(--muted);
	}

	.stats {
		margin: 24px 0 0;
		font-size: 8px;
		letter-spacing: 0.14em;
		color: var(--muted);
	}
</style>
