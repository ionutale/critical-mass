import { applyStarterUnlocks } from '../../data/arcade/unlocks';
import { ELEMENTS } from '../../data/elements';
import { UPGRADE_EFFECTS, hasUpgrade } from '../../data/upgrades';
import type { UpgradeId } from '../../data/upgrades';
import type { ElementRecord, ElementSymbol } from '../../types';
import { pickIndex, shuffleWithState } from '../rng';
import { previewPlacement } from './fusion';
import { PASSIVE_HEAT } from './heat';
import type { FusionState } from './types';

/** The arcade run ends only by Overload. */
export type RunStatus = 'active' | 'overload';

/**
 * A complete deterministic arcade run. Structurally extends `FusionState`, so
 * the fusion engine can read the board, hand, and heat without knowing about
 * deck, score, or run status.
 */
export interface RunState extends FusionState {
	seed: number;
	rngState: number;
	deck: ElementSymbol[];
	discard: ElementSymbol[];
	score: number;
	bestChain: number;
	status: RunStatus;
	pendingDrafts: number;
	/** High-water count of Heat milestones already queued (0–3), so cooling cannot refund a draft. */
	milestonesCrossed: number;
	/** Owned Upgrades; card upgrades may appear more than once. */
	upgrades: UpgradeId[];
	/** Scraps spent this turn (0..`scrapLimit(run)`). */
	scrapsUsed: number;
	/** True once this turn's Heat Sink has absorbed the first Fusion. */
	heatSinkUsed: boolean;
	/** True once Echo has granted its one free Stabilize draw. */
	echoUsed: boolean;
	/** Meta unlock ids earned by the save that created this run. */
	unlocked: string[];
}

/** Starter Deck (10): H×5, Li×2, He×2, Be×1. */
export const STARTER_DECK: readonly ElementSymbol[] = [
	'H',
	'H',
	'H',
	'H',
	'H',
	'Li',
	'Li',
	'He',
	'He',
	'Be'
];

const GRID_SIZE = 5;
const CELL_COUNT = GRID_SIZE * GRID_SIZE;
const HAND_SIZE = 5;
const HEAT_CAP = 100;
const MAX_SEED_TILES = 2;
/** Heat removed by one Stabilize, before the rising floor is applied. */
const STABILIZE_COOLING = 15;
/** Heat values that each queue one Upgrade draft, in order. */
const MILESTONES: readonly number[] = [25, 50, 75];

/**
 * Seed tiles must be able to fuse, so valence-4 elements are excluded: a
 * terminal tile would remove the first turn's real choice.
 */
const PLACEABLE_ELEMENTS: readonly ElementRecord[] = ELEMENTS.filter(
	(element) => element.valence <= 3
);

interface SeedTile {
	cell: number;
	symbol: ElementSymbol;
}

/** Coerce any number (negative, fractional, NaN, Infinity) into a stable RNG state. */
function normalizeSeed(seed: number): number {
	return Number.isFinite(seed) ? seed | 0 : 0;
}

/**
 * Pick one or two deterministic seed tiles from the RNG stream: the count
 * first, then a distinct cell and a placeable element per tile.
 */
function seedTiles(state: number): { tiles: SeedTile[]; state: number } {
	let current = state;

	const countPick = pickIndex(current, MAX_SEED_TILES);
	current = countPick.state;
	const count = countPick.index + 1;

	const freeCells = Array.from({ length: CELL_COUNT }, (_, cell) => cell);
	const tiles: SeedTile[] = [];

	for (let tile = 0; tile < count; tile++) {
		const cellPick = pickIndex(current, freeCells.length);
		current = cellPick.state;
		const [cell] = freeCells.splice(cellPick.index, 1);

		const elementPick = pickIndex(current, PLACEABLE_ELEMENTS.length);
		current = elementPick.state;

		const element = PLACEABLE_ELEMENTS[elementPick.index];
		if (cell === undefined || !element) break;
		tiles.push({ cell, symbol: element.symbol });
	}

	return { tiles, state: current };
}

/**
 * Create a fresh, fully deterministic run: apply unlocked starter cards,
 * shuffle the deck, seed the reactor with one or two tiles, and deal the
 * opening hand.
 *
 * Unlocks only substitute starter cards; they never change the deck size or a
 * base stat. The opening hand uses `handSize`, so a future hand-size option is
 * honored at creation time as well as on later draws.
 */
