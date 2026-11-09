<script lang="ts">
	import { contractById } from '../data/contracts';
	import { ELEMENT_BY_SYMBOL, ELEMENTS } from '../data/elements';
	import { MODULE_BY_ID } from '../data/modules';
	import { PATCH_BY_ID } from '../data/patches';
	import { RECIPES } from '../data/recipes';
	import { contractCount, ventAmount } from '../game/effects';
	import { previewPlacement, type PlacementPreview } from '../game/fusion';
	import { playSound } from '../game/sound';
	import { reducedMotion } from '../stores/motion';
	import {
		chooseDraft,
		deliver,
		discardCard,
		newRun,
		nextSector,
		place,
		run,
		scrap,
		vent
	} from '../stores/game';
	import CardPicker from './CardPicker.svelte';
	import DraftOverlay from './DraftOverlay.svelte';
	import EndScreen from './EndScreen.svelte';
	import ParticleField from './ParticleField.svelte';
	import PressureGauge from './PressureGauge.svelte';
	import PreviewOverlay from './PreviewOverlay.svelte';
	import SectorTransition from './SectorTransition.svelte';

	let {
		onMenu
	}: {
		onMenu?: () => void;
	} = $props();

	let selected = $state<number | null>(null);
	let targetCell = $state<number | null>(null);
	let preview = $state<PlacementPreview | null>(null);
	let ventOpen = $state(false);
	let scrapping = $state(false);
	let burst = $state(0);
	let lastStatus = 'active';

	const contract = $derived($run ? contractById($run.contractId) : null);
	const targetName = $derived(
		contract ? (ELEMENT_BY_SYMBOL.get(contract.target)?.name ?? contract.target) : ''
	);
	const count = $derived($run ? contractCount($run) : 0);
	const deliverCell = $derived(
		$run && contract ? $run.grid.findIndex((tile) => tile === contract.target) : -1
	);
	const complete = $derived(Boolean($run && contract && $run.delivered >= count));
	const locked = $derived(
		Boolean($run && ($run.pendingDraft || $run.pendingTransition || $run.status !== 'active'))
	);

	function modifierLabel(modifier: string): string {
		if (modifier === 'one-chain') return 'finish in chains of 2 or more';
		if (modifier === 'no-vent') return 'without venting';
		if (modifier === 'pressure-50') return 'at 50+ pressure';
		if (modifier === 'two-targets') return 'deliver two different targets';
		return modifier;
	}

	function chooseCell(cell: number): void {
		if (locked) return;
		if (scrapping) {
			scrap(cell);
			scrapping = false;
			return;
		}
		if (selected === null || !$run) return;
		const result = previewPlacement($run, selected, cell, ELEMENTS, RECIPES);
		if (!result) return;
		preview = result;
		targetCell = cell;
	}

	$effect(() => {
		const status = $run?.status;
		if (!status || status === lastStatus) return;
		lastStatus = status;
		if (status === 'meltdown') playSound('meltdown');
		if (status === 'victory') playSound('victory');
	});

	function confirm(): void {
		if (locked || selected === null || targetCell === null) return;
		playSound('fusion');
		burst += 1;
		place(selected, targetCell);
		selected = null;
		targetCell = null;
		preview = null;
	}

	function handleDeliver(): void {
		if (deliverCell < 0 || locked) return;
		playSound('contract');
		deliver(deliverCell);
	}

	function cancel(): void {
		preview = null;
		targetCell = null;
	}
</script>

