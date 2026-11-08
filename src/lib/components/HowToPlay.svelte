<script lang="ts">
	let { onBack }: { onBack: () => void } = $props();
</script>

<main class="app howto">
	<header class="head">
		<div>
			<p class="kicker mono">REACTOR CONTROL // MANUAL</p>
			<h1>How to play</h1>
		</div>
		<button class="back" type="button" onclick={onBack}>Back to title</button>
	</header>

	<section>
		<h2>The turn</h2>
		<p>
			Each turn you draw a card, then choose one action: place a card on an empty cell, or vent
			pressure. Delivering a matching tile is free, and you may scrap one tile per turn.
		</p>
	</section>

	<section>
		<h2>Fusion</h2>
		<p>
			Only the tile you just placed fuses. The reactor checks north, east, south, then west,
			consuming the first compatible neighbour and repeating from the active cell. Cards are
			actions; tiles are board state.
		</p>
	</section>

	<section>
		<h2>Pressure</h2>
		<p>
			Every fusion raises pressure. At or above the cap, the run melts down. Venting lowers pressure
			by 15, costs one card, and never drops below the sector floor.
		</p>
	</section>

	<section>
		<h2>Contracts</h2>
		<p>
			Deliver the target element the stated number of times. Every completed contract opens a
			mandatory draft of three upgrades: a card bundle, a reactor module, and a one-run patch. Bonus
			objectives add research but never gate the contract.
		</p>
	</section>

	<section>
		<h2>Preview</h2>
		<p>
			Select a card, then a cell. The preview shows every chain step, the final tile, and the exact
			pressure change. Confirm to commit; cancel changes nothing.
		</p>
	</section>

	<section>
		<h2>Winning and losing</h2>
		<p>
			Complete the sector 3 boss to win. Reach the pressure cap to melt down. Research earned from
			contracts and bosses persists and buys pool-widening unlocks in the Research Lab.
		</p>
	</section>
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
		margin: 0 0 5px;
		font-size: 1rem;
		color: var(--cyan);
	}

	section {
		margin-bottom: 12px;
		padding: 12px;
		background: var(--panel);
		border: 1px solid var(--line);
		border-left: 2px solid var(--cyan);
		border-radius: 8px;
	}

	p {
		margin: 0;
		font-size: 12px;
		line-height: 1.55;
		color: var(--muted);
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
