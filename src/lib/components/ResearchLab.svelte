<script lang="ts">
	import { UNLOCKS } from '../data/unlocks';
	import { save, unlock } from '../stores/game';
	import type { UnlockRecord } from '../types';

	let { onBack }: { onBack: () => void } = $props();

	const tracks: { kind: UnlockRecord['kind']; title: string; blurb: string }[] = [
		{ kind: 'card', title: 'Card pool', blurb: 'Widen the element bundles in future drafts.' },
		{ kind: 'module', title: 'Module pool', blurb: 'Add reactor modules to future drafts.' },
		{ kind: 'contract', title: 'Contract tools', blurb: 'Add contract-shaping options to drafts.' }
	];

	let confirming = $state<UnlockRecord | null>(null);

	function nodesFor(kind: UnlockRecord['kind']): UnlockRecord[] {
		return UNLOCKS.filter((node) => node.kind === kind);
	}

	function bought(node: UnlockRecord): boolean {
		return $save.meta.unlocks.includes(node.id);
	}

	function affordable(node: UnlockRecord): boolean {
		return $save.meta.research >= node.cost;
	}

	function confirmPurchase(): void {
		if (!confirming) return;
		unlock(confirming.id);
		confirming = null;
	}
</script>

<main class="app lab">
	<header class="head">
		<div>
			<p class="kicker mono">BETWEEN RUNS // META PROGRESSION</p>
			<h1>Research Lab</h1>
		</div>
		<button class="back" type="button" onclick={onBack}>Back to title</button>
	</header>

	<section class="balance" aria-label="Research balance">
		<p class="mono">{$save.meta.research} RESEARCH</p>
		<p>Unlocks only widen the draft pools. They never raise permanent stats.</p>
	</section>

	<section class="stats" aria-label="Run statistics">
		<div><span>Runs</span><strong>{$save.meta.stats.runs}</strong></div>
		<div><span>Wins</span><strong>{$save.meta.stats.wins}</strong></div>
		<div><span>Best sector</span><strong>{$save.meta.stats.bestSector}</strong></div>
		<div><span>Contracts</span><strong>{$save.meta.stats.contracts}</strong></div>
	</section>

	{#each tracks as track (track.kind)}
		<section class="track" aria-labelledby={`track-${track.kind}`}>
			<div class="track-head">
				<h2 id={`track-${track.kind}`}>{track.title}</h2>
				<p>{track.blurb}</p>
			</div>
			<ul>
				{#each nodesFor(track.kind) as node (node.id)}
					{@const owned = bought(node)}
					{@const canBuy = !owned && affordable(node)}
					<li>
						<div class="node">
							<div>
								<p class="name">{node.name}</p>
								<p class="description">{node.description}</p>
							</div>
							<span class="cost mono">{owned ? 'OWNED' : `${node.cost} RP`}</span>
							<button type="button" disabled={!canBuy} onclick={() => (confirming = node)}>
								{owned ? 'Owned' : canBuy ? `Unlock ${node.name}` : 'Not enough research'}
							</button>
						</div>
					</li>
				{/each}
			</ul>
		</section>
	{/each}

	{#if confirming}
		<div class="confirm" role="dialog" aria-label="Confirm research purchase">
			<h2>Spend research?</h2>
			<p>
				Buy <strong>{confirming.name}</strong> for
				<span class="mono">{confirming.cost} RP</span>?
			</p>
			<div class="confirm-actions">
				<button class="buy" type="button" onclick={confirmPurchase}>Confirm purchase</button>
				<button type="button" onclick={() => (confirming = null)}>Cancel</button>
			</div>
		</div>
	{/if}
</main>

<style>
	.head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
		margin-bottom: 12px;
	}

	.kicker {
		margin: 0 0 4px;
		font-size: 8px;
		letter-spacing: 0.18em;
		color: var(--cyan);
	}

	h1 {
		font-size: clamp(1.7rem, 7vw, 2.5rem);
	}

	h2 {
		font-size: 1.05rem;
	}

	.back {
		flex: 0 0 auto;
		min-height: 44px;
		padding: 8px 10px;
		font-size: 11px;
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: 7px;
	}

	.balance {
		padding: 10px 12px;
		background: var(--panel);
		border: 1px solid var(--line);
		border-left: 2px solid var(--lime);
		border-radius: 8px;
	}

	.balance p {
		margin: 0;
		font-size: 11px;
		color: var(--muted);
	}

	.balance p.mono {
		margin-bottom: 4px;
		font-size: 14px;
		font-weight: 700;
		color: var(--lime);
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 6px;
		margin: 10px 0 16px;
	}

	.stats div {
		padding: 7px 8px;
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: 6px;
	}

	.stats span {
		display: block;
		font-size: 7px;
		letter-spacing: 0.12em;
		color: var(--muted);
		text-transform: uppercase;
	}

	.stats strong {
		font-family: 'JetBrains Mono Variable', monospace;
		font-size: 13px;
	}

	.track {
		margin-bottom: 16px;
	}

	.track-head {
		margin-bottom: 7px;
	}

	.track-head p {
		margin: 2px 0 0;
		font-size: 10px;
		color: var(--muted);
	}

	ul {
		display: grid;
		gap: 6px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.node {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 5px 8px;
		align-items: center;
		padding: 9px 10px;
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: 7px;
	}

	.name {
		margin: 0;
		font-size: 12px;
		font-weight: 700;
	}

	.description {
		margin: 2px 0 0;
		font-size: 10px;
		line-height: 1.35;
		color: var(--muted);
	}

	.cost {
		font-size: 9px;
		color: var(--lime);
	}

	.node button {
		grid-column: 1 / -1;
		min-height: 44px;
		font-size: 11px;
		font-weight: 700;
		color: var(--void);
		background: var(--cyan);
		border: 0;
		border-radius: 6px;
	}

	.node button:disabled {
		color: var(--muted);
		background: var(--panel-2);
		border: 1px solid var(--line);
		cursor: not-allowed;
	}

	.confirm {
		position: fixed;
		inset: 0;
		z-index: 30;
		display: flex;
		flex-direction: column;
		justify-content: center;
		width: min(340px, calc(100% - 36px));
		height: fit-content;
		margin: auto;
		padding: 18px;
		background: var(--panel);
		border: 1px solid var(--lime);
		border-radius: 12px;
		box-shadow: 0 0 34px rgba(182, 255, 92, 0.2);
	}

	.confirm p {
		margin: 6px 0 14px;
		font-size: 12px;
		color: var(--muted);
	}

	.confirm-actions {
		display: grid;
		gap: 7px;
	}

	.confirm-actions button {
		min-height: 44px;
		font-size: 12px;
		font-weight: 700;
		background: var(--panel-2);
		border: 1px solid var(--line);
		border-radius: 7px;
	}

	.confirm-actions button.buy {
		color: var(--void);
		background: var(--lime);
		border-color: var(--lime);
	}
</style>
