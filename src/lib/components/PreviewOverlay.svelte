<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { trapFocus } from '../actions/trapFocus';
	import { LEGACY_ELEMENT_BY_SYMBOL } from '../data/elements.legacy';
	import type { PlacementPreview } from '../game/fusion';
	import { reducedMotion, transitionDuration } from '../stores/motion';

	let {
		preview,
		onConfirm,
		onCancel,
		onChoose
	}: {
		preview: PlacementPreview;
		onConfirm: () => void;
		onCancel: () => void;
		onChoose: (step: number, option: number) => void;
	} = $props();

	const last = $derived(preview.steps.at(-1) ?? null);
</script>

<div class="backdrop" in:fade={{ duration: transitionDuration($reducedMotion, 180) }}>
	<div
		class="preview"
		role="dialog"
		aria-modal="true"
		aria-label="Preview"
		in:fly={{ y: 8, duration: transitionDuration($reducedMotion, 180) }}
		use:trapFocus={{ onEscape: onCancel }}
	>
		<p class="kicker">CHAIN PREVIEW</p>

		{#if preview.steps.length > 0}
			<ol>
				{#each preview.steps as step, index (step.step)}
					<li class="chain-step" style:animation-delay={`${index * 90}ms`}>
						<p class="equation">
							<span>{LEGACY_ELEMENT_BY_SYMBOL.get(step.a)?.name ?? step.a}</span>
							<span class="op">+</span>
							<span>{LEGACY_ELEMENT_BY_SYMBOL.get(step.b)?.name ?? step.b}</span>
							<span class="op">→</span>
							<strong>{LEGACY_ELEMENT_BY_SYMBOL.get(step.result)?.name ?? step.result}</strong>
						</p>
						<div class="options" role="group" aria-label={`Step ${step.step} options`}>
							{#each step.options as option, optionIndex (optionIndex)}
								<button
									type="button"
									class="option"
									aria-pressed={step.choice === optionIndex}
									onclick={() => onChoose(index, optionIndex)}
								>
									<span class="mono">
										{LEGACY_ELEMENT_BY_SYMBOL.get(option.other)?.symbol ?? option.other} →
										{LEGACY_ELEMENT_BY_SYMBOL.get(option.result)?.symbol ?? option.result}
									</span>
									<span class="cost mono">+{option.pressure}</span>
								</button>
							{/each}
						</div>
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
				Final tile: <strong
					>{LEGACY_ELEMENT_BY_SYMBOL.get(last.result)?.symbol ?? last.result}</strong
				>
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
		/* A branching chain can produce more options than a small phone can
		   show. Keep the dialog inside the viewport and let it scroll, with the
		   action row pinned so Confirm/Cancel stay reachable. */
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

	ol {
		display: grid;
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: block;
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

	.options {
		display: grid;
		gap: 6px;
		margin-top: 8px;
	}

	.option {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		min-height: 44px;
		padding: 4px 8px;
		font-size: 12px;
		text-align: left;
		color: var(--muted);
		background: rgba(56, 225, 255, 0.04);
		border: 1px solid var(--line);
		border-radius: 6px;
	}

	.option[aria-pressed='true'] {
		color: var(--text);
		background: rgba(56, 225, 255, 0.14);
		border-color: var(--cyan);
		box-shadow: inset 0 0 10px rgba(56, 225, 255, 0.12);
	}

	.cost {
		color: var(--magenta);
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
