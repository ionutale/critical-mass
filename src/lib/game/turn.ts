import type { RunState } from '../types';
import { shuffleWithState } from './rng';

const HAND_CAP = 7;

function startingDeck(): string[] {
	return [...Array<string>(8).fill('H'), 'He', 'He'];
}

export function createRun(seed: number): RunState {
	const grid: (string | null)[] = Array<string | null>(25).fill(null);
	grid[12] = 'H';

	const shuffled = shuffleWithState(startingDeck(), seed);
	const hand = shuffled.items.slice(0, 5);
	const deck = shuffled.items.slice(5);

	return {
		seed,
		rngState: shuffled.state,
		grid,
		deck,
		hand,
		discard: [],
		pressure: 0,
		pressureCap: 100,
		sectorFloor: 0,
		sector: 1,
		contractId: 's1-1a',
		delivered: 0,
		contractsCompleted: 0,
		turn: 1,
		scrapsUsed: 0,
		pendingDiscards: 0,
		modules: [],
		hasCatalyst: false,
		ventsThisContract: 0,
		maxChain: 0,
		deliveredTargets: [],
		pendingDraft: null,
		pendingTransition: false,
		status: 'active'
	};
}

function drawOne(run: RunState): RunState {
	let deck = run.deck;
	let discard = run.discard;
	let rngState = run.rngState;

	if (deck.length === 0) {
		if (discard.length === 0) return run;
		const shuffled = shuffleWithState(discard, rngState);
		deck = shuffled.items;
		discard = [];
		rngState = shuffled.state;
	}

	const [card, ...rest] = deck;
	return { ...run, deck: rest, discard, rngState, hand: [...run.hand, card] };
}

export function endTurn(run: RunState): RunState {
	const drawn = drawOne({
		...run,
		turn: run.turn + 1,
		scrapsUsed: 0
	});

	return {
		...drawn,
		pendingDiscards: Math.max(0, drawn.hand.length - HAND_CAP)
	};
}

export function discardCard(run: RunState, handIndex: number): RunState {
	if (run.pendingDiscards <= 0) return run;
	const card = run.hand[handIndex];
	if (card === undefined) return run;

	return {
		...run,
		hand: run.hand.filter((_, index) => index !== handIndex),
		discard: [...run.discard, card],
		pendingDiscards: run.pendingDiscards - 1
	};
}

export function vent(run: RunState, handIndex: number): RunState {
	if (run.pendingDiscards > 0 || run.status !== 'active') return run;
	const card = run.hand[handIndex];
	if (card === undefined) return run;

	return endTurn({
		...run,
		hand: run.hand.filter((_, index) => index !== handIndex),
		discard: [...run.discard, card],
		pressure: Math.max(run.sectorFloor, run.pressure - 15),
		ventsThisContract: run.ventsThisContract + 1
	});
}

export function scrap(run: RunState, cell: number): RunState {
	if (run.scrapsUsed >= 1 || run.status !== 'active') return run;
	if (!run.grid[cell]) return run;

	const grid = [...run.grid];
	grid[cell] = null;

	return {
		...run,
		grid,
		scrapsUsed: run.scrapsUsed + 1
	};
}
