import { ELEMENT_BY_SYMBOL } from '../../data/elements';
import type { ElementSymbol } from '../../types';
import { chooseUpgrade, generateDraft } from './draft';
import { previewPlacement } from './fusion';
import type { PlacementPreview } from './fusion';
import { createRun, heatFloor, placeCard, scrap, scrapLimit, stabilize } from './turn';
import type { RunState, RunStatus } from './turn';

/**
 * Deterministic balance harness for the arcade loop.
 *
 * Four reference policies play the same engine the UI plays:
 * - `casualPlay` is a one-step greedy player: every placement is judged only by
 *   its own Preview (default branch), and Stabilize happens once Heat is high.
 * - `plannerPlay` searches placement branches, weighs Heat against score and
 *   board space, manages upgrades, and cools before a play would leave it hot.
 * - `cardPlay` uses the planner's movement but drafts card stock, giving the
 *   harness a second, card-focused build archetype to measure.
 * - `stabilizeOnlyPlay` is the floor control: it never places.
 *
 * The policies are pure and bounded: they only read a `RunState` and return the
 * next committed action, so the same seed always produces the same run.
 */

/** One reference run. `turns` is the turn the run ended on. */
export interface Result {
	seed: number;
	status: RunStatus;
	score: number;
	turns: number;
	bestChain: number;
	upgrades: string[];
	/** Mean non-dominated placements available on each measured turn. */
	viablePlays: number;
	/** Build shape from the drafted upgrades: card stock, modifiers, or both. */
	archetype: Archetype;
	stalled: boolean;
}

/** A run's build shape, read from its drafted upgrades. */
export type Archetype = 'card' | 'modifier' | 'mixed' | 'none';

/** The reference policies a band check reads. */
export interface BalanceResults {
	casual: Result[];
	planner: Result[];
	/** The same planner movement, but it drafts card stock over modifiers. */
	card: Result[];
	stabilizeOnly: Result[];
}

/** Inclusive turn targets plus the cross-policy acceptance rules. */
export interface BalanceBands {
	/** The design's target band; the planner's median must land inside. */
	targetMinTurns: number;
	targetMaxTurns: number;
	/** Hard acceptable band: no planner run may leave it. */
	minTurns: number;
	maxTurns: number;
	/** No run may hit the action cap or fail to overload. */
	maxStalls: number;
	/** Distinct upgrade sets the planner must reach across seeds. */
	minUpgradePaths: number;
	/** How far planner median score must exceed casual median score. */
	minScoreRatio: number;
	/** Median (per-run average) of non-dominated placements on measured turns. */
	minViablePlays: number;
	/** Distinct build archetypes the planner and card policies must reach. */
	minArchetypes: number;
	/** Stabilize-only must overload by this turn from the rising floor alone. */
	maxStabilizeTurns: number;
}

export const DEFAULT_BANDS: BalanceBands = {
	targetMinTurns: 20,
	targetMaxTurns: 30,
	minTurns: 15,
	maxTurns: 40,
	maxStalls: 0,
	minUpgradePaths: 2,
	minScoreRatio: 1.25,
	minViablePlays: 2,
	minArchetypes: 2,
	maxStabilizeTurns: 40
};

/** A hard stop for a policy bug, not a game rule. Every real run ends sooner. */
const ACTION_CAP = 400;

/** Casuals only cool once Heat is nearly lethal, and never see the floor. */
const CASUAL_STABILIZE_AT = 0.82;

/** Planner branch search: bounded depth, breadth, and preview calls per cell. */
const PLANNER_MAX_DEPTH = 3;
const PLANNER_MAX_NODES = 24;

/** Planner temperament. */
const PLANNER_COMFORT = 0.78;
const PLANNER_HEAT_COST = 140;
const PLANNER_SPACE_VALUE = 1.5;
const PLANNER_TERMINAL_COST = 1.5;
const PLANNER_CHAIN_VALUE = 1.5;
/** Weight on how many low-valence neighbours future empty cells still offer. */
const PLANNER_SETUP_VALUE = 2.5;

const GRID_SIZE = 5;

