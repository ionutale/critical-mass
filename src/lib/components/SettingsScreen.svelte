<script lang="ts">
	import { resetAll, resetRun, save, setSetting } from '../stores/game';

	let { onBack }: { onBack: () => void } = $props();

	let confirming = $state<'run' | 'all' | null>(null);

	function confirmRun(): void {
		resetRun();
		confirming = null;
		onBack();
	}

	function confirmAll(): void {
		resetAll();
		confirming = null;
		onBack();
	}
</script>

<main class="app settings">
	<header class="head">
		<div>
			<p class="kicker mono">REACTOR CONTROL // PREFERENCES</p>
			<h1>Settings</h1>
		</div>
		<button class="back" type="button" onclick={onBack}>Back to title</button>
	</header>

	<section class="group" aria-labelledby="audio-title">
		<h2 id="audio-title">Sound and motion</h2>
		<div class="row">
			<div>
				<p class="name">Sound</p>
				<p class="description">Reactor cues and confirmation tones.</p>
			</div>
			<button
				type="button"
				aria-pressed={$save.settings.sound}
				onclick={() => setSetting('sound', !$save.settings.sound)}
			>
				{$save.settings.sound ? 'Sound on' : 'Sound off'}
			</button>
		</div>
		<div class="row">
			<div>
				<p class="name">Reduce motion</p>
				<p class="description">Remove travel, shake, and particle movement.</p>
			</div>
			<button
				type="button"
				aria-pressed={$save.settings.reduceMotion}
				onclick={() => setSetting('reduceMotion', !$save.settings.reduceMotion)}
			>
				{$save.settings.reduceMotion ? 'Motion reduced' : 'Motion on'}
			</button>
		</div>
	</section>

	<section class="group" aria-labelledby="install-title">
		<h2 id="install-title">Install</h2>
		<p class="copy">
			Critical Mass is a local-first web app. Use your browser’s “Add to Home Screen” or “Install
			app” action to keep the reactor one tap away. The installable build and offline cache ship in
			a later update.
		</p>
	</section>

	<section class="group" aria-labelledby="reset-title">
		<h2 id="reset-title">Reset</h2>
		<p class="copy">
			Reset the active run to return to the title without losing research or unlocks. Reset all
			progress clears the run, research, unlocks, and statistics, but keeps these settings.
		</p>

		<div class="danger-row">
			<button type="button" onclick={() => (confirming = 'run')}>Reset run</button>
			<button type="button" class="danger" onclick={() => (confirming = 'all')}>
				Reset all progress
			</button>
		</div>

		{#if confirming === 'run'}
			<div class="confirm" role="dialog" aria-label="Confirm reset run">
				<h3>Clear the active run?</h3>
				<p>Research, unlocks, and statistics stay.</p>
				<div class="confirm-actions">
					<button type="button" onclick={confirmRun}>Confirm reset run</button>
					<button type="button" onclick={() => (confirming = null)}>Cancel</button>
				</div>
			</div>
		{:else if confirming === 'all'}
			<div class="confirm" role="dialog" aria-label="Confirm reset all progress">
				<h3>Clear all progress?</h3>
				<p>This clears the run, research, unlocks, and statistics. Settings stay.</p>
				<div class="confirm-actions">
					<button type="button" onclick={confirmAll}>Confirm reset all</button>
					<button type="button" onclick={() => (confirming = null)}>Cancel</button>
				</div>
			</div>
		{/if}
	</section>

	<section class="group about" aria-labelledby="about-title">
		<h2 id="about-title">About</h2>
		<p class="copy">Critical Mass — a neon reactor roguelike. Version 0.1.0.</p>
	</section>
</main>

<style>
	.head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
		margin-bottom: 12px;
	}

	.kicker {
		margin: 0 0 4px;
		font-size: 8px;
		letter-spacing: 0.18em;
		color: var(--cyan);
	}

	h1 {
		font-size: clamp(1.7rem, 7vw, 2.5rem);
	}

	h2 {
		font-size: 1.05rem;
	}

	h3 {
		font-size: 0.95rem;
	}

	.back {
		flex: 0 0 auto;
		min-height: 44px;
		padding: 8px 10px;
		font-size: 11px;
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: 7px;
	}

	.group {
		position: relative;
		margin-bottom: 12px;
		padding: 12px;
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: 8px;
	}

	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 9px 0;
		border-top: 1px solid rgba(120, 170, 255, 0.1);
	}

	.row:first-of-type {
		border-top: 0;
	}

	.name {
		margin: 0;
		font-size: 12px;
		font-weight: 700;
	}

	.description,
	.copy {
		margin: 2px 0 0;
		font-size: 10px;
		line-height: 1.45;
		color: var(--muted);
	}

	.row button,
	.danger-row button {
		flex: 0 0 auto;
		min-height: 44px;
		padding: 8px 10px;
		font-size: 11px;
		font-weight: 700;
		background: var(--panel-2);
		border: 1px solid var(--line);
		border-radius: 6px;
	}

	.row button[aria-pressed='true'] {
		color: var(--void);
		background: var(--lime);
		border-color: var(--lime);
	}

	.danger-row {
		display: grid;
		gap: 7px;
		margin-top: 10px;
	}

	.danger-row button.danger {
		color: var(--danger);
		border-color: rgba(255, 91, 110, 0.4);
	}

	.confirm {
		position: fixed;
		inset: 0;
		z-index: 30;
		display: flex;
		flex-direction: column;
		justify-content: center;
		width: min(340px, calc(100% - 36px));
		height: fit-content;
		margin: auto;
		padding: 18px;
		background: var(--panel);
		border: 1px solid var(--magenta);
		border-radius: 12px;
		box-shadow: 0 0 34px rgba(255, 79, 216, 0.2);
	}

	.confirm p {
		margin: 6px 0 14px;
		font-size: 12px;
		color: var(--muted);
	}

	.confirm-actions {
		display: grid;
		gap: 7px;
	}

	.confirm-actions button {
		min-height: 44px;
		font-size: 12px;
		font-weight: 700;
		background: var(--panel-2);
		border: 1px solid var(--line);
		border-radius: 7px;
	}

	.confirm-actions button:first-child {
		color: var(--void);
		background: var(--magenta);
		border-color: var(--magenta);
	}

	.about {
		margin-bottom: 0;
	}
</style>
