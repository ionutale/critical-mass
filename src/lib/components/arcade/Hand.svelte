<script lang="ts">
	import { dragPlacement } from '../../actions/arcadeDrag';
	import type { DragPlacementHandlers } from '../../actions/arcadeDrag';
	import { ELEMENT_BY_SYMBOL } from '../../data/elements';
	import type { ElementSymbol } from '../../types';

	let {
		cards,
		selected = null,
		disabled = false,
		onSelect,
		drag = null,
		onKeyDown
	}: {
		cards: readonly ElementSymbol[];
		selected?: number | null;
		disabled?: boolean;
		onSelect?: (index: number) => void;
		/** Pointer-drag gestures shared by every card; see `arcadeDrag`. */
		drag?: DragPlacementHandlers | null;
		/** Arrow/Enter/Escape handling for the focused card. */
		onKeyDown?: (event: KeyboardEvent, index: number) => void;
	} = $props();
</script>

<section class="hand" aria-label="Hand">
	<p class="label mono">HAND // {cards.length}</p>
	<!-- svelte-ignore a11y_no_noninteractive_tabindex (a scrollable region whose children are disabled must stay keyboard reachable) -->
	<div class="cards" tabindex={disabled ? 0 : -1}>
		{#each cards as card, index (index)}
			{@const record = ELEMENT_BY_SYMBOL.get(card)}
			<button
				type="button"
				class="card"
				class:selected={selected === index}
				aria-pressed={selected === index}
				aria-label={`card ${index + 1}, ${card} ${record?.name ?? card}, V ${record?.valence ?? '?'} M ${record?.mass ?? '?'}`}
				{disabled}
				use:dragPlacement={{
					cardIndex: index,
					symbol: card,
					disabled,
					handlers: drag ?? undefined
				}}
				onclick={() => onSelect?.(index)}
				onkeydown={(event) => onKeyDown?.(event, index)}
			>
				<span class="symbol" aria-hidden="true">{card}&nbsp;</span>
				<span class="name" aria-hidden="true">{record?.name ?? card}&nbsp;</span>
				<span class="stats" aria-hidden="true"
					>V {record?.valence ?? '?'} · M {record?.mass ?? '?'}</span
				>
			</button>
		{/each}
	</div>
</section>

<style>
	.hand {
		padding: 10px 12px 12px;
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: 10px;
	}

	.label {
		margin: 0 0 3px;
		font-size: 8px;
		letter-spacing: 0.18em;
		color: var(--muted);
	}

	.cards {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		padding: 6px 1px 5px;
	}

	.card {
		display: flex;
		flex-direction: column;
		align-items: center;
		flex: 0 0 auto;
		gap: 1px;
		width: 64px;
		min-height: 72px;
		padding: 8px 5px 5px;
		background: var(--panel-2);
		border: 1px solid rgba(56, 225, 255, 0.35);
		border-radius: 7px;
		/* The browser resolves `touch-action` when a finger lands, so it must be
		   static: allow the hand's horizontal scroll, claim vertical drags. */
		touch-action: pan-x;
		transition:
			transform 140ms ease,
			border-color 120ms ease,
			box-shadow 120ms ease;
	}

	@media (hover: hover) {
		.card:not(:disabled):hover {
			transform: translateY(-3px);
			border-color: rgba(56, 225, 255, 0.7);
		}
	}

	.card:not(:disabled):active {
		transform: translateY(-1px) scale(0.97);
	}

	.card:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.card.selected {
		border-color: var(--cyan);
		box-shadow:
			0 0 0 1px var(--cyan),
			0 0 14px rgba(56, 225, 255, 0.35);
	}

	.symbol {
		font-family: 'JetBrains Mono Variable', ui-monospace, monospace;
		font-size: 22px;
		font-weight: 700;
		color: var(--cyan);
	}

	.name {
		max-width: 100%;
		font-size: 7px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--muted);
	}

	.stats {
		font-family: 'JetBrains Mono Variable', ui-monospace, monospace;
		font-size: 7px;
		letter-spacing: 0.02em;
		color: var(--muted);
	}
</style>
