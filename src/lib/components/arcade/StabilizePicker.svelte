<script lang="ts">
	import { trapFocus } from '../../actions/trapFocus';
	import { ELEMENT_BY_SYMBOL } from '../../data/elements';
	import type { ElementSymbol } from '../../types';

	let {
		cards,
		onPick,
		onCancel
	}: {
		cards: readonly ElementSymbol[];
		/** The card the player chose to discard; the cooling is committed by the caller. */
		onPick: (index: number) => void;
		onCancel: () => void;
	} = $props();

	function name(symbol: ElementSymbol): string {
		return ELEMENT_BY_SYMBOL.get(symbol)?.name ?? symbol;
	}
</script>

<div class="backdrop">
	<div
		class="panel"
		role="dialog"
		aria-modal="true"
		aria-label="Stabilize"
		use:trapFocus={{ onEscape: onCancel }}
	>
		<p class="kicker mono">STABILIZE</p>
		<p class="copy">
			Discard a card to cool the reactor. The turn still ends, so choose carefully.
		</p>

		<ul class="cards" aria-label="Cards to discard">
			{#each cards as card, index (index)}
				{@const record = ELEMENT_BY_SYMBOL.get(card)}
				<li>
					<button
						type="button"
						class="card"
						aria-label={`Stabilize with ${name(card)}`}
						onclick={() => onPick(index)}
					>
						<span class="symbol" aria-hidden="true">{card}</span>
						<span class="name" aria-hidden="true">{record?.name ?? card}</span>
						<span class="stats mono" aria-hidden="true"
							>V {record?.valence ?? '?'} · M {record?.mass ?? '?'}</span
						>
					</button>
				</li>
			{/each}
		</ul>

		<button class="cancel" type="button" onclick={onCancel}>Cancel</button>
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 20;
		display: grid;
		place-items: center;
		padding: 22px;
		background: rgba(3, 6, 12, 0.72);
		backdrop-filter: blur(3px);
	}

	.panel {
		width: min(360px, 100%);
		max-height: calc(100vh - 44px);
		max-height: calc(100dvh - 44px);
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: 20px;
		background: var(--panel);
		border: 1px solid var(--cyan);
		border-radius: 14px;
		box-shadow: 0 0 30px rgba(56, 225, 255, 0.2);
	}

	.kicker {
		margin: 0 0 10px;
		font-size: 9px;
		letter-spacing: 0.2em;
		color: var(--cyan);
	}

	.copy {
		margin: 0 0 14px;
		font-size: 12px;
		color: var(--muted);
	}

	.cards {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		width: 100%;
		min-height: 72px;
		padding: 8px 4px;
		background: var(--panel-2);
		border: 1px solid rgba(56, 225, 255, 0.35);
		border-radius: 8px;
	}

	@media (hover: hover) {
		.card:hover {
			border-color: var(--cyan);
			box-shadow: 0 0 12px rgba(56, 225, 255, 0.3);
		}
	}

	.symbol {
		font-family: 'JetBrains Mono Variable', ui-monospace, monospace;
		font-size: 20px;
		font-weight: 700;
		color: var(--cyan);
	}

	.name {
		max-width: 100%;
		font-size: 8px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--muted);
	}

	.stats {
		font-size: 8px;
		letter-spacing: 0.02em;
		color: var(--muted);
	}

	.cancel {
		width: 100%;
		min-height: 44px;
		margin-top: 14px;
		font-size: 13px;
		font-weight: 700;
		color: var(--text);
		background: var(--panel-2);
		border: 1px solid var(--line);
		border-radius: 8px;
	}
</style>