const NEIGHBOURS: readonly (readonly [number, number])[] = [
	[-1, 0],
	[0, 1],
	[1, 0],
	[0, -1],
	[-1, 1],
	[1, 1],
	[1, -1],
	[-1, -1]
];
/** Cool before a placement that would leave Heat above this fraction of the cap. */
const PLANNER_HOT_CEILING = 0.9;
/** Scrap a terminal tile once the board has this few empty cells. */
const PLANNER_CROWDED_CELLS = 5;

/** Preferred modifiers, highest first. Card stock is a fallback. */
const UPGRADE_PRIORITY: Readonly<Record<string, number>> = {
	'chain-reaction': 10,
	'rarity-bonus': 9,
	efficient: 8,
	'heat-sink': 8,
	'deep-hand': 8,
	coolant: 7,
	salvage: 6,
	echo: 5,
	'add-h-2': 3,
	'add-he-2': 3,
	'add-li': 2,
	'add-c': 2,
	'add-be': 2,
	'add-na': 2,
	'add-o': 2,
	'add-n': 2,
	'add-si': 2,
	'add-mg': 2
};

interface PlacementCandidate {
	hand: number;
	cell: number;
	choices: number[];
	preview: PlacementPreview;
}

function isEmpty(grid: readonly (ElementSymbol | null)[]): number {
	return grid.reduce((count, tile) => (tile == null ? count + 1 : count), 0);
}

function valenceCount(grid: readonly (ElementSymbol | null)[], valence: number): number {
	return grid.reduce((count, tile) => {
		if (tile == null) return count;
		return ELEMENT_BY_SYMBOL.get(tile)?.valence === valence ? count + 1 : count;
	}, 0);
}

function valenceOf(symbol: ElementSymbol): number {
	return ELEMENT_BY_SYMBOL.get(symbol)?.valence ?? 0;
}

/**
 * How much future chain fuel an empty cell still has: neighbouring low-valence
 * tiles are what a cheap card can fuse through, so keeping several around an
 * empty cell is what makes next turn's chain possible.
 */
function setupPotential(grid: readonly (ElementSymbol | null)[]): number {
	let value = 0;

	for (let cell = 0; cell < grid.length; cell++) {
		if (grid[cell] != null) continue;

		const row = Math.floor(cell / GRID_SIZE);
		const col = cell % GRID_SIZE;
		let fuel = 0;

		for (const [rowOffset, colOffset] of NEIGHBOURS) {
			const nextRow = row + rowOffset;
			const nextCol = col + colOffset;
			if (nextRow < 0 || nextRow >= GRID_SIZE || nextCol < 0 || nextCol >= GRID_SIZE) continue;

			const tile = grid[nextRow * GRID_SIZE + nextCol];
			if (tile == null) continue;

			const valence = valenceOf(tile);
			if (valence === 1) fuel += 1;
			else if (valence === 2) fuel += 0.6;
			else if (valence === 3) fuel += 0.25;
		}

		value += Math.min(3, fuel);
	}

	return value;
}

function isLethal(preview: PlacementPreview): boolean {
	return preview.overload || preview.overloadAfterTurn;
}

/**
 * Every Preview reachable from a placement within the branch budget. Option
 * choices are explored depth-first; the budget bounds a single placement's
 * search while still always exploring at least its root branch.
 */
function explorePlacement(
	run: RunState,
	hand: number,
	cell: number
): { choices: number[]; preview: PlacementPreview }[] {
	const leaves: { choices: number[]; preview: PlacementPreview }[] = [];
	let nodes = 0;

	const walk = (choices: number[]): void => {
		if (nodes >= PLANNER_MAX_NODES) return;

		const preview = previewPlacement(run, hand, cell, choices);
		if (!preview) return;
		nodes++;

		const nextOptions = preview.steps[choices.length]?.options ?? [];
		if (
			choices.length >= PLANNER_MAX_DEPTH ||
			preview.steps.length <= choices.length ||
			nextOptions.length <= 1
		) {
			leaves.push({ choices, preview });
			return;
		}

		for (let option = 0; option < nextOptions.length; option++) {
			if (nodes >= PLANNER_MAX_NODES) break;
			walk([...choices, option]);
		}
	};

	walk([]);
	return leaves;
}

/**
 * All legal placements. `deep` explores chain branches for the planner; the
 * casual policy sees only the default branch. Identical hand symbols are merged
 * because the engine treats them identically.
 */
