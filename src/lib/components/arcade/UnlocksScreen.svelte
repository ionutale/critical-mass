<script lang="ts">
	import { fly } from 'svelte/transition';
	import { UNLOCKS } from '../../data/arcade/unlocks';
	import type { UnlockRecord } from '../../data/arcade/unlocks';
	import { metricValue } from '../../game/arcade/meta';
	import { save } from '../../stores/arcade';
	import { reducedMotion, transitionDuration } from '../../stores/motion';

	let { onBack }: { onBack: () => void } = $props();

	const unlocked = $derived($save.meta.unlocks.length);
	const total = UNLOCKS.length;

	const KIND_LABEL: Record<UnlockRecord['kind'], string> = {
		starter: 'Starter card',
		pool: 'Upgrade pool',
		challenge: 'Challenge'
	};

	function owned(unlock: UnlockRecord): boolean {
		return $save.meta.unlocks.includes(unlock.id);
	}

	function progress(unlock: UnlockRecord): number {
		return Math.min(metricValue($save.meta, unlock.metric), unlock.threshold);
	}

	function requirement(unlock: UnlockRecord): string {
		switch (unlock.metric) {
			case 'totalScore':
				return `${unlock.threshold} total score`;
			case 'bestChain':
				return `Chain of ${unlock.threshold}`;
			case 'runs':
				return `${unlock.threshold} completed runs`;
		}
	}
</script>

<main
	class="app unlocks"
	in:fly|global={{ y: 10, duration: transitionDuration($reducedMotion, 200) }}
>
	<header class="head">
		<div>
			<p class="kicker mono">REACTOR CONTROL // PROGRESSION</p>
			<h1>Unlocks</h1>
		</div>
		<button class="back" type="button" onclick={onBack}>Back to title</button>
	</header>

	<p class="intro">
		Lifetime milestones unlock automatically. They only add options — a starter card, a card in the
		draft pool, or a challenge modifier — and never raise a base stat or gate an element.
	</p>

	<p class="count mono" data-testid="unlock-count">
		{unlocked} of {total} unlocked
	</p>

	<ul class="nodes" aria-label="Unlock nodes">
		{#each UNLOCKS as unlock (unlock.id)}
			{@const isOwned = owned(unlock)}
			{@const current = progress(unlock)}
			<li class="node" class:owned={isOwned}>
				<div class="node-head">
					<h2>{unlock.name}</h2>
					<span
						class="status mono"
						data-testid={`unlock-status-${unlock.id}`}
						class:owned={isOwned}
					>
						{isOwned ? 'Unlocked' : 'Locked'}
					</span>
				</div>
				<p class="description">{unlock.description}</p>
				<div class="meta">
					<span class="kind mono">{KIND_LABEL[unlock.kind]}</span>
					<span class="requirement mono">{requirement(unlock)}</span>
				</div>
				<div class="progress">
					<div
						class="track"
						role="progressbar"
						aria-label={`${unlock.name} progress`}
						aria-valuemin="0"
						aria-valuemax={unlock.threshold}
						aria-valuenow={current}
						aria-valuetext={`${current} of ${unlock.threshold}`}
					>
						<div
							class="fill"
							style:width={`${unlock.threshold === 0 ? 0 : (current / unlock.threshold) * 100}%`}
						></div>
					</div>
					<span class="numbers mono" data-testid={`unlock-threshold-${unlock.id}`}>
						{current} / {unlock.threshold}
					</span>
				</div>
			</li>
		{/each}
	</ul>
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

	.intro {
		margin: 0 0 10px;
		font-size: 12px;
		line-height: 1.5;
		color: var(--muted);
	}

	.count {
		margin: 0 0 10px;
		font-size: 9px;
		letter-spacing: 0.14em;
		color: var(--lime);
	}

	.nodes {
		display: grid;
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.node {
		padding: 11px 12px;
		background: var(--panel);
		border: 1px solid var(--line);
		border-left: 2px solid var(--muted);
		border-radius: 8px;
	}

	.node.owned {
		border-left-color: var(--lime);
	}

	.node-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 10px;
	}

	h2 {
		font-size: 0.98rem;
	}

	.status {
		flex: 0 0 auto;
		font-size: 8px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.status.owned {
		color: var(--lime);
	}

	.description {
		margin: 3px 0 7px;
		font-size: 11px;
		line-height: 1.45;
		color: var(--muted);
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 10px;
		margin-bottom: 7px;
		font-size: 8px;
		letter-spacing: 0.06em;
		color: var(--muted);
		text-transform: uppercase;
	}

	.kind {
		color: var(--cyan);
	}

	.progress {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.track {
		flex: 1;
		height: 5px;
		overflow: hidden;
		background: var(--panel-2);
		border-radius: 999px;
	}

	.fill {
		height: 100%;
		background: var(--cyan);
		border-radius: inherit;
	}

	.owned .fill {
		background: var(--lime);
	}

	.numbers {
		flex: 0 0 auto;
		font-size: 8px;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
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
</style>