export function createRun(seed: number, unlocked: readonly string[] = []): RunState {
	let rngState = normalizeSeed(seed);

	const starter = applyStarterUnlocks(STARTER_DECK, unlocked);
	const shuffled = shuffleWithState(starter, rngState);
	rngState = shuffled.state;

	const seeded = seedTiles(rngState);
	rngState = seeded.state;

	const grid = Array<ElementSymbol | null>(CELL_COUNT).fill(null);
	for (const tile of seeded.tiles) {
		grid[tile.cell] = tile.symbol;
	}

	const base: RunState = {
		seed,
		rngState,
		turn: 1,
		grid,
		deck: [],
		hand: [],
		discard: [],
		heat: 0,
		heatCap: HEAT_CAP,
		score: 0,
		bestChain: 0,
		status: 'active',
		pendingDrafts: 0,
		milestonesCrossed: 0,
		upgrades: [],
		scrapsUsed: 0,
		heatSinkUsed: false,
		echoUsed: false,
		unlocked: [...unlocked]
	};

	const deck = [...shuffled.items];
	const hand = deck.splice(0, handSize(base));

	return { ...base, deck, hand };
}

/** Heat can never be cooled below the passive Heat already accumulated. */
export function heatFloor(run: RunState): number {
	return PASSIVE_HEAT * run.turn;
}

/** Cards held between turns; Deep Hand raises the base hand size by 1. */
export function handSize(run: RunState): number {
	return (
		HAND_SIZE + (hasUpgrade(run, 'deep-hand') ? UPGRADE_EFFECTS['deep-hand'].handSizeBonus : 0)
	);
}

/** Scraps available this turn; Salvage raises the once-per-turn limit to 2. */
export function scrapLimit(run: RunState): number {
	return hasUpgrade(run, 'salvage') ? UPGRADE_EFFECTS.salvage.scrapsPerTurn : 1;
}

/**
 * Add Heat, clamping to the cap (and never below zero). Reaching the cap is
 * reported by the action's Overload check, not by this helper.
 */
export function applyHeat(run: RunState, amount: number): RunState {
	const delta = Number.isFinite(amount) ? amount : 0;
	const heat = Math.min(run.heatCap, Math.max(0, run.heat + delta));
	if (heat === run.heat) return run;
	return { ...run, heat };
}

/**
 * Queue one draft for every 25/50/75 milestone crossed since the last check.
 * Milestone progress is a high-water mark: cooling down and rising again never
 * queues a second draft for the same threshold.
 */
export function queueMilestones(run: RunState): RunState {
	const reached = MILESTONES.filter((milestone) => run.heat >= milestone).length;
	if (reached <= run.milestonesCrossed) return run;

	const queued = reached - run.milestonesCrossed;
	return {
		...run,
		pendingDrafts: run.pendingDrafts + queued,
		milestonesCrossed: reached
	};
}

/** Draw one card, reshuffling the discard pile into the deck when it empties. */
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
	if (card === undefined) return run;

	return {
		...run,
		deck: rest,
		discard,
		rngState,
		hand: [...run.hand, card]
	};
}

/** Draw up to the hand size, reshuffling the discard when the deck runs out. */
export function drawToHandSize(run: RunState): RunState {
	let next = run;

	while (next.hand.length < handSize(next)) {
		const drawn = drawOne(next);
		if (drawn === next) break;
		next = drawn;
	}

	return next;
}

/**
 * Close a turn: advance the turn counter, add the passive +3 Heat, draw back to
 * hand size, and refresh the once-per-turn Scrap and Heat Sink. Overload is
 * checked by the action that ends the turn (a Placement or Stabilize).
 */
export function endTurn(run: RunState): RunState {
	const advanced: RunState = {
		...run,
		turn: run.turn + 1,
		scrapsUsed: 0,
		heatSinkUsed: false
	};
	return drawToHandSize(applyHeat(advanced, PASSIVE_HEAT));
}

/** Move a card out of the hand and into the discard pile. */
function discardFromHand(run: RunState, handIndex: number): Pick<RunState, 'hand' | 'discard'> {
	const card = run.hand[handIndex];
	if (card === undefined) return { hand: run.hand, discard: run.discard };

	return {
		hand: run.hand.filter((_, index) => index !== handIndex),
		discard: [...run.discard, card]
	};
}