function collectPlacements(run: RunState, deep: boolean): PlacementCandidate[] {
	const empties: number[] = [];
	for (let cell = 0; cell < run.grid.length; cell++) {
		if (run.grid[cell] == null) empties.push(cell);
	}

	const candidates: PlacementCandidate[] = [];
	const seen = new Set<ElementSymbol>();

	for (let hand = 0; hand < run.hand.length; hand++) {
		const symbol = run.hand[hand];
		if (!symbol || seen.has(symbol)) continue;
		seen.add(symbol);

		for (const cell of empties) {
			if (!deep) {
				const preview = previewPlacement(run, hand, cell);
				if (preview) candidates.push({ hand, cell, choices: [], preview });
				continue;
			}

			for (const leaf of explorePlacement(run, hand, cell)) {
				candidates.push({ hand, cell, choices: leaf.choices, preview: leaf.preview });
			}
		}
	}

	return candidates;
}

/**
 * Strict Pareto dominance over a placement's visible outcome: A dominates B
 * when it scores at least as much and leaves at least as little Heat, and is
 * better on one of them. A dominated placement is never a real alternative.
 */
function dominates(a: PlacementCandidate, b: PlacementCandidate): boolean {
	const score = a.preview.scoreGain >= b.preview.scoreGain;
	const heat = a.preview.heatAfterTurn <= b.preview.heatAfterTurn;
	const strict =
		a.preview.scoreGain > b.preview.scoreGain || a.preview.heatAfterTurn < b.preview.heatAfterTurn;
	return score && heat && strict;
}

/**
 * How many genuinely different plays a turn offers: distinct score/Heat
 * outcomes that no other outcome beats on both. Counting outcomes rather than
 * raw cells keeps a mostly empty board from inflating the number with
 * interchangeable no-fusion drops.
 */
export function countViablePlays(run: RunState, deep = true): number {
	const candidates = collectPlacements(run, deep);
	const outcomes = new Map<string, PlacementCandidate>();

	for (const candidate of candidates) {
		const key = `${candidate.preview.scoreGain}:${candidate.preview.heatAfterTurn}`;
		if (!outcomes.has(key)) outcomes.set(key, candidate);
	}

	const distinct = [...outcomes.values()];
	return distinct.filter(
		(candidate) => !distinct.some((other) => other !== candidate && dominates(other, candidate))
	).length;
}

/** The build shape a run's drafted upgrades add up to. */
export function archetypeOf(upgrades: readonly string[]): Archetype {
	const cards = upgrades.filter((id) => id.startsWith('add-')).length;
	const modifiers = upgrades.length - cards;

	if (cards === 0 && modifiers === 0) return 'none';
	if (cards > modifiers) return 'card';
	if (modifiers > cards) return 'modifier';
	return 'mixed';
}

/** Planner value: score and space, discounted by the Heat the play leaves behind. */
function plannerValue(run: RunState, preview: PlacementPreview): number {
	const pressure = Math.max(0, preview.heatAfterTurn / run.heatCap - PLANNER_COMFORT);

	return (
		preview.scoreGain +
		preview.steps.length * PLANNER_CHAIN_VALUE +
		isEmpty(preview.grid) * PLANNER_SPACE_VALUE +
		setupPotential(preview.grid) * PLANNER_SETUP_VALUE -
		valenceCount(preview.grid, 4) * PLANNER_TERMINAL_COST -
		pressure * pressure * PLANNER_HEAT_COST
	);
}

function bestBy<T>(items: readonly T[], value: (item: T) => number): T | undefined {
	let best: T | undefined;
	let bestValue = Number.NEGATIVE_INFINITY;

	for (const item of items) {
		const score = value(item);
		if (score > bestValue) {
			best = item;
			bestValue = score;
		}
	}

	return best;
}

/** Card-first priorities for the card archetype: bodies over rules. */
const CARD_UPGRADE_PRIORITY: Readonly<Record<string, number>> = {
	'add-c': 10,
	'add-na': 9,
	'add-o': 9,
	'add-h-2': 8,
	'add-he-2': 7,
	'add-si': 7,
	'add-n': 6,
	'add-mg': 6,
	'add-li': 6,
	'add-be': 6,
	coolant: 5,
	efficient: 4,
	'heat-sink': 4,
	salvage: 3,
	'deep-hand': 3,
	'chain-reaction': 2,
	'rarity-bonus': 2,
	echo: 1
};

