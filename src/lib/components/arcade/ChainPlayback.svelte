<script lang="ts">
	import { onMount } from 'svelte';
	import type { ElementSymbol } from '../../types';
	import { dealIn, flight, mergeGhosts, pulse, shake, tweenBar, tweenNumber } from './choreography';
	import type { ChoreographyRefs, MotionHandle, PlaybackModel } from './choreography';

	let {
		playback,
		refs,
		reducedMotion = false,
		onDone
	}: {
		playback: PlaybackModel;
		refs: ChoreographyRefs;
		reducedMotion?: boolean;
		onDone: () => void;
	} = $props();

	/** Card flight and the merge stagger share one fixed playback budget. */
	const FLIGHT_MS = 200;
	const MERGE_MS = 300;
	const MAX_STAGGER = 520;
	const stagger = $derived(
		playback.steps.length > 0 ? Math.min(120, MAX_STAGGER / playback.steps.length) : 0
	);
	const mergesEnd = $derived(
		FLIGHT_MS + Math.max(0, playback.steps.length - 1) * stagger + MERGE_MS
	);
	const total = $derived(mergesEnd + 260);

	const gain = $derived(playback.scoreTo - playback.scoreFrom);

	let layer = $state<HTMLElement | null>(null);
	/** The surviving cell steps through each chain result, then settles. */
	let resultSymbol = $state<ElementSymbol | null>(null);

	onMount(() => {
		resultSymbol = playback.card;

		if (reducedMotion) {
			resultSymbol = playback.steps[playback.steps.length - 1]?.result ?? playback.card;
			onDone();
			return;
		}

		const running: (Animation | null)[] = [];
		const handles: MotionHandle[] = [];
		const timers: number[] = [];
		let timer = 0;

		const originCell =
			refs.stage?.querySelector<HTMLElement>(`button[data-cell="${playback.originCell}"]`) ?? null;
		const surviving = layer?.querySelector<HTMLElement>('.chain-ghost.surviving') ?? null;
		const consumed = [
			...(layer?.querySelectorAll<HTMLElement>('.chain-ghost:not(.surviving)') ?? [])
		];

		// 1. The placed card flies from the hand to its cell.
		const flightGhost = layer?.querySelector<HTMLElement>('[data-testid="flight-ghost"]');
		if (flightGhost && originCell) {
			running.push(flight(flightGhost, originCell, { duration: FLIGHT_MS }));
		}

		// 2. The spent card falls away to the discard pile.
		const discardGhost = layer?.querySelector<HTMLElement>('[data-testid="discard-ghost"]');
		if (discardGhost && refs.discard) {
			running.push(
				flight(discardGhost, refs.discard, { duration: FLIGHT_MS, delay: FLIGHT_MS * 0.6 })
			);
		}

		// 3. Consumed tiles slide into the result in chain order; each merge pops
		//    the survivor so the previous result carries forward.
		const mergeTarget = originCell ?? surviving;
		if (mergeTarget) {
			running.push(
				...mergeGhosts(consumed, mergeTarget, {
					duration: MERGE_MS,
					delay: FLIGHT_MS,
					stagger
				})
			);
		}
		playback.steps.forEach((step, index) => {
			if (!surviving) return;
			const at = FLIGHT_MS + index * stagger + MERGE_MS * 0.8;
			running.push(pulse(surviving, { duration: 240, delay: at }));
			// Carry the chain forward: the survivor shows each intermediate result.
			timers.push(
				window.setTimeout(() => {
					resultSymbol = step.result;
				}, at)
			);
		});

		// 4. The committed result pops, then settles.
		if (originCell) {
			running.push(pulse(originCell, { duration: 260, delay: mergesEnd }));
		}

		// 5. The score floats and counts up; the heat bar tweens to its value.
		const scoreValue =
			refs.score?.querySelector<HTMLElement>('[data-testid="score-value"]') ?? null;
		if (scoreValue) {
			handles.push(
				tweenNumber(scoreValue, playback.scoreFrom, playback.scoreTo, {
					duration: 520,
					delay: FLIGHT_MS
				})
			);
		}

		const fill = refs.heat?.querySelector<HTMLElement>('.fill') ?? null;
		if (fill) {
			// The committed width lands at once; the tween is the composited scaleX.
			fill.style.transition = 'none';
			const from = playback.heatTo > 0 ? playback.heatFrom / playback.heatTo : 1;
			running.push(tweenBar(fill, from, { duration: 440, delay: FLIGHT_MS }));
		}

		// 6. Heat milestones pulse as the bar reaches them.
		refs.heat?.querySelectorAll<HTMLElement>('.milestones li').forEach((item, index) => {
			const threshold = Number(item.textContent?.trim() ?? '');
			if (!Number.isFinite(threshold)) return;
			if (playback.heatFrom >= threshold || playback.heatTo < threshold) return;
			const mark = item.querySelector<HTMLElement>('.mark') ?? item;
			running.push(pulse(mark, { duration: 260, delay: FLIGHT_MS + 120 + index * 60 }));
		});

		// 7. Hand refills deal in; a new placement deals its own cards.
		const cards = [...(refs.hand?.querySelectorAll<HTMLElement>('.cards > button') ?? [])];
		cards.slice(playback.keptHand).forEach((card, index) => {
			running.push(dealIn(card, { delay: FLIGHT_MS + index * 40 }));
		});

		// 8. Overload surges the bar and shakes the reactor.
		if (playback.overload) {
			if (refs.stage) running.push(shake(refs.stage, { duration: 360, delay: mergesEnd }));
			if (fill) running.push(pulse(fill, { duration: 420, delay: mergesEnd }));
		}

		timer = window.setTimeout(onDone, total + 40);

		return () => {
			clearTimeout(timer);
			for (const stepTimer of timers) clearTimeout(stepTimer);
			for (const handle of handles) handle.cancel();
			for (const animation of running) animation?.cancel();
			if (fill) fill.style.transition = '';
		};
	});

	const scoreX = $derived(playback.score ? playback.score.left : 0);
	const scoreY = $derived(playback.score ? playback.score.top : 0);