{#if $run && contract}
	<main class="app" class:shake={$run.status === 'meltdown'}>
		<header class="top">
			<div>
				<p class="kicker mono">SECTOR {contract.sector} // CONTRACT {contract.slot}/5</p>
				<h1>CRITICAL MASS</h1>
				<p class="research mono">RESEARCH +{$run.researchEarned}</p>
			</div>
			<div class="top-right">
				<PressureGauge value={$run.pressure} cap={$run.pressureCap} />
				{#if onMenu}
					<button class="menu" type="button" onclick={onMenu}>Menu</button>
				{/if}
			</div>
		</header>

		<section class="contract" aria-label="Active contract">
			<div>
				<p class="label mono">DELIVER</p>
				<p class="target">
					{count} × {targetName}
					<span class="progress mono">{$run.delivered} / {count}</span>
				</p>
				{#if contract.modifier}
					<p class="modifier">BONUS: {modifierLabel(contract.modifier)}</p>
				{/if}
				<p class="brief">“{contract.brief}”</p>
			</div>
			{#if complete}
				<p class="complete">CONTRACT COMPLETE</p>
			{:else}
				<button
					type="button"
					class="deliver"
					disabled={deliverCell < 0 || locked}
					onclick={handleDeliver}
				>
					Deliver {targetName}
				</button>
			{/if}
		</section>

		<section class="reactor" aria-label="Reactor grid">
			{#each $run.grid as tile, index (index)}
				<button
					type="button"
					class="cell"
					class:filled={!!tile}
					class:target={tile === contract.target}
					aria-label={`cell ${index}`}
					disabled={locked}
					onclick={() => chooseCell(index)}
				>
					{#if tile}
						<span class="symbol">{tile}</span>
						<span class="name">{ELEMENT_BY_SYMBOL.get(tile)?.name ?? ''}</span>
					{:else}
						<span class="void">·</span>
					{/if}
				</button>
			{/each}
		</section>

		<div class="actions">
			<button
				type="button"
				disabled={$run.hand.length === 0 || locked}
				onclick={() => (ventOpen = true)}
			>
				Vent −{ventAmount($run)}
			</button>
			<button
				type="button"
				class:active={scrapping}
				disabled={$run.scrapsUsed >= 1 || locked}
				onclick={() => (scrapping = !scrapping)}
			>
				{scrapping ? 'Cancel scrap' : 'Scrap tile'}
			</button>
		</div>

		{#if $run.modules.length > 0 || $run.patches.length > 0}
			<section class="modules" aria-label="Reactor modules">
				{#each $run.modules as id (id)}
					<span class="module">{MODULE_BY_ID.get(id)?.name ?? id}</span>
				{/each}
				{#each $run.patches as id (id)}
					<span class="module patch">{PATCH_BY_ID.get(id)?.name ?? id}</span>
				{/each}
			</section>
		{/if}

		<section class="hand" aria-label="Hand">
			<p class="label mono">HAND // {$run.hand.length}</p>
			<div class="cards">
				{#each $run.hand as card, index (index)}
					<button
						type="button"
						class="card"
						class:selected={selected === index}
						aria-pressed={selected === index}
						aria-label={`${ELEMENT_BY_SYMBOL.get(card)?.name ?? card} card ${index + 1}`}
						disabled={locked}
						onclick={() => {
							if (selected !== index) playSound('pick');
							selected = selected === index ? null : index;
						}}
					>
						<span class="card-symbol">{card}</span>
						<span class="card-name">{ELEMENT_BY_SYMBOL.get(card)?.name ?? card}</span>
					</button>
				{/each}
			</div>
		</section>
		<ParticleField
			seed={$run.rngState}
			{burst}
			mode={$run.status === 'meltdown' ? 'meltdown' : 'fusion'}
			reducedMotion={$reducedMotion}
		/>
	</main>

	{#if preview && selected !== null}
		<PreviewOverlay {preview} onConfirm={confirm} onCancel={cancel} />
	{/if}

	{#if $run.pendingDraft}
		<DraftOverlay
			options={$run.pendingDraft}
			kind={$run.pendingDraftKind ?? 'contract'}
			onPick={chooseDraft}
		/>
	{:else if $run.pendingTransition}
		<SectorTransition sector={$run.sector} onEnter={nextSector} />
	{:else if $run.status === 'meltdown' || $run.status === 'victory'}
		<EndScreen status={$run.status} run={$run} onNewRun={newRun} />
	{:else if $run.pendingDiscards > 0}
		<CardPicker
			title="Discard down to seven"
			description="The hand is over capacity. Choose a card to lose."
			cards={$run.hand}
			onPick={(index) => discardCard(index)}
		/>
	{:else if ventOpen}
		<CardPicker
			title="Vent pressure"
			description="Venting costs one card. It cannot go below the sector floor."
			cards={$run.hand}
			onPick={(index) => {
				playSound('vent');
				vent(index);
				ventOpen = false;
			}}
			onCancel={() => (ventOpen = false)}
		/>
	{/if}
{/if}

<style>
	.top {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 12px;
	}

	.top-right {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 6px;
	}

	.menu {
		min-height: 44px;
		padding: 5px 10px;
		font-size: 10px;
		font-weight: 700;
		color: var(--muted);
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: 6px;
	}

	.kicker {
		margin: 0 0 4px;
		font-size: 9px;
		letter-spacing: 0.16em;
		color: var(--cyan);
	}

	h1 {
		font-size: clamp(1.6rem, 6.6vw, 2.4rem);
		letter-spacing: 0.02em;
	}

	.research {
		margin: 3px 0 0;
		font-size: 9px;
		letter-spacing: 0.14em;
		color: var(--lime);
	}

	.contract {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 10px 12px;
		background: var(--panel);
		border: 1px solid var(--line);
		border-left: 2px solid var(--amber);
		border-radius: 8px;
	}

	.label {
		margin: 0 0 3px;
		font-size: 8px;
		letter-spacing: 0.18em;
		color: var(--muted);
	}

	.target {
		display: flex;
		align-items: baseline;
		gap: 8px;
		margin: 0;
		font-size: 14px;
		font-weight: 700;
	}

	.progress {
		font-size: 10px;
		color: var(--amber);
	}

	.brief {
		margin: 3px 0 0;
		font-size: 10px;
		font-style: italic;
		color: var(--muted);
	}

	.modifier {
		margin: 4px 0 0;
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.08em;
		color: var(--lime);
	}

	.deliver {
		flex-shrink: 0;
		min-height: 38px;
		padding: 6px 9px;
		font-size: 11px;
		font-weight: 700;
		color: #1a0f00;
		background: var(--amber);
		border: 0;
		border-radius: 6px;
	}

	.deliver:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.complete {
		margin: 0;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.12em;
		color: var(--lime);
	}

	.reactor {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 6px;
		margin: 12px 0;
		padding: 10px;
		background: rgba(13, 20, 36, 0.7);
		border: 1px solid var(--line);
		border-radius: 12px;
		box-shadow: inset 0 0 26px rgba(56, 225, 255, 0.05);
	}

	.cell {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1px;
		aspect-ratio: 1;
		padding: 3px;
		background: rgba(56, 225, 255, 0.03);
		border: 1px dashed rgba(56, 225, 255, 0.2);
		border-radius: 6px;
	}

	.cell.filled {
		background: var(--panel-2);
		border: 1px solid rgba(56, 225, 255, 0.55);
		box-shadow: 0 0 10px rgba(56, 225, 255, 0.12);
	}

	.cell.target {
		border-color: var(--amber);
		box-shadow: 0 0 12px rgba(255, 179, 71, 0.25);
	}

	.symbol {
		font-family: 'JetBrains Mono Variable', monospace;
		font-size: 18px;
		font-weight: 700;
		color: var(--cyan);
		text-shadow: 0 0 10px rgba(56, 225, 255, 0.5);
	}

	.name {
		max-width: 100%;
		font-size: 7px;
		color: var(--muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.void {
		color: rgba(143, 163, 194, 0.25);
	}

	.actions {
		display: flex;
		gap: 8px;
		margin-bottom: 8px;
	}

	.actions button {
		flex: 1;
		min-height: 38px;
		font-size: 12px;
		font-weight: 700;
		color: var(--muted);
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: 7px;
	}

	.actions button.active {
		color: var(--void);
		background: var(--amber);
		border-color: var(--amber);
	}

	.actions button:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.modules {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
		margin-bottom: 8px;
	}

	.module {
		padding: 3px 7px;
		font-size: 9px;
		color: var(--lime);
		background: rgba(182, 255, 92, 0.07);
		border: 1px solid rgba(182, 255, 92, 0.25);
		border-radius: 999px;
	}

	.module.patch {
		color: var(--amber);
		background: rgba(255, 179, 71, 0.07);
		border-color: rgba(255, 179, 71, 0.25);
	}

	.hand {
		padding: 10px 12px 12px;
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: 10px;
	}

	.cards {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		padding: 3px 1px 5px;
	}

	.card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1px;
		flex: 0 0 auto;
		width: 64px;
		min-height: 72px;
		padding: 8px 5px 5px;
		background: var(--panel-2);
		border: 1px solid rgba(56, 225, 255, 0.35);
		border-radius: 7px;
	}

	.card.selected {
		border-color: var(--cyan);
		box-shadow: 0 0 14px rgba(56, 225, 255, 0.35);
	}

	.card-symbol {
		font-family: 'JetBrains Mono Variable', monospace;
		font-size: 22px;
		font-weight: 700;
		color: var(--cyan);
	}

	.card-name {
		font-size: 7px;
		color: var(--muted);
	}
</style>