/** Draft the highest-priority option, breaking ties by pool order. */
function chooseByPriority(
	run: RunState,
	priority: Readonly<Record<string, number>>,
	bonus: (id: string) => number = () => 0
): RunState {
	const options = generateDraft(run);

	let bestIndex = 0;
	let bestValue = Number.NEGATIVE_INFINITY;
	for (let index = 0; index < options.length; index++) {
		const id = options[index];
		if (!id) continue;
		const score = ((priority[id] ?? 1) + bonus(id)) * 100 - index;
		if (score > bestValue) {
			bestIndex = index;
			bestValue = score;
		}
	}

	return chooseUpgrade(run, bestIndex);
}

/** A card-focused drafter: same movement, but it builds a wider deck. */
function chooseCardUpgrade(run: RunState): RunState {
	return chooseByPriority(run, CARD_UPGRADE_PRIORITY);
}

/** Choose the upgrade that most improves the planner's current bind. */
function choosePlannerUpgrade(run: RunState): RunState {
	const heatPressure = run.heat / run.heatCap;
	const crowded = isEmpty(run.grid) <= PLANNER_CROWDED_CELLS;

	return chooseByPriority(run, UPGRADE_PRIORITY, (id) => {
		let bonus = 0;
		if (heatPressure >= 0.6 && (id === 'coolant' || id === 'efficient' || id === 'heat-sink')) {
			bonus += 3;
		}
		if (crowded && id === 'salvage') bonus += 3;
		if (run.turn >= 24 && (id === 'chain-reaction' || id === 'rarity-bonus')) bonus += 3;
		return bonus;
	});
}

/** Scrap a terminal tile when the board is crowded; otherwise the worst tile. */
function scrapChoice(run: RunState): number {
	let bestCell = -1;
	let bestValue = Number.POSITIVE_INFINITY;

	for (let cell = 0; cell < run.grid.length; cell++) {
		const tile = run.grid[cell];
		if (tile == null) continue;

		const valence = valenceOf(tile);
		let value = valence * 2;
		if (valence === 4) value -= 20;

		if (value < bestValue) {
			bestValue = value;
			bestCell = cell;
		}
	}

	return bestCell;
}

function crowdedTerminal(run: RunState): boolean {
	return isEmpty(run.grid) <= PLANNER_CROWDED_CELLS && valenceCount(run.grid, 4) > 0;
}

/** A legal action when no placement fits: unblock with Scrap, else Stabilize. */
function fallbackStep(run: RunState): RunState {
	if (run.scrapsUsed < scrapLimit(run)) {
		const cell = scrapChoice(run);
		if (cell >= 0) return scrap(run, cell);
	}

	// An empty hand turns Stabilize into a pure pass; the rising floor still ends the run.
	return stabilize(run, 0);
}

/** Discard the card whose best placement is weakest. */
function discardIndex(candidates: readonly PlacementCandidate[], handSize: number): number {
	const bestByHand = new Map<number, number>();

	for (const candidate of candidates) {
		const current = bestByHand.get(candidate.hand) ?? Number.NEGATIVE_INFINITY;
		bestByHand.set(candidate.hand, Math.max(current, handPotential(candidate)));
	}

	let worstHand = 0;
	let worstValue = Number.POSITIVE_INFINITY;
	for (let hand = 0; hand < handSize; hand++) {
		const value = bestByHand.get(hand) ?? Number.NEGATIVE_INFINITY;
		if (value < worstValue) {
			worstValue = value;
			worstHand = hand;
		}
	}

	return worstHand;
}

/** Rough card value used only to rank which hand card to discard. */
function handPotential(candidate: PlacementCandidate): number {
	return candidate.preview.scoreGain - candidate.preview.heatGain;
}

