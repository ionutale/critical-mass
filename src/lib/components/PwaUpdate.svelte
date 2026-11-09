<script lang="ts">
	import { useRegisterSW } from 'virtual:pwa-register/svelte';

	const { needRefresh, updateServiceWorker } = useRegisterSW();
</script>

{#if $needRefresh}
	<div class="pwa" role="status">
		<span>A new reactor build is ready.</span>
		<button type="button" onclick={() => updateServiceWorker(true)}>Refresh</button>
		<button type="button" onclick={() => needRefresh.set(false)}>Later</button>
	</div>
{/if}

<style>
	.pwa {
		position: fixed;
		z-index: 50;
		right: 12px;
		bottom: calc(76px + env(safe-area-inset-bottom));
		left: 12px;
		display: flex;
		align-items: center;
		gap: 8px;
		max-width: 536px;
		margin: 0 auto;
		padding: 10px 12px;
		border: 1px solid var(--cyan);
		border-radius: 10px;
		background: rgba(13, 20, 36, 0.97);
		box-shadow: 0 0 24px rgba(56, 225, 255, 0.25);
		color: var(--text);
		font-size: 0.86rem;
	}

	span {
		flex: 1;
	}

	button {
		min-height: 44px;
		padding: 4px 10px;
		border: 1px solid var(--line);
		border-radius: 6px;
		background: var(--panel-2);
		color: var(--text);
		font-size: 0.86rem;
	}

	button:first-of-type {
		border-color: var(--cyan);
		color: var(--cyan);
	}
</style>
