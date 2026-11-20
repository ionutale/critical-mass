import { ELEMENT_BY_SYMBOL, elementAt, rarityOf } from '../../data/elements';
import { UPGRADE_EFFECTS, hasUpgrade } from '../../data/upgrades';
import type { ElementSymbol } from '../../types';
import type { FusionState } from './types';

/** One fusable neighbour at a chain step, with its step-weighted score and heat. */
export interface FusionOption {
	cell: number;
	other: ElementSymbol;
	result: ElementSymbol;
	rarity: number;
	points: number;
	heat: number;
}

/** One resolved fusion in the chain started by a placement. */
export interface FusionStep {
	step: number;
	a: ElementSymbol;
	b: ElementSymbol;
	result: ElementSymbol;
	cell: number;
	options: FusionOption[];
	choice: number;
	rarity: number;
	points: number;
	heat: number;
}

/** The board, score, and heat produced by a placement, before turn resolution. */
export interface PlacementResult {
	steps: FusionStep[];
	grid: (ElementSymbol | null)[];
	scoreGain: number;
	heatGain: number;
}

/** A placement result plus the heat state the player sees in the Preview. */
export interface PlacementPreview extends PlacementResult {
	heatAfter: number;
	overload: boolean;
}

const GRID_SIZE = 5;
const CELL_COUNT = GRID_SIZE * GRID_SIZE;
const CHAIN_CAP = 24;
const MAX_VALENCE_SUM = 4;

/**
 * Neighbour offsets in the fixed order N, E, S, W, NE, SE, SW, NW.
 * `row`/`col` are relative to the origin cell.
 */
const NEIGHBOUR_OFFSETS: readonly (readonly [row: number, col: number])[] = [
	[-1, 0], // N
	[0, 1], // E
	[1, 0], // S
	[0, -1], // W
	[-1, 1], // NE
	[1, 1], // SE
	[1, -1], // SW
	[-1, -1] // NW
];

/** The 8-way neighbours of a cell, in bounds and in fixed compass order. */
function neighbours(cell: number): number[] {
	const row = Math.floor(cell / GRID_SIZE);
	const col = cell % GRID_SIZE;
	const cells: number[] = [];

	for (const [rowOffset, colOffset] of NEIGHBOUR_OFFSETS) {
		const nextRow = row + rowOffset;
		const nextCol = col + colOffset;
		if (nextRow < 0 || nextRow >= GRID_SIZE || nextCol < 0 || nextCol >= GRID_SIZE) continue;
		cells.push(nextRow * GRID_SIZE + nextCol);
	}

	return cells;
}

/**
 * Score for one step after Upgrade modifiers. Multipliers are applied in a
 * fixed order and rounded once, so Preview and commit always agree.
 */
function scoreFor(
	step: number,
	rarity: number,
	valence: number,
	upgrades: readonly string[]
): number {
	let points = step * rarity;

	if (
		hasUpgrade({ upgrades }, 'chain-reaction') &&
		step >= UPGRADE_EFFECTS['chain-reaction'].minStep
	) {
		points *= UPGRADE_EFFECTS['chain-reaction'].scoreMultiplier;
	}

	if (
		hasUpgrade({ upgrades }, 'rarity-bonus') &&
		valence === UPGRADE_EFFECTS['rarity-bonus'].valence
	) {
		points *= UPGRADE_EFFECTS['rarity-bonus'].scoreMultiplier;
	}

	return Math.round(points);
}

/**
 * Base heat for a step, after Upgrade modifiers: Heat Sink makes the first
 * fusion free, and Efficient Fusion removes 1 from every other fusion (min 1).
 */
function heatFor(
	step: number,
	valence: number,
	upgrades: readonly string[],
	freeFirstFusion: boolean
): number {
	if (freeFirstFusion && step === 1) return 0;

	// The first fusion costs only its result valence; every later step costs +1.
	const base = valence + (step > 1 ? 1 : 0);
	if (!hasUpgrade({ upgrades }, 'efficient')) return base;

	return Math.max(1, base - UPGRADE_EFFECTS.efficient.heatReduction);
}

