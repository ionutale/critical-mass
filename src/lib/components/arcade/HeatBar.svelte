<script lang="ts">
	let {
		heat,
		cap,
		milestones = [25, 50, 75]
	}: {
		heat: number;
		cap: number;
		milestones?: readonly number[];
	} = $props();

	const percent = $derived(cap > 0 ? Math.min(100, Math.max(0, (heat / cap) * 100)) : 0);
</script>

<section class="heat-bar" aria-label="Heat">
	<div class="readout">
		<p class="label mono">HEAT</p>
		<p class="value mono">
			{heat}<span class="cap"> / {cap}</span>
		</p>
	</div>
	<div
		class="track"
		role="meter"
		aria-label="Heat"
		aria-live="polite"
		aria-valuemin="0"
		aria-valuemax={cap}
		aria-valuenow={heat}
		aria-valuetext={`${heat} of ${cap} heat`}
	>
		<div class="fill" style:width={`${percent}%`}></div>
	</div>
	<ol class="milestones" aria-label="Heat milestones">
		{#each milestones as milestone (milestone)}
			<li
				class:reached={heat >= milestone}
				aria-label={`milestone ${milestone}, ${heat >= milestone ? 'reached' : 'not reached'}`}
				style:left={`${cap > 0 ? Math.min(100, (milestone / cap) * 100) : 0}%`}
			>
				<span class="mark" aria-hidden="true"></span>
				<span class="number mono" aria-hidden="true">{milestone}</span>
			</li>
		{/each}
	</ol>
</section>

<style>
	.heat-bar {
		padding: 10px 12px 8px;
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: 10px;
	}

	.readout {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
	}

	.label {
		margin: 0;
		font-size: 8px;
		letter-spacing: 0.18em;
		color: var(--muted);
	}

	.value {
		margin: 0;
		font-size: 20px;
		font-weight: 700;
		color: var(--amber);
	}

	.cap {
		font-size: 11px;
		color: var(--muted);
	}

	.track {
		height: 8px;
		margin-top: 4px;
		overflow: hidden;
		background: rgba(56, 225, 255, 0.12);
		border: 1px solid rgba(56, 225, 255, 0.35);
		border-radius: 99px;
	}

	.fill {
		height: 100%;
		background: linear-gradient(90deg, var(--cyan), var(--amber) 60%, var(--danger));
		box-shadow: 0 0 12px rgba(255, 179, 71, 0.5);
		transition: width 200ms ease;
	}

	.milestones {
		position: relative;
		height: 16px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.milestones li {
		position: absolute;
		top: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		transform: translateX(-50%);
		font-size: 8px;
		color: var(--muted);
	}

	.mark {
		width: 1px;
		height: 4px;
		background: rgba(143, 163, 194, 0.5);
	}

	.milestones li.reached {
		color: var(--amber);
	}

	.milestones li.reached .mark {
		background: var(--amber);
		box-shadow: 0 0 6px rgba(255, 179, 71, 0.8);
	}

	.number {
		line-height: 1.2;
	}
</style>
