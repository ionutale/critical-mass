<script lang="ts">
	import { trapFocus } from '../actions/trapFocus';
	import { ELEMENT_BY_SYMBOL } from '../data/elements';
	import type { PlacementPreview } from '../game/fusion';

	let {
		preview,
		onConfirm,
		onCancel
	}: {
		preview: PlacementPreview;
		onConfirm: () => void;
		onCancel: () => void;
	} = $props();

	const last = $derived(preview.steps.at(-1) ?? null);
</script>

<div class="backdrop">
	<div
		class="preview"
		role="dialog"
		aria-modal="true"
		aria-label="Preview"
		use:trapFocus={{ onEscape: onCancel }}
	>
		<p class="kicker">CHAIN PREVIEW</p>

		{#if preview.steps.length > 0}
			<ol>
				{#each preview.steps as step, index (step.step)}
					<li class="chain-step" style:animation-delay={`${index * 90}ms`}>
						<span>{ELEMENT_BY_SYMBOL.get(step.a)?.name ?? step.a}</span>
						<span class="op">+</span>
						<span>{ELEMENT_BY_SYMBOL.get(step.b)?.name ?? step.b}</span>
						<span class="op">→</span>
						<strong>{ELEMENT_BY_SYMBOL.get(step.result)?.name ?? step.result}</strong>
					</li>
				{/each}
			</ol>
		{:else}
			<p class="quiet">Nothing fuses. The tile just sits there, judging you.</p>
		{/if}

		<div class="pressure">
			<span>Pressure</span>
			<strong class="mono">+{preview.pressureGain}</strong>
			<span class="after mono">→ {preview.pressureAfter}</span>
		</div>

		{#if last}
			<p class="result">
				Final tile: <strong>{ELEMENT_BY_SYMBOL.get(last.result)?.symbol ?? last.result}</strong>
			</p>
		{/if}

		{#if preview.meltdown}
			<p class="warning" role="alert">That would hit the cap. Meltdown.</p>
		{:else if preview.saved}
			<p class="warning" role="status">Emergency shield holds. Pressure stops at the cap.</p>
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

	.chain-step {
		animation: chain-pulse 900ms ease-out both;
	}

	@keyframes chain-pulse {
		0% {
			opacity: 0.25;
			transform: translateX(-6px);
			text-shadow: none;
		}
		45% {
			opacity: 1;
			transform: translateX(0);
			text-shadow: 0 0 12px rgba(56, 225, 255, 0.7);
		}
		100% {
			opacity: 1;
			transform: translateX(0);
			text-shadow: none;
		}
	}

	:global(.reduce-motion) .chain-step {
		animation: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.chain-step {
			animation: none;
		}
	}

	.preview {
		width: min(360px, 100%);
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

	ol {
		display: grid;
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 6px;
		padding: 8px 10px;
		font-size: 13px;
		background: var(--panel-2);
		border-left: 2px solid var(--cyan);
		border-radius: 4px;
	}

	strong {
		color: var(--cyan);
	}

	.op {
		color: var(--muted);
	}

	.quiet,
	.result {
		margin: 0;
		font-size: 13px;
		color: var(--muted);
	}

	.pressure {
		display: flex;
		align-items: baseline;
		gap: 8px;
		margin-top: 14px;
		padding-top: 12px;
		font-size: 12px;
		color: var(--muted);
		border-top: 1px solid var(--line);
	}

	.pressure strong {
		font-size: 18px;
		color: var(--magenta);
	}

	.after {
		margin-left: auto;
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
		display: flex;
		gap: 8px;
		margin-top: 16px;
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
