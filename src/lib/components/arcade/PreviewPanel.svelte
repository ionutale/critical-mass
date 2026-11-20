<script lang="ts">
	import { trapFocus } from '../../actions/trapFocus';
	import { ELEMENT_BY_SYMBOL } from '../../data/elements';
	import type { PlacementPreview } from '../../game/arcade/fusion';
	import type { ElementSymbol } from '../../types';

	let {
		preview,
		card,
		cell,
		heatCap,
		onConfirm,
		onCancel
	}: {
		preview: PlacementPreview;
		/** The card being placed; carried so the panel can explain a fusion-less drop. */
		card: ElementSymbol;
		/** Target cell, used to read the resulting tile from the previewed grid. */
		cell: number;
		heatCap: number;
		onConfirm: () => void;
		onCancel: () => void;
	} = $props();

	function name(symbol: ElementSymbol): string {
		return ELEMENT_BY_SYMBOL.get(symbol)?.name ?? symbol;
	}

	const placed = $derived(name(card));
	const result = $derived(preview.grid[cell] ?? card);
</script>

<div class="backdrop">
	<div
		class="panel"
		role="dialog"
		aria-modal="true"
		aria-label="Placement preview"
		use:trapFocus={{ onEscape: onCancel }}
	>
		<p class="kicker mono">PLACEMENT PREVIEW</p>
		<p class="placed">Placing <strong>{placed}</strong></p>

		{#if preview.steps.length > 0}
			<ol class="steps" aria-label="Chain steps">
				{#each preview.steps as step (step.step)}
					<li class="step">
						<p class="equation">
							<span>{name(step.a)}</span>
							<span class="op">+</span>
							<span>{name(step.b)}</span>
							<span class="op">→</span>
							<strong>{name(step.result)}</strong>
						</p>
						<p class="gain mono">+{step.points} points · +{step.heat} heat</p>
					</li>
				{/each}
			</ol>
		{:else}
			<p class="quiet">No fusion. The tile just sits there.</p>
		{/if}

		<dl class="outcome">
			<div>
				<dt>Result</dt>
				<dd data-testid="preview-result">{name(result)}</dd>
			</div>
			<div>
				<dt>Score gain</dt>
				<dd class="mono" data-testid="preview-score">+{preview.scoreGain}</dd>
			</div>
			<div>
				<dt>Heat after</dt>
				<dd class="mono" data-testid="preview-heat">{preview.heatAfter} / {heatCap}</dd>
			</div>
		</dl>

		{#if preview.overload}
			<p class="warning" role="alert">Overload! This placement ends the run.</p>
		{/if}

		<div class="actions">
			<button class="confirm" type="button" onclick={onConfirm}>Confirm</button>
			<button type="button" onclick={onCancel}>Cancel</button>
		</div>
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
		box-shadow:
			0 0 30px rgba(56, 225, 255, 0.2),
			inset 0 0 30px rgba(56, 225, 255, 0.04);
	}

	.kicker {
		margin: 0 0 12px;
		font-size: 9px;
		letter-spacing: 0.2em;
		color: var(--cyan);
	}

	.placed {
		margin: 0 0 12px;
		font-size: 13px;
		color: var(--muted);
	}

	.placed strong {
		color: var(--text);
	}

	.steps {
		display: grid;
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.step {
		padding: 8px 10px;
		font-size: 13px;
		background: var(--panel-2);
		border-left: 2px solid var(--cyan);
		border-radius: 4px;
	}

	.equation {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 6px;
		margin: 0;
	}

	.equation strong {
		color: var(--cyan);
	}

	.op {
		color: var(--muted);
	}

	.gain {
		margin: 4px 0 0;
		font-size: 10px;
		color: var(--muted);
	}

	.quiet {
		margin: 0;
		font-size: 13px;
		color: var(--muted);
	}

	.outcome {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
		margin: 14px 0 0;
		padding-top: 12px;
		border-top: 1px solid var(--line);
	}

	.outcome div {
		min-width: 0;
	}

	.outcome dt {
		font-size: 8px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.outcome dd {
		margin: 2px 0 0;
		font-size: 14px;
		font-weight: 700;
		color: var(--text);
	}

	.outcome dd[data-testid='preview-score'] {
		color: var(--lime);
	}

	.outcome dd[data-testid='preview-heat'] {
		color: var(--amber);
	}

	.warning {
		margin: 12px 0 0;
		padding: 8px;
		font-size: 12px;
		color: var(--danger);
		border: 1px solid rgba(255, 91, 110, 0.4);
		border-radius: 6px;
	}

	.actions {
		position: sticky;
		bottom: 0;
		z-index: 1;
		display: flex;
		gap: 8px;
		margin-top: 16px;
		padding: 12px 0 2px;
		background: var(--panel);
		border-top: 1px solid var(--line);
	}

	.actions button {
		flex: 1;
		min-height: 44px;
		font-size: 14px;
		font-weight: 700;
		color: var(--text);
		background: var(--panel-2);
		border: 1px solid var(--line);
		border-radius: 8px;
	}

	.actions .confirm {
		color: #031018;
		background: var(--cyan);
		border-color: var(--cyan);
	}
</style>
