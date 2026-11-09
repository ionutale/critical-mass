<script lang="ts">
	import { trapFocus } from '../actions/trapFocus';
	import { ELEMENT_BY_SYMBOL } from '../data/elements';
	import { MODULE_BY_ID } from '../data/modules';
	import { PATCH_BY_ID } from '../data/patches';
	import type { DraftOption } from '../types';

	let {
		options,
		kind,
		onPick
	}: {
		options: DraftOption[];
		kind: 'contract' | 'sector';
		onPick: (index: number) => void;
	} = $props();

	function title(option: DraftOption): string {
		if (option.kind === 'cards') {
			return `${ELEMENT_BY_SYMBOL.get(option.element)?.name ?? option.element} × 2`;
		}
		if (option.kind === 'module') {
			return MODULE_BY_ID.get(option.moduleId)?.name ?? option.moduleId;
		}
		return PATCH_BY_ID.get(option.patchId)?.name ?? option.patchId;
	}

	function description(option: DraftOption): string {
		if (option.kind === 'cards') {
			return 'Two cards added to the discard pile.';
		}
		if (option.kind === 'module') {
			return MODULE_BY_ID.get(option.moduleId)?.description ?? 'Reactor module.';
		}
		return PATCH_BY_ID.get(option.patchId)?.description ?? 'One-run patch.';
	}

	function label(option: DraftOption): string {
		if (option.kind === 'cards') return 'cards';
		return option.kind;
	}
</script>

<svelte:window
	onkeydown={(event) => {
		const index = Number(event.key) - 1;
		if (index >= 0 && index < options.length) onPick(index);
	}}
/>

<div class="backdrop">
	<div class="draft" role="dialog" aria-modal="true" aria-labelledby="draft-title" use:trapFocus>
		<p class="kicker mono">{kind === 'sector' ? 'SECTOR TRANSITION' : 'CONTRACT COMPLETE'}</p>
		<h2 id="draft-title">
			{kind === 'sector' ? 'Choose a free module' : 'Choose one upgrade'}
		</h2>
		<p class="hint">The reactor will not proceed without a choice.</p>

		<ul>
			{#each options as option, index (index)}
				<li>
					<button type="button" onclick={() => onPick(index)}>
						<span class="number mono">{index + 1}</span>
						<span class="body">
							<span class="name">{title(option)}</span>
							<span class="description">{description(option)}</span>
						</span>
						<span class="kind mono">{label(option)}</span>
					</button>
				</li>
			{/each}
		</ul>
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
		background: rgba(3, 6, 12, 0.78);
		backdrop-filter: blur(3px);
	}

	.draft {
		width: min(380px, 100%);
		padding: 20px;
		background: var(--panel);
		border: 1px solid var(--lime);
		border-radius: 14px;
		box-shadow:
			0 0 30px rgba(182, 255, 92, 0.18),
			inset 0 0 30px rgba(182, 255, 92, 0.03);
	}

	.kicker {
		margin: 0 0 6px;
		font-size: 9px;
		letter-spacing: 0.2em;
		color: var(--lime);
	}

	h2 {
		font-size: 1.3rem;
	}

	.hint {
		margin: 6px 0 14px;
		font-size: 12px;
		color: var(--muted);
	}

	ul {
		display: grid;
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li button {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		min-height: 62px;
		padding: 10px;
		text-align: left;
		background: var(--panel-2);
		border: 1px solid var(--line);
		border-radius: 8px;
	}

	li button:hover,
	li button:focus-visible {
		border-color: var(--lime);
		box-shadow: 0 0 16px rgba(182, 255, 92, 0.16);
	}

	.number {
		display: grid;
		place-items: center;
		flex: 0 0 28px;
		height: 28px;
		font-size: 12px;
		color: var(--void);
		background: var(--lime);
		border-radius: 6px;
	}

	.body {
		display: grid;
		gap: 2px;
		flex: 1;
	}

	.name {
		font-size: 13px;
		font-weight: 700;
	}

	.description {
		font-size: 11px;
		color: var(--muted);
	}

	.kind {
		font-size: 8px;
		letter-spacing: 0.12em;
		color: var(--muted);
		text-transform: uppercase;
	}
</style>