</script>

<div
	class="chain-playback"
	data-testid="chain-playback"
	data-choreography="chain"
	aria-hidden="true"
	bind:this={layer}
	style:position="absolute"
	style:inset="0"
	style:pointer-events="none"
>
	{#if playback.flight}
		<span
			class="flight-ghost"
			data-testid="flight-ghost"
			style:left={`${playback.flight.left}px`}
			style:top={`${playback.flight.top}px`}
			style:width={`${playback.flight.width}px`}
			style:height={`${playback.flight.height}px`}
		>
			<span class="symbol" aria-hidden="true">{playback.card}</span>
		</span>
		{#if playback.discard}
			<span
				class="discard-ghost"
				data-testid="discard-ghost"
				style:left={`${playback.flight.left}px`}
				style:top={`${playback.flight.top}px`}
			>
				<span class="symbol" aria-hidden="true">{playback.card}</span>
			</span>
		{/if}
	{/if}

	{#each playback.ghosts as ghost (ghost.cell)}
		<span
			class="chain-ghost"
			class:surviving={ghost.surviving}
			data-testid="chain-ghost"
			data-cell={ghost.cell}
			data-step={ghost.step === 'result' ? 'result' : String(ghost.step)}
			style:left={`${ghost.box?.left ?? 0}px`}
			style:top={`${ghost.box?.top ?? 0}px`}
			style:width={`${ghost.box?.width ?? 0}px`}
			style:height={`${ghost.box?.height ?? 0}px`}
		>
			<span class="symbol" aria-hidden="true"
				>{ghost.surviving ? (resultSymbol ?? ghost.symbol) : ghost.symbol}</span
			>
		</span>
	{/each}

	{#if gain > 0}
		<span
			class="score-float"
			data-testid="score-float"
			style:left={`${scoreX}px`}
			style:top={`${scoreY}px`}
		>
			+{gain}
		</span>
	{/if}
</div>