/**
 * Commit a placement: resolve the chain, award its score and Heat, then run the
 * end-of-turn bookkeeping in spec order.
 *
 * Heat is checked for Overload immediately after the chain (a lethal placement
 * scores and ends the run without a draw), and again after the passive +3. The
 * committed Heat is the Preview's clamped `heatAfterTurn`, so the two cannot
 * diverge.
 */
export function placeCard(
	run: RunState,
	handIndex: number,
	cell: number,
	choices: readonly number[] = []
): RunState {
	if (run.status !== 'active' || run.pendingDrafts > 0) return run;

	const preview = previewPlacement(run, handIndex, cell, choices);
	if (!preview) return run;

	const heatSinkUsed =
		run.heatSinkUsed || (hasUpgrade(run, 'heat-sink') && preview.steps.length > 0);

	const committed: RunState = {
		...run,
		...discardFromHand(run, handIndex),
		grid: preview.grid,
		score: run.score + preview.scoreGain,
		bestChain: Math.max(run.bestChain, preview.steps.length),
		heat: preview.heatAfter,
		heatSinkUsed
	};

	if (preview.overload) return { ...committed, status: 'overload' };

	const afterTurn = endTurn(committed);
	const resolved =
		afterTurn.heat >= afterTurn.heatCap ? { ...afterTurn, status: 'overload' as const } : afterTurn;

	return resolved.status === 'active' ? queueMilestones(resolved) : resolved;
}

/**
 * Close a Stabilize turn: advance the turn, refresh Scrap and Heat Sink, add the
 * passive +3, and resolve Overload. Echo makes the first Stabilize of the run
 * draw back to hand size like a Place turn; every later Stabilize draws nothing.
 */
function finishStabilize(run: RunState): RunState {
	const echoDraw =
		hasUpgrade(run, 'echo') && UPGRADE_EFFECTS.echo.firstStabilizeDraws && !run.echoUsed;
	const advanced: RunState = {
		...run,
		turn: run.turn + 1,
		scrapsUsed: 0,
		heatSinkUsed: false,
		echoUsed: run.echoUsed || echoDraw
	};
	const heated = applyHeat(advanced, PASSIVE_HEAT);
	const drawn = echoDraw ? drawToHandSize(heated) : heated;
	const resolved = drawn.heat >= drawn.heatCap ? { ...drawn, status: 'overload' as const } : drawn;

	return resolved.status === 'active' ? queueMilestones(resolved) : resolved;
}

/**
 * Stabilize: discard one card, cool up to 15 Heat (30 with Coolant) but never
 * below the rising floor, apply the passive +3, and end the turn without
 * drawing. The discarded card is the cost, so an invalid hand index is a no-op
 * rather than free cooling. With an empty hand there is nothing to discard, so
 * Stabilize becomes a pure pass: no cooling, only the passive +3 and the turn
 * advance (the rising floor still guarantees the run overloads).
 *
 * The whole action is blocked while an Upgrade draft is pending.
 */
export function stabilize(run: RunState, handIndex: number): RunState {
	if (run.status !== 'active' || run.pendingDrafts > 0) return run;

	if (run.hand.length === 0) return finishStabilize(run);

	const card = run.hand[handIndex];
	if (card === undefined) return run;

	const cooling =
		STABILIZE_COOLING + (hasUpgrade(run, 'coolant') ? UPGRADE_EFFECTS.coolant.coolingBonus : 0);
	const cooled = Math.min(run.heatCap, Math.max(heatFloor(run), run.heat - cooling));
	const withCard: RunState = {
		...run,
		...discardFromHand(run, handIndex),
		heat: cooled
	};

	return finishStabilize(withCard);
}

/**
 * Remove one tile for free. Scrap is limited per turn (once, or twice with
 * Salvage) and does not end the turn, so it can always clear a soft-locked
 * board without spending a card.
 */
export function scrap(run: RunState, cell: number): RunState {
	if (run.status !== 'active' || run.pendingDrafts > 0) return run;
	if (run.scrapsUsed >= scrapLimit(run)) return run;
	if (!Number.isInteger(cell) || cell < 0 || cell >= CELL_COUNT) return run;
	if (run.grid[cell] == null) return run;

	const grid = [...run.grid];
	grid[cell] = null;

	return { ...run, grid, scrapsUsed: run.scrapsUsed + 1 };
}
