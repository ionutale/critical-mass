<script lang="ts">
	import { trapFocus } from '../actions/trapFocus';
	import type { RunState } from '../types';

	let {
		status,
		run,
		onNewRun
	}: {
		status: 'meltdown' | 'victory';
		run: RunState;
		onNewRun: () => void;
	} = $props();
</script>

<div class="backdrop" class:meltdown={status === 'meltdown'}>
	<div
		class="end"
		role={status === 'meltdown' ? 'alert' : 'dialog'}
		aria-modal="true"
		aria-labelledby="end-title"
		use:trapFocus
	>
		<p class="kicker mono">{status === 'meltdown' ? 'REACTOR LOST' : 'RUN COMPLETE'}</p>
		<h2 id="end-title">{status === 'meltdown' ? 'Meltdown' : 'Victory'}</h2>
		<p class="copy">
			{status === 'meltdown'
				? 'The reactor is now a very expensive puddle. The research survived.'
				: 'The third boss is delivered. The reactor holds, and the sector is yours.'}
		</p>

		<dl>
			<div>
				<dt>Contracts</dt>
				<dd>{run.contractsCompleted}</dd>
			</div>
			<div>
				<dt>Sector</dt>
				<dd>{run.sector}</dd>
			</div>
			<div>
				<dt>Research</dt>
				<dd>+{run.researchEarned}</dd>
			</div>
			<div>
				<dt>Pressure</dt>
				<dd>{run.pressure} / {run.pressureCap}</dd>
			</div>
		</dl>

		<button type="button" onclick={onNewRun}>New run</button>
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
		background: rgba(3, 6, 12, 0.9);
		backdrop-filter: blur(4px);
	}

	.end {
		width: min(360px, 100%);
		padding: 22px;
		background: var(--panel);
		border: 1px solid var(--lime);
		border-radius: 14px;
		box-shadow: 0 0 40px rgba(182, 255, 92, 0.2);
	}

	.meltdown .end {
		border-color: var(--magenta);
		box-shadow: 0 0 40px rgba(255, 79, 216, 0.24);
	}

	.kicker {
		margin: 0 0 6px;
		font-size: 9px;
		letter-spacing: 0.2em;
		color: var(--lime);
	}

	.meltdown .kicker {
		color: var(--magenta);
	}

	h2 {
		font-size: 1.7rem;
	}

	.copy {
		margin: 8px 0 14px;
		font-size: 12px;
		line-height: 1.5;
		color: var(--muted);
	}

	dl {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
		margin: 0 0 16px;
	}

	dl div {
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
		font-family: 'JetBrains Mono Variable', monospace;
		font-size: 16px;
		font-weight: 700;
	}

	button {
		width: 100%;
		min-height: 44px;
		font-size: 13px;
		font-weight: 700;
		color: var(--void);
		background: var(--lime);
		border: 0;
		border-radius: 7px;
	}

	.meltdown button {
		background: var(--magenta);
	}
</style>