function casualStep(run: RunState): RunState {
	if (run.pendingDrafts > 0) return chooseUpgrade(run, 0);

	if (crowdedTerminal(run) && run.scrapsUsed < scrapLimit(run)) {
		const cell = scrapChoice(run);
		if (cell >= 0) return scrap(run, cell);
	}

	const candidates = collectPlacements(run, false);
	if (candidates.length === 0) return fallbackStep(run);

	const nonLethal = candidates.filter((candidate) => !isLethal(candidate.preview));
	const pool = nonLethal.length > 0 ? nonLethal : candidates;
	const best = bestBy(
		pool,
		(candidate) => candidate.preview.scoreGain * 100 - candidate.preview.heatAfterTurn
	);
	if (!best) return fallbackStep(run);

	const coolable = run.hand.length > 0 && run.heat > heatFloor(run);
	if (coolable && run.heat >= run.heatCap * CASUAL_STABILIZE_AT) return stabilize(run, 0);

	return placeCard(run, best.hand, best.cell, best.choices);
}

function plannerStep(run: RunState): RunState {
	return plannerStepWith(run, choosePlannerUpgrade);
}

function cardStep(run: RunState): RunState {
	return plannerStepWith(run, chooseCardUpgrade);
}

function plannerStepWith(run: RunState, draft: (run: RunState) => RunState): RunState {
	if (run.pendingDrafts > 0) return draft(run);

	// Space is a resource: clear a clogging terminal before it costs a placement.
	if (run.scrapsUsed < scrapLimit(run) && crowdedTerminal(run)) {
		const cell = scrapChoice(run);
		if (cell >= 0) return scrap(run, cell);
	}

	const candidates = collectPlacements(run, true);
	if (candidates.length === 0) return fallbackStep(run);

	const nonLethal = candidates.filter((candidate) => !isLethal(candidate.preview));

	const best = bestBy(nonLethal.length > 0 ? nonLethal : candidates, (candidate) =>
		plannerValue(run, candidate.preview)
	);
	if (!best) return fallbackStep(run);

	const coolable = run.hand.length > 0 && run.heat > heatFloor(run);
	const forced = nonLethal.length === 0;
	const projectedHot = best.preview.heatAfterTurn >= run.heatCap * PLANNER_HOT_CEILING;

	if (coolable && (forced || projectedHot)) {
		return stabilize(run, discardIndex(candidates, run.hand.length));
	}

	return placeCard(run, best.hand, best.cell, best.choices);
}

function stabilizeOnlyStep(run: RunState): RunState {
	// Even a no-placement control must clear milestones; otherwise the run
	// soft-locks on a pending draft and reports a false stall.
	if (run.pendingDrafts > 0) return chooseUpgrade(run, 0);
	return stabilize(run, 0);
}

function play(
	seed: number,
	unlocked: readonly string[],
	step: (run: RunState) => RunState
): Result {
	let run = createRun(seed, unlocked);
	let actions = 0;
	let stalled = false;
	let viableTotal = 0;
	let viableTurns = 0;
	let measuredTurn = -1;

	while (run.status === 'active') {
		if (actions >= ACTION_CAP) {
			stalled = true;
			break;
		}

		// Measure once per state that can place, before the policy acts. The
		// default branch keeps the count about distinct card/cell plays rather
		// than every branch permutation the planner may explore.
		if (run.pendingDrafts === 0 && run.hand.length > 0 && run.turn !== measuredTurn) {
			const viable = countViablePlays(run, false);
			if (viable > 0) {
				viableTotal += viable;
				viableTurns += 1;
				measuredTurn = run.turn;
			}
		}

		const next = step(run);
		if (next === run) {
			// No policy branch should be a no-op; treat it as a stall, not a hang.
			stalled = true;
			break;
		}

		run = next;
		actions++;
	}

	return {
		seed,
		status: run.status,
		score: run.score,
		turns: run.turn,
		bestChain: run.bestChain,
		upgrades: [...run.upgrades],
		viablePlays: viableTurns > 0 ? viableTotal / viableTurns : 0,
		archetype: archetypeOf(run.upgrades),
		stalled
	};
}

/** A one-step greedy reference: default branch only, cool once nearly lethal. */
export function casualPlay(seed: number, unlocked: readonly string[] = []): Result {
	return play(seed, unlocked, casualStep);
}

/** A branch-searching, Heat-aware, space-aware reference. */
export function plannerPlay(seed: number, unlocked: readonly string[] = []): Result {
	return play(seed, unlocked, plannerStep);
}

/** The planner's movement with a card-focused draft: a second viable build. */
export function cardPlay(seed: number, unlocked: readonly string[] = []): Result {
	return play(seed, unlocked, cardStep);
}

