<script lang="ts">
	let {
		sector,
		onEnter
	}: {
		sector: 1 | 2 | 3;
		onEnter: () => void;
	} = $props();

	const next = $derived((sector + 1) as 2 | 3);
	const floor = $derived(next === 2 ? 20 : 40);
</script>

<div class="backdrop">
	<div class="transition" role="dialog" aria-modal="true" aria-labelledby="transition-title">
		<p class="kicker mono">SECTOR {sector} CLEARED</p>
		<h2 id="transition-title">Sector {next}</h2>
		<p class="copy">
			Pressure releases to the sector floor of {floor}. The reactor gets one free module before the
			next contract.
		</p>
		{#if next === 3}
			<p class="catalyst">Catalyst injector granted. The heavy chain is online.</p>
		{/if}
		<button type="button" onclick={onEnter}>Enter sector {next}</button>
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 30;
		display: grid;
		place-items: center;
		padding: 22px;
		background: rgba(3, 6, 12, 0.82);
		backdrop-filter: blur(3px);
	}

	.transition {
		width: min(360px, 100%);
		padding: 22px;
		background: var(--panel);
		border: 1px solid var(--amber);
		border-radius: 14px;
		box-shadow: 0 0 34px rgba(255, 179, 71, 0.2);
	}

	.kicker {
		margin: 0 0 6px;
		font-size: 9px;
		letter-spacing: 0.2em;
		color: var(--amber);
	}

	h2 {
		font-size: 1.6rem;
	}

	.copy {
		margin: 8px 0 12px;
		font-size: 12px;
		line-height: 1.5;
		color: var(--muted);
	}

	.catalyst {
		margin: 0 0 14px;
		padding: 8px 10px;
		font-size: 11px;
		color: var(--lime);
		background: rgba(182, 255, 92, 0.06);
		border-left: 2px solid var(--lime);
		border-radius: 4px;
	}

	button {
		width: 100%;
		min-height: 44px;
		font-size: 13px;
		font-weight: 700;
		color: var(--void);
		background: var(--amber);
		border: 0;
		border-radius: 7px;
	}
</style>
