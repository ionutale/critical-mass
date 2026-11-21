<script lang="ts">
	import { fly } from 'svelte/transition';
	import { PASSIVE_HEAT } from '../../game/arcade/heat';
	import { reducedMotion, transitionDuration } from '../../stores/motion';

	let { onBack }: { onBack: () => void } = $props();
</script>

<main
	class="app howto"
	in:fly|global={{ y: 10, duration: transitionDuration($reducedMotion, 200) }}
>
	<header class="head">
		<div>
			<p class="kicker mono">REACTOR CONTROL // MANUAL</p>
			<h1>How to play</h1>
		</div>
		<button class="back" type="button" onclick={onBack}>Back to title</button>
	</header>

	<section>
		<h2>The valence rule</h2>
		<p>
			Every element has a valence (1–4, its column) and a mass tier (1–3, its row). Two tiles fuse
			when their valence sum is 4 or less. The result sits at that valence sum and at the higher of
			the two masses.
		</p>
		<div class="example" data-testid="valence-example">
			<p class="equation mono">H + H → He</p>
			<p class="names">Hydrogen + Hydrogen → Helium</p>
			<p class="math">
				Valence 1 + 1 = 2; the higher mass is 1, so the result is Helium. A fusion like H + Li sums
				to valence 2 as well, but its higher mass is 2, so it makes Beryllium instead.
			</p>
		</div>
	</section>

	<section>
		<h2>Heat</h2>
		<p>
			Every fusion adds Heat equal to the result's valence, plus 1 for each chain step after the
			first. Each turn then adds {PASSIVE_HEAT} passive Heat. Reach the cap (100) and the reactor overloads:
			the run is over, and its score is counted.
		</p>
	</section>

	<section>
		<h2>Stabilize</h2>
		<p>
			Stabilize discards one card to remove 15 Heat, never below the rising floor of {PASSIVE_HEAT} ×
			the turn number. It ends the turn and draws nothing, so it buys time at the cost of a card.
		</p>
	</section>

	<section>
		<h2>Scrap</h2>
		<p>
			Scrap removes one placed tile for free, once per turn, and does not end the turn. Use it to
			clear a cell or break a chain you do not want.
		</p>
	</section>

	<section>
		<h2>Milestones</h2>
		<p>
			Crossing 25, 50, and 75 Heat each queues one Upgrade draft. The run pauses until you choose 1
			of 3: a card bundle or a run modifier. Crossing the same milestone again never refunds a
			second draft.
		</p>
	</section>

	<section>
		<h2>Controls</h2>
		<ul aria-label="Controls">
			<li><strong>Drag:</strong> drag a card from the hand onto an empty cell to place it.</li>
			<li>
				<strong>Tap:</strong> tap a card, then tap an empty cell to open the preview; confirm to commit
				exactly that path.
			</li>
			<li>
				<strong>Keyboard:</strong> focus a card, use the arrow keys to move the targeting ghost, Enter
				or Space to commit, and Escape to cancel.
			</li>
			<li>
				<strong>Swipe:</strong> swipe up on the reactor to open the Stabilize picker, or swipe down to
				cancel the current selection.
			</li>
			<li>
				<strong>Swipe off:</strong> drag a handled card off the board to cancel it; drag a placed tile
				off its cell to Scrap it.
			</li>
		</ul>
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

	.example {
		margin-top: 10px;
		padding: 10px;
		background: var(--panel-2);
		border-radius: 6px;
	}

	.equation {
		margin: 0;
		font-size: 18px;
		font-weight: 700;
		color: var(--lime);
	}

	.names {
		margin: 3px 0 6px;
		font-size: 11px;
		color: var(--text);
	}

	.math {
		font-size: 11px;
	}

	ul {
		display: grid;
		gap: 7px;
		margin: 0;
		padding-left: 18px;
	}

	li {
		font-size: 12px;
		line-height: 1.5;
		color: var(--muted);
	}

	li strong {
		color: var(--text);
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