/** The floor-only control: always Stabilize, never place. */
export function stabilizeOnlyPlay(seed: number, unlocked: readonly string[] = []): Result {
	return play(seed, unlocked, stabilizeOnlyStep);
}

function sorted(values: readonly number[]): number[] {
	return [...values].sort((a, b) => a - b);
}

function median(values: readonly number[]): number {
	const order = sorted(values);
	if (order.length === 0) return 0;

	const middle = Math.floor(order.length / 2);
	if (order.length % 2 === 1) return order[middle] ?? 0;

	return ((order[middle - 1] ?? 0) + (order[middle] ?? 0)) / 2;
}

function pathKey(result: Result): string {
	const ids = [...new Set(result.upgrades)].sort();
	return ids.length > 0 ? ids.join('+') : '(none)';
}

/** Distinct upgrade sets a policy reached across its seeds. */
export function upgradePaths(results: readonly Result[]): number {
	return new Set(results.map(pathKey)).size;
}

function range(values: readonly number[]): string {
	if (values.length === 0) return '—';
	const order = sorted(values);
	return `${order[0]}/${median(order)}/${order[order.length - 1]}`;
}

function statusCounts(results: readonly Result[]): string {
	const overloaded = results.filter((result) => result.status === 'overload').length;
	return `${overloaded}/${results.length}`;
}