/**
 * Build the option for fusing `active` with `other` at a 1-based chain step,
 * or null when the valence sum is too high or the result leaves the table.
 */
function fusableOption(
	active: ElementSymbol,
	cell: number,
	other: ElementSymbol,
	step: number,
	upgrades: readonly string[],
	freeFirstFusion: boolean
): FusionOption | null {
	const activeRecord = ELEMENT_BY_SYMBOL.get(active);
	const otherRecord = ELEMENT_BY_SYMBOL.get(other);
	if (!activeRecord || !otherRecord) return null;

	const valenceSum = activeRecord.valence + otherRecord.valence;
	if (valenceSum > MAX_VALENCE_SUM) return null;

	const result = elementAt(valenceSum, Math.max(activeRecord.mass, otherRecord.mass));
	if (!result) return null;

	const rarity = rarityOf(result);
	return {
		cell,
		other,
		result: result.symbol,
		rarity,
		points: scoreFor(step, rarity, result.valence, upgrades),
		heat: heatFor(step, result.valence, upgrades, freeFirstFusion)
	};
}

/**
 * Resolve a placement: put the card's element on `cell`, fuse every fusable
 * 8-way neighbour in chain order, and return the resulting board, score, and heat.
 *
 * `choices[i]` picks the option index for 0-based step `i`; an invalid or
 * out-of-range choice falls back to option 0. Returns null for an invalid cell,
 * an occupied cell, or a missing hand card.
 */
export function resolvePlacement(
	run: FusionState,
	handIndex: number,
	cell: number,
	choices: readonly number[] = []
): PlacementResult | null {
	if (!Number.isInteger(cell) || cell < 0 || cell >= CELL_COUNT) return null;
	if (run.grid[cell] != null) return null;

	const placed = run.hand[handIndex];
	if (!placed) return null;
	if (!ELEMENT_BY_SYMBOL.has(placed)) return null;

	const grid = [...run.grid];
	grid[cell] = placed;

	let active = placed;
	const steps: FusionStep[] = [];
	let scoreGain = 0;
	let heatGain = 0;
	const freeFirstFusion =
		hasUpgrade(run, 'heat-sink') &&
		UPGRADE_EFFECTS['heat-sink'].freeFirstFusion &&
		!run.heatSinkUsed;

	for (let stepIndex = 0; stepIndex < CHAIN_CAP; stepIndex++) {
		const step = stepIndex + 1;
		const options: FusionOption[] = [];

		for (const candidate of neighbours(cell)) {
			const other = grid[candidate];
			if (!other) continue;
			const option = fusableOption(active, candidate, other, step, run.upgrades, freeFirstFusion);
			if (option) options.push(option);
		}

		if (options.length === 0) break;

		const requested = choices[stepIndex] ?? 0;
		const choice = options[requested] ? requested : 0;
		const selected = options[choice];
		if (!selected) break;

		steps.push({
			step,
			a: active,
			b: selected.other,
			result: selected.result,
			cell: selected.cell,
			options,
			choice,
			rarity: selected.rarity,
			points: selected.points,
			heat: selected.heat
		});

		scoreGain += selected.points;
		heatGain += selected.heat;

		grid[selected.cell] = null;
		grid[cell] = selected.result;
		active = selected.result;
	}

	return { steps, grid, scoreGain, heatGain };
}

/**
 * Resolve a placement and add the Preview-only heat fields. The resolution is
 * identical to `resolvePlacement`, so Preview and commit cannot diverge.
 *
 * `heatAfter` is clamped to the cap exactly as a committed placement is, while
 * `overload` reports the raw result: the Preview shows the same 100 Heat the
 * run will hold after a lethal placement.
 */
export function previewPlacement(
	run: FusionState,
	handIndex: number,
	cell: number,
	choices: readonly number[] = []
): PlacementPreview | null {
	const result = resolvePlacement(run, handIndex, cell, choices);
	if (!result) return null;

	const rawHeat = run.heat + result.heatGain;
	const heatAfter = Math.min(run.heatCap, rawHeat);
	return { ...result, heatAfter, overload: rawHeat >= run.heatCap };
}
