<script lang="ts">
	let { value, cap }: { value: number; cap: number } = $props();

	const percent = $derived(Math.min(100, Math.max(0, (value / cap) * 100)));
</script>

<div class="gauge" aria-label={`Pressure ${value} of ${cap}`}>
	<div class="labels">
		<span class="mono">{value}</span>
		<span class="cap mono">/ {cap}</span>
	</div>
	<div class="track">
		<div class="fill" style:width={`${percent}%`}></div>
	</div>
	<p class="caption">CORE PRESSURE</p>
</div>

<style>
	.gauge {
		min-width: 128px;
	}

	.labels {
		display: flex;
		align-items: baseline;
		justify-content: flex-end;
		gap: 4px;
		font-size: 20px;
		font-weight: 700;
		color: var(--cyan);
	}

	.cap {
		font-size: 11px;
		color: var(--muted);
	}

	.track {
		height: 7px;
		margin-top: 4px;
		overflow: hidden;
		background: rgba(56, 225, 255, 0.12);
		border: 1px solid rgba(56, 225, 255, 0.35);
		border-radius: 99px;
	}

	.fill {
		height: 100%;
		background: linear-gradient(90deg, var(--cyan), var(--amber) 70%, var(--magenta));
		box-shadow: 0 0 12px rgba(56, 225, 255, 0.6);
		transition: width 200ms ease;
	}

	.caption {
		margin: 3px 0 0;
		font-size: 8px;
		letter-spacing: 0.18em;
		text-align: right;
		color: var(--muted);
	}
</style>
