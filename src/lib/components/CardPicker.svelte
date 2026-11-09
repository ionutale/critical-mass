<script lang="ts">
	import { trapFocus } from '../actions/trapFocus';
	import { ELEMENT_BY_SYMBOL } from '../data/elements';

	let {
		title,
		description,
		cards,
		onPick,
		onCancel
	}: {
		title: string;
		description: string;
		cards: readonly string[];
		onPick: (index: number) => void;
		onCancel?: () => void;
	} = $props();
</script>

<div class="backdrop">
	<div
		class="picker"
		role="dialog"
		aria-modal="true"
		aria-label={title}
		use:trapFocus={{ onEscape: () => onCancel?.() }}
	>
		<p class="kicker">REACTOR CONTROL</p>
		<h2>{title}</h2>
		<p class="copy">{description}</p>

		<div class="cards">
			{#each cards as card, index (index)}
				<button
					type="button"
					aria-label={`${card} ${ELEMENT_BY_SYMBOL.get(card)?.name ?? card}, discard ${index + 1}`}
					onclick={() => onPick(index)}
				>
					<span class="symbol">{card}</span>
					<span class="name">{ELEMENT_BY_SYMBOL.get(card)?.name ?? card}</span>
				</button>
			{/each}
		</div>

		{#if onCancel}
			<button class="cancel" type="button" onclick={onCancel}>Cancel</button>
		{/if}
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 25;
		display: grid;
		place-items: center;
		padding: 22px;
		background: rgba(3, 6, 12, 0.72);
		backdrop-filter: blur(3px);
	}

	.picker {
		width: min(360px, 100%);
		padding: 20px;
		background: var(--panel);
		border: 1px solid var(--magenta);
		border-radius: 14px;
		box-shadow: 0 0 30px rgba(255, 79, 216, 0.18);
	}

	.kicker {
		margin: 0 0 6px;
		font-size: 9px;
		letter-spacing: 0.2em;
		color: var(--magenta);
	}

	h2 {
		font-size: 1.3rem;
	}

	.copy {
		margin: 6px 0 14px;
		font-size: 12px;
		color: var(--muted);
	}

	.cards {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		padding-bottom: 6px;
	}

	.cards button {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		flex: 0 0 auto;
		width: 64px;
		min-height: 72px;
		padding: 8px 4px 5px;
		background: var(--panel-2);
		border: 1px solid var(--line);
		border-radius: 7px;
	}

	.symbol {
		font-family: 'JetBrains Mono Variable', monospace;
		font-size: 20px;
		font-weight: 700;
		color: var(--cyan);
	}

	.name {
		font-size: 7px;
		color: var(--muted);
	}

	.cancel {
		width: 100%;
		min-height: 40px;
		margin-top: 12px;
		font-size: 13px;
		background: transparent;
		border: 1px solid var(--line);
		border-radius: 7px;
	}
</style>