function mean(values: readonly number[]): number {
	if (values.length === 0) return 0;
	return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Archetypes reached by a set of runs, in stable reading order. */
function archetypes(results: readonly Result[]): Archetype[] {
	const order: Archetype[] = ['card', 'modifier', 'mixed'];
	const present = new Set(results.map((result) => result.archetype));
	return order.filter((kind) => present.has(kind));
}

/**
 * A compact distribution report: turns, score, best chain, stalls, upgrade
 * paths, viable plays, and the build archetypes each policy reached.
 */
export function report(results: BalanceResults, bands: BalanceBands = DEFAULT_BANDS): string {
	const policies: readonly (readonly [string, Result[]])[] = [
		['planner', results.planner],
		['card', results.card],
		['casual', results.casual],
		['stabilize-only', results.stabilizeOnly]
	];

	const lines = [
		`Balance report — ${results.planner.length} seeds`,
		'policy          turns(min/med/max)  score(min/med/max)  chain(max)  stalls  sets  viable  build            overloads',
		''
	];

	for (const [label, list] of policies) {
		const turns = range(list.map((result) => result.turns));
		const scores = range(list.map((result) => result.score));
		const chain = Math.max(0, ...list.map((result) => result.bestChain));
		const stalls = list.filter((result) => result.stalled).length;
		const upgrades = upgradePaths(list);
		const viable = mean(list.map((result) => result.viablePlays)).toFixed(1);
		const builds = archetypes(list).join('+') || '—';

		lines.push(
			`${label.padEnd(15)} ${turns.padEnd(20)} ${scores.padEnd(19)} ${String(chain).padEnd(11)} ` +
				`${String(stalls).padEnd(7)} ${String(upgrades).padEnd(6)} ${viable.padEnd(7)} ${builds.padEnd(16)} ${statusCounts(list)}`
		);
	}

	const check = checkBands(results, bands);
	const naturalCap = Math.max(0, ...results.stabilizeOnly.map((result) => result.turns));
	const plannerViable = mean(results.planner.map((result) => result.viablePlays));
	const reached = archetypes([...results.planner, ...results.card]);
	lines.push('');
	lines.push(`natural cap (stabilize-only max turns): ${naturalCap}`);
	lines.push(`upgrade paths across planner seeds: ${upgradePaths(results.planner)}`);
	lines.push(`viable plays per measured turn (planner mean): ${plannerViable.toFixed(2)}`);
	lines.push(`build archetypes (planner + card): ${reached.join(', ') || '—'}`);
	lines.push(check.ok ? 'Bands: PASS' : `Bands: FAIL — ${check.failures.join('; ')}`);

	return lines.join('\n');
}

/** The result of a band check: `ok` plus human-readable failure reasons. */
export interface BandCheck {
	ok: boolean;
	failures: string[];
}

/**
 * Accept or reject a whole balance suite. Every rule the design promises is a
 * band here: planner termination, the turn window, upgrade variety, a real
 * skill gap over casual play, and the stabilize-only floor control.
 */
export function checkBands(
	results: BalanceResults,
	bands: BalanceBands = DEFAULT_BANDS
): BandCheck {
	const failures: string[] = [];

	if (results.planner.length === 0) {
		failures.push('planner produced no runs');
	} else {
		const stalls = results.planner.filter((result) => result.stalled).length;
		if (stalls > bands.maxStalls) {
			failures.push(`planner stalls: ${stalls} run(s) hit the action cap`);
		}

		const unfinished = results.planner.filter((result) => result.status !== 'overload').length;
		if (unfinished > 0) {
			failures.push(`planner did not overload in ${unfinished} run(s)`);
		}

		const turns = results.planner.map((result) => result.turns);
		const medianTurns = median(turns);
		if (medianTurns < bands.targetMinTurns || medianTurns > bands.targetMaxTurns) {
			failures.push(
				`planner turns median ${medianTurns} outside target ${bands.targetMinTurns}-${bands.targetMaxTurns}`
			);
		}

		for (const result of results.planner) {
			if (result.turns < bands.minTurns || result.turns > bands.maxTurns) {
				failures.push(
					`planner seed ${result.seed} turns ${result.turns} outside acceptable ${bands.minTurns}-${bands.maxTurns}`
				);
			}
		}

		const paths = upgradePaths(results.planner);
		// One seed cannot reach two distinct paths; the band needs at least as
		// many seeds as it requires paths, so a small `--seeds=1` smoke run is
		// not failed by an impossible rule.
		if (results.planner.length >= bands.minUpgradePaths && paths < bands.minUpgradePaths) {
			failures.push(
				`upgrade paths ${paths} below minimum ${bands.minUpgradePaths} across planner seeds`
			);
		}

		const viable = median(results.planner.map((result) => result.viablePlays));
		if (viable < bands.minViablePlays) {
			failures.push(
				`viable plays median ${viable.toFixed(2)} below minimum ${bands.minViablePlays} per turn`
			);
		}
	}

	if (results.card.length === 0) {
		failures.push('card produced no runs');
	} else {
		const cardStalls = results.card.filter((result) => result.stalled).length;
		if (cardStalls > bands.maxStalls) {
			failures.push(`card stalls: ${cardStalls} run(s) hit the action cap`);
		}

		const unfinished = results.card.filter((result) => result.status !== 'overload').length;
		if (unfinished > 0) {
			failures.push(`card did not overload in ${unfinished} run(s)`);
		}
	}

	const reached = archetypes([...results.planner, ...results.card]);
	const measured = results.planner.length + results.card.length;
	if (measured >= bands.minArchetypes && reached.length < bands.minArchetypes) {
		failures.push(
			`build archetypes ${reached.join(', ') || '—'} below minimum ${bands.minArchetypes}`
		);
	}

	if (results.casual.length === 0) {
		failures.push('casual produced no runs');
	} else {
		const casualStalls = results.casual.filter((result) => result.stalled).length;
		if (casualStalls > bands.maxStalls) {
			failures.push(`casual stalls: ${casualStalls} run(s) hit the action cap`);
		}

		const casualScore = median(results.casual.map((result) => result.score));
		if (casualScore <= 0) {
			// A zero baseline would make any planner score pass; that is a broken
			// harness, not a skill gap.
			failures.push('casual median score is 0; score spread cannot be measured');
		} else if (results.planner.length > 0) {
			const plannerScore = median(results.planner.map((result) => result.score));
			if (plannerScore <= casualScore * bands.minScoreRatio) {
				failures.push(
					`score spread too small: planner median ${plannerScore} vs casual median ${casualScore} ` +
						`(need > ${bands.minScoreRatio}×)`
				);
			}
		}
	}

	if (results.stabilizeOnly.length === 0) {
		failures.push('stabilize-only produced no runs');
	} else {
		for (const result of results.stabilizeOnly) {
			if (result.status !== 'overload') {
				failures.push(`stabilize-only seed ${result.seed} never overloaded`);
			}
			if (result.turns > bands.maxStabilizeTurns) {
				failures.push(
					`stabilize-only seed ${result.seed} turns ${result.turns} above floor limit ${bands.maxStabilizeTurns}`
				);
			}
		}
	}

	return { ok: failures.length === 0, failures };
}
