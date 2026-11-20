import { ELEMENTS } from '../../data/elements';
import type { ElementRecord, ElementSymbol } from '../../types';
import { pickIndex, shuffleWithState } from '../rng';
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
	scrapUsed: boolean;
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
 * Create a fresh, fully deterministic run: shuffle the starter deck, seed the
 * reactor with one or two tiles, and deal the opening hand.
 *
 * `unlocked` is the meta-progression hook for alternate starters; it is
 * accepted now so callers have a stable signature and has no effect until the
 * unlock pool lands (Task 6).
 */
export function createRun(seed: number, unlocked: readonly string[] = []): RunState {
	void unlocked;

	let rngState = normalizeSeed(seed);

	const shuffled = shuffleWithState(STARTER_DECK, rngState);
	rngState = shuffled.state;

	const seeded = seedTiles(rngState);
	rngState = seeded.state;

	const grid = Array<ElementSymbol | null>(CELL_COUNT).fill(null);
	for (const tile of seeded.tiles) {
		grid[tile.cell] = tile.symbol;
	}

	const deck = [...shuffled.items];
	const hand = deck.splice(0, HAND_SIZE);

	return {
		seed,
		rngState,
		turn: 1,
		grid,
		deck,
		hand,
		discard: [],
		heat: 0,
		heatCap: HEAT_CAP,
		score: 0,
		bestChain: 0,
		status: 'active',
		pendingDrafts: 0,
		upgrades: [],
		scrapUsed: false
	};
}
