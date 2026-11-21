<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { trapFocus } from '../../actions/trapFocus';
	import { DRAFT_UPGRADE_BY_ID } from '../../data/arcade/unlocks';
	import type { UpgradeId } from '../../data/upgrades';
	import { generateDraft } from '../../game/arcade/draft';
	import { playSound } from '../../game/sound';
	import { chooseUpgrade, run } from '../../stores/arcade';
	import { reducedMotion, transitionDuration } from '../../stores/motion';

	let {
		options,
		onPick = chooseUpgrade
	}: {
		/** Explicit options for previews and tests; defaults to the run's deterministic draft. */
		options?: readonly UpgradeId[];
		onPick?: (index: number) => void;
	} = $props();

	/** The same roll `chooseUpgrade` will commit, so names and payloads agree. */
	const ids = $derived(options ?? ($run ? generateDraft($run) : []));
	const pending = $derived($run?.pendingDrafts ?? 0);

	let buttons: HTMLButtonElement[] = [];

	/**
	 * One activation may arrive twice in the same task (a focused option's key
	 * handler plus the window digit handler, or a synthetic click). The lock
	 * drops on the next microtask so a second queued draft still works normally.
	 */
	let picking = false;

	function pick(index: number): void {
		if (picking) return;
		picking = true;
		playSound('contract');
		onPick(index);
		queueMicrotask(() => {
			picking = false;
		});
	}

	function record(id: UpgradeId) {
		return DRAFT_UPGRADE_BY_ID.get(id);
	}

	/** Number keys 1–3 pick a card without leaving the focused control. */
	function onWindowKeydown(event: KeyboardEvent): void {
		if (event.metaKey || event.ctrlKey || event.altKey) return;

		const index = Number(event.key) - 1;
		if (!Number.isInteger(index) || index < 0 || index >= ids.length) return;

		event.preventDefault();
		pick(index);
	}

	function focusAt(index: number): void {
		if (ids.length === 0) return;
		const wrapped = (index + ids.length) % ids.length;
		buttons[wrapped]?.focus();
	}

	function onOptionKeydown(event: KeyboardEvent, index: number): void {
		if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
			event.preventDefault();
			focusAt(index + 1);
			return;
		}
		if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
			event.preventDefault();
			focusAt(index - 1);
		}
	}
</script>

<svelte:window onkeydown={onWindowKeydown} />

<div class="backdrop" in:fade={{ duration: transitionDuration($reducedMotion, 160) }}>
	<div
		class="draft"
		role="dialog"
		aria-modal="true"
		aria-label="Upgrade draft"
		in:fly={{ y: 8, duration: transitionDuration($reducedMotion, 180) }}
		use:trapFocus
	>
		<p class="kicker mono">
			HEAT MILESTONE{pending > 1 ? ` // ${pending} DRAFTS` : ''}
		</p>
		<h2>Choose one upgrade</h2>
		<p class="hint">The run pauses until you choose. Press 1, 2, or 3.</p>

		<ul class="options">
			{#each ids as id, index (id + index)}
				{@const upgrade = record(id)}
				<li>
					<button
						bind:this={buttons[index]}
						type="button"
						class="option"
						aria-label={`${index + 1} ${upgrade?.name ?? id}: ${upgrade?.description ?? 'Upgrade'} ${upgrade?.kind ?? 'upgrade'}`}
						onclick={() => pick(index)}
						onkeydown={(event) => onOptionKeydown(event, index)}
					>
						<span class="number mono" aria-hidden="true">{index + 1}&nbsp;</span>
						<span class="body">
							<span class="name">{upgrade?.name ?? id}&nbsp;</span>
							<span class="description">{upgrade?.description ?? 'Upgrade'}&nbsp;</span>
						</span>
						<span class="kind mono" aria-hidden="true">{upgrade?.kind ?? 'upgrade'}</span>
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
		max-height: calc(100vh - 44px);
		max-height: calc(100dvh - 44px);
		overflow-y: auto;
		overscroll-behavior: contain;
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

	.options {
		display: grid;
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.option {
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

	@media (hover: hover) {
		.option:hover {
			border-color: var(--lime);
			box-shadow: 0 0 16px rgba(182, 255, 92, 0.16);
		}
	}

	.option:focus-visible {
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
		line-height: 1.4;
		color: var(--muted);
	}

	.kind {
		font-size: 8px;
		letter-spacing: 0.12em;
		color: var(--muted);
		text-transform: uppercase;
	}
</style>
