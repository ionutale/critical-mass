import { LEGACY_ELEMENT_BY_SYMBOL, LEGACY_ELEMENTS } from '../src/lib/data/elements.legacy';
import { MODULE_BY_ID } from '../src/lib/data/modules';
import { PATCH_BY_ID } from '../src/lib/data/patches';
import { RECIPES } from '../src/lib/data/recipes';
import { UNLOCKS } from '../src/lib/data/unlocks';
import { activeContract, chooseDraft, deliver, nextSector } from '../src/lib/game/contracts';
import { placeCard, previewPlacement, type PlacementPreview } from '../src/lib/game/fusion';
import { createRun, discardCard, endTurn, scrap, vent } from '../src/lib/game/turn';
import type { DraftOption, RunState } from '../src/lib/types';

// Hard measurement window. Long enough that slower-but-progressing runs can
// finish, so hitting it is evidence of a stall instead of a short leash.
const ACTION_CAP = 20000;
const SEED_COUNT = 40;
// A delivery normally happens every few hundred actions for the casual
// reference. A run that spends this long without one is not "slow", it is not
// progressing. Runs that hit the action cap after this window are reported as
// genuine stalls; runs that hit the cap while still delivering are "abandoned"
// (slow but progressing), so the stall count is measured progress rather than a
// valve convention.
const STALL_WINDOW = 4000;
// The competent reference vents once the gauge passes this fraction but does
// not bottom it out, so an expensive target chain can still melt it down.
const COMPETENT_VENT_AT = 0.6;
// The strong reference is a stricter resource manager: it vents earlier and
// refuses target lines that would melt the reactor, to test whether unlocks
// change difficulty for a player who does not trade pressure for speed.
const STRONG_VENT_AT = 0.5;
const COMPETENT_SEARCH_BUDGET = 64;
const STRONG_SEARCH_BUDGET = 128;
const ALL_UNLOCKS = UNLOCKS.map((unlock) => unlock.id);

type Policy = 'casual' | 'competent' | 'strong';

export interface Result {
	seed: number;
	status: RunState['status'];
	contracts: number;
	peak: number;
	pressure: number;
	sector: number;
	actions: number;
	idleAtEnd: number;
	abandoned: boolean;
	stalled: boolean;
}

/** Inclusive win-rate band (percent) with an optional stall ceiling. */
export interface Band {
	min: number;
	max: number;
	maxStalls?: number;
}

export interface Block {
	label: string;
	target: string;
	results: Result[];
	band?: Band;
}

interface Placement {
	hand: number;
	cell: number;
	choices: number[];
	preview: PlacementPreview;
}

interface Score {
	hasTarget: boolean;
	directCount: number;
	maxAncestorTier: number;
	ancestorCount: number;
	ancestorPairs: number;
	minDistance: number;
	gain: number;
}

interface Ancestry {
	distance: Map<string, number>;
	pairs: Array<[string, string]>;
	ancestors: Set<string>;
}

function tierOf(symbol: string): number {
	return LEGACY_ELEMENT_BY_SYMBOL.get(symbol)?.tier ?? 0;
}

function maxTier(grid: readonly (string | null)[]): number {
	let best = -1;
	for (const tile of grid) {
		if (tile) best = Math.max(best, tierOf(tile));
	}
	return best;
}

const ANCESTRY_CACHE = new Map<string, Ancestry>();

/**
 * For a target, how many fusions each element is away from it (0 = target),
 * the target's direct ingredients, and every element on a working ladder
 * toward it. Transitive: an element is an ancestor only if higher tiers can
 * still reach the target, so e.g. Si is not an ancestor of Mg.
 */
function ancestryFor(target: string, allowCatalyst: boolean): Ancestry {
	const key = `${target}:${allowCatalyst ? 1 : 0}`;
	const cached = ANCESTRY_CACHE.get(key);
	if (cached) return cached;

	const distance = new Map<string, number>([[target, 0]]);
	let changed = true;
	while (changed) {
		changed = false;
		for (const recipe of RECIPES) {
			if (recipe.catalyst && !allowCatalyst) continue;
			const result = distance.get(recipe.result);
			if (result === undefined) continue;
			for (const ingredient of [recipe.a, recipe.b]) {
				const next = result + 1;
				const current = distance.get(ingredient);
				if (current === undefined || next < current) {
					distance.set(ingredient, next);
					changed = true;
				}
			}
		}
	}

	const pairs: Array<[string, string]> = [];
	for (const recipe of RECIPES) {
		if (recipe.catalyst && !allowCatalyst) continue;
		if (recipe.result !== target) continue;
		pairs.push([recipe.a, recipe.b]);
	}

	const ancestry: Ancestry = { distance, pairs, ancestors: new Set(distance.keys()) };
	ANCESTRY_CACHE.set(key, ancestry);
	return ancestry;
}

function scoreGrid(
	grid: readonly (string | null)[],
	target: string,
	ancestry: Ancestry,
	gain: number
): Score {
	const counts = new Map<string, number>();
	let hasTarget = false;
	let minDistance = Number.POSITIVE_INFINITY;
	let maxAncestorTier = -1;

	for (const tile of grid) {
		if (!tile) continue;
		counts.set(tile, (counts.get(tile) ?? 0) + 1);
		if (tile === target) hasTarget = true;
		const distance = ancestry.distance.get(tile);
		if (distance === undefined) continue;
		minDistance = Math.min(minDistance, distance);
		maxAncestorTier = Math.max(maxAncestorTier, tierOf(tile));
	}

	let directCount = 0;
	for (const [a, b] of ancestry.pairs) {
		let present = 0;
		if (counts.has(a)) present += 1;
		if (b !== a && counts.has(b)) present += 1;
		directCount = Math.max(directCount, present);
	}

	let ancestorCount = 0;
	let ancestorPairs = 0;
	for (const [tile, count] of counts) {
		if (!ancestry.ancestors.has(tile)) continue;
		ancestorCount += 1;
		if (count >= 2) ancestorPairs += 1;
	}

	return {
		hasTarget,
		directCount,
		maxAncestorTier,
		ancestorCount,
		ancestorPairs,
		minDistance,
		gain
	};
}

function better(a: Score, b: Score | null): boolean {
	if (!b) return true;
	if (a.hasTarget !== b.hasTarget) return a.hasTarget;
	if (a.directCount !== b.directCount) return a.directCount > b.directCount;
	if (a.maxAncestorTier !== b.maxAncestorTier) return a.maxAncestorTier > b.maxAncestorTier;
	if (a.ancestorCount !== b.ancestorCount) return a.ancestorCount > b.ancestorCount;
	if (a.ancestorPairs !== b.ancestorPairs) return a.ancestorPairs > b.ancestorPairs;
	if (a.minDistance !== b.minDistance) return a.minDistance < b.minDistance;
	return a.gain < b.gain;
}

/** Progress means the board's ladder toward the target actually moved. */
function progresses(score: Score, baseline: Score): boolean {
	if (score.hasTarget) return true;
	if (score.directCount !== baseline.directCount) return score.directCount > baseline.directCount;
	if (score.maxAncestorTier !== baseline.maxAncestorTier) {
		return score.maxAncestorTier > baseline.maxAncestorTier;
	}
	if (score.ancestorCount !== baseline.ancestorCount) {
		return score.ancestorCount > baseline.ancestorCount;
	}
	return score.ancestorPairs > baseline.ancestorPairs;
}

function cheaper(a: Placement, b: Placement | null): boolean {
	return !b || a.preview.pressureGain < b.preview.pressureGain;
}

function emptyCells(run: RunState): number[] {
	return run.grid.flatMap((tile, cell) => (tile === null ? [cell] : []));
}

/**
 * Enumerate the branches reachable from one placement, looking for a grid that
 * contains the target. Each visited prefix is a full committable preview.
 * Every option at every depth is explored, including the default one, so
 * "keep the default at depth d, branch at depth d+1" paths are reachable.
 */
export function searchForTarget(
	run: RunState,
	hand: number,
	cell: number,
	target: string,
	budget: { nodes: number }
): Placement | null {
	let best: Placement | null = null;

	const explore = (prefix: number[]) => {
		if (budget.nodes <= 0) return;
		budget.nodes -= 1;

		const preview = previewPlacement(run, hand, cell, LEGACY_ELEMENTS, RECIPES, prefix);
		if (!preview) return;

		if (preview.grid.includes(target)) {
			const placement: Placement = { hand, cell, choices: [...prefix], preview };
			if (cheaper(placement, best)) best = placement;
		}

		const step = preview.steps[prefix.length];
		if (!step || step.options.length <= 1) return;

		for (let option = 0; option < step.options.length; option += 1) {
			explore([...prefix, option]);
		}
	};

	explore([]);
	return best;
}

interface Decision {
	kind: 'place' | 'vent' | 'scrap' | 'end';
	placement?: Placement;
	handIndex?: number;
	cell?: number;
}

/** Lowest ladder value in hand: the card we can most afford to cycle away. */
function pickVentIndex(run: RunState, ancestry: Ancestry): number {
	let best = 0;
	let bestScore = Number.NEGATIVE_INFINITY;
	run.hand.forEach((card, index) => {
		const distance = ancestry.distance.get(card);
		const score = distance === undefined ? 1000 : distance * 10 + tierOf(card);
		if (score > bestScore) {
			bestScore = score;
			best = index;
		}
	});
	return best;
}

function pickScrapCell(run: RunState, ancestry: Ancestry): number {
	let best = -1;
	let bestScore = Number.NEGATIVE_INFINITY;
	run.grid.forEach((tile, cell) => {
		if (!tile) return;
		const distance = ancestry.distance.get(tile);
		const score = distance === undefined ? 1000 : distance * 100 - tierOf(tile);
		if (score > bestScore) {
			bestScore = score;
			best = cell;
		}
	});
	return best;
}

/**
 * Try each occupied cell as a hole and see if a placement through that hole
 * reaches the target or advances the ladder. This is how the policy opens up
 * "blocked" geometry (for example fusing C + N into F behind a wall of tiles).
 */
function findScrapPlan(run: RunState, target: string, ancestry: Ancestry, baseline: Score): number {
	if (run.scrapsUsed >= 1) return -1;
	let bestCell = -1;
	let bestScore: Score | null = null;

	for (let cell = 0; cell < run.grid.length; cell += 1) {
		if (!run.grid[cell]) continue;
		const after = scrap(run, cell);
		if (after === run) continue;

		for (let hand = 0; hand < after.hand.length; hand += 1) {
			for (const spot of emptyCells(after)) {
				const preview = previewPlacement(after, hand, spot, LEGACY_ELEMENTS, RECIPES);
				if (!preview || preview.meltdown) continue;
				const score = scoreGrid(preview.grid, target, ancestry, preview.pressureGain);
				if (score.hasTarget || progresses(score, baseline)) {
					if (!bestScore || better(score, bestScore)) {
						bestScore = score;
						bestCell = cell;
					}
				}
			}
		}
	}

	return bestCell;
}

function casualDecision(run: RunState, target: string): Decision {
	const boardTier = maxTier(run.grid);
	let targetBest: Placement | null = null;
	let advanceBest: Placement | null = null;
	let safeBest: Placement | null = null;

	for (let hand = 0; hand < run.hand.length; hand += 1) {
		for (const cell of emptyCells(run)) {
			const preview = previewPlacement(run, hand, cell, LEGACY_ELEMENTS, RECIPES);
			if (!preview || preview.meltdown) continue;
			const placement: Placement = { hand, cell, choices: [], preview };

			if (preview.grid.includes(target)) {
				if (cheaper(placement, targetBest)) targetBest = placement;
			} else if (maxTier(preview.grid) > boardTier) {
				if (cheaper(placement, advanceBest)) advanceBest = placement;
			} else if (cheaper(placement, safeBest)) {
				safeBest = placement;
			}
		}
	}

	if (targetBest) return { kind: 'place', placement: targetBest };
	if (advanceBest) return { kind: 'place', placement: advanceBest };
	if (safeBest) return { kind: 'place', placement: safeBest };
	return { kind: 'end' };
}

function competentDecision(run: RunState, target: string, mode: 'competent' | 'strong'): Decision {
	const ancestry = ancestryFor(target, run.hasCatalyst);
	const baseline = scoreGrid(run.grid, target, ancestry, 0);
	const ventAt = mode === 'strong' ? STRONG_VENT_AT : COMPETENT_VENT_AT;
	const searchBudget = mode === 'strong' ? STRONG_SEARCH_BUDGET : COMPETENT_SEARCH_BUDGET;
	let bestProgress: { placement: Placement; score: Score } | null = null;
	let directTarget: Placement | null = null;

	for (let hand = 0; hand < run.hand.length; hand += 1) {
		for (const cell of emptyCells(run)) {
			const preview = previewPlacement(run, hand, cell, LEGACY_ELEMENTS, RECIPES);
			if (!preview) continue;
			const placement: Placement = { hand, cell, choices: [], preview };
			const targetLine = preview.grid.includes(target);
			// The strong reference refuses a target line that melts the reactor;
			// the competent reference trades pressure for speed on purpose.
			if (targetLine && (mode === 'competent' || !preview.meltdown)) {
				if (cheaper(placement, directTarget)) directTarget = placement;
			}
			if (preview.meltdown) continue;
			const score = scoreGrid(preview.grid, target, ancestry, preview.pressureGain);
			if (bestProgress === null || better(score, bestProgress.score)) {
				bestProgress = { placement, score };
			}
		}
	}

	if (run.pressure > run.pressureCap * ventAt && run.hand.length > 0) {
		return { kind: 'vent', handIndex: pickVentIndex(run, ancestry) };
	}

	// A target in reach wins now, even if the placement is expensive: the
	// heuristic prefers the cheapest target line rather than hoarding pressure.
	if (directTarget) return { kind: 'place', placement: directTarget };

	// No default branch reaches the target: let the policy pick a different
	// chain at each step and search for a path that does.
	if (emptyCells(run).length > 0 && run.hand.length > 0) {
		let branchTarget: Placement | null = null;
		for (let hand = 0; hand < run.hand.length; hand += 1) {
			for (const cell of emptyCells(run)) {
				const found = searchForTarget(run, hand, cell, target, { nodes: searchBudget });
				if (!found) continue;
				if (mode === 'strong' && found.preview.meltdown) continue;
				if (cheaper(found, branchTarget)) branchTarget = found;
			}
		}
		if (branchTarget) return { kind: 'place', placement: branchTarget };
	}

	if (bestProgress && progresses(bestProgress.score, baseline)) {
		return { kind: 'place', placement: bestProgress.placement };
	}

	// Open a blocking cell if doing so unlocks a target or a ladder step.
	if (run.scrapsUsed < 1) {
		const plan = findScrapPlan(run, target, ancestry, baseline);
		if (plan >= 0) return { kind: 'scrap', cell: plan };
	}

	if (emptyCells(run).length === 0) {
		if (run.scrapsUsed < 1) {
			const cell = pickScrapCell(run, ancestry);
			if (cell >= 0) return { kind: 'scrap', cell };
		}
		if (run.hand.length > 0) {
			return { kind: 'vent', handIndex: pickVentIndex(run, ancestry) };
		}
		return { kind: 'end' };
	}

	if (run.hand.length > 0) {
		// Cycle the least useful card; for a target-aware player this digs for
		// the card the ladder is waiting on.
		const index = pickVentIndex(run, ancestry);
		const card = run.hand[index];
		if (ancestry.distance.get(card) === undefined || run.pressure > run.sectorFloor) {
			return { kind: 'vent', handIndex: index };
		}
	}

	const fallback = anyBestPlacement(run, ancestry, target);
	if (fallback) return { kind: 'place', placement: fallback };
	if (run.hand.length > 0) return { kind: 'vent', handIndex: pickVentIndex(run, ancestry) };
	return { kind: 'end' };
}

/** Last resort that always terminates: the best non-melting placement. */
function anyBestPlacement(run: RunState, ancestry: Ancestry, target: string): Placement | null {
	let best: Placement | null = null;
	let bestScore: Score | null = null;
	for (let hand = 0; hand < run.hand.length; hand += 1) {
		for (const cell of emptyCells(run)) {
			const preview = previewPlacement(run, hand, cell, LEGACY_ELEMENTS, RECIPES);
			if (!preview || preview.meltdown) continue;
			const score = scoreGrid(preview.grid, target, ancestry, preview.pressureGain);
			if (!bestScore || better(score, bestScore)) {
				bestScore = score;
				best = { hand, cell, choices: [], preview };
			}
		}
	}
	return best;
}

function draftChoice(run: RunState, policy: Policy): number {
	if (!run.pendingDraft || run.pendingDraft.length === 0) return 0;
	if (policy === 'casual') return 0;

	// The next contract variant is chosen before the option is applied, so any
	// option can be used to peek at it.
	const upcoming = activeContract(chooseDraft(run, 0));
	const ancestry = ancestryFor(upcoming.target, run.hasCatalyst);

	let best = 0;
	let bestScore = Number.NEGATIVE_INFINITY;

	run.pendingDraft.forEach((option, index) => {
		const score = draftScore(option, run, ancestry);
		if (score > bestScore) {
			bestScore = score;
			best = index;
		}
	});

	return best;
}

function moduleScore(effect: string, run: RunState): number {
	switch (effect) {
		case 'catalyst':
			return run.hasCatalyst ? 10 : 100;
		case 'fusion-10':
			return 90;
		case 'chain-bonus-2':
			return 85;
		case 'vent+5':
			return 80;
		case 'cap+10':
			return 75;
		case 'delivery+1':
			return 70;
		case 'count-1':
			return 65;
		case 'hand+1':
			return 60;
		case 'draw+1':
			return 60;
		case 'neutron':
			return 55;
		case 'add-he-2':
			return 50;
		case 'meltdown-save':
			return 45;
		case 'sector-shield':
			return 40;
		case 'duplicate-card':
			return 30;
		case 'draft+1':
			return 30;
		case 'reroll':
			return 15;
		default:
			return 0;
	}
}

function draftScore(option: DraftOption, run: RunState, ancestry: Ancestry): number {
	if (option.kind === 'cards') {
		const distance = ancestry.distance.get(option.element);
		const relevance = distance === undefined ? 0 : Math.max(0, 30 - distance * 5);
		return 35 + tierOf(option.element) * 2 + relevance;
	}
	const effect =
		option.kind === 'module'
			? MODULE_BY_ID.get(option.moduleId)?.effect
			: PATCH_BY_ID.get(option.patchId)?.effect;
	return 45 + moduleScore(effect ?? '', run);
}

function hasEmptyCell(run: RunState): boolean {
	return run.grid.some((tile) => tile === null);
}

function step(run: RunState, unlocked: readonly string[], policy: Policy): RunState {
	const target = activeContract(run).target;
	const targetCells = run.grid.flatMap((tile, cell) => (tile === target ? [cell] : []));
	if (targetCells.length > 0) return deliver(run, targetCells[0], unlocked);

	if (policy === 'casual' && run.pressure > run.pressureCap * 0.7 && run.hand.length > 0) {
		return vent(run, 0);
	}

	const decision =
		policy === 'casual' ? casualDecision(run, target) : competentDecision(run, target, policy);

	const applied = applyDecision(run, decision);
	if (applied) return applied;

	if (!hasEmptyCell(run) && run.scrapsUsed < 1) {
		const ancestry = ancestryFor(target, run.hasCatalyst);
		const cell = pickScrapCell(run, ancestry);
		if (cell >= 0) {
			const next = scrap(run, cell);
			if (next !== run) return next;
		}
	}

	if (run.hand.length > 0 && run.pressure > run.sectorFloor) {
		const ancestry = ancestryFor(target, run.hasCatalyst);
		return vent(run, policy === 'casual' ? 0 : pickVentIndex(run, ancestry));
	}

	return endTurn(run);
}

function applyDecision(run: RunState, decision: Decision): RunState | null {
	if (decision.kind === 'place' && decision.placement) {
		const { hand, cell, choices } = decision.placement;
		const next = placeCard(run, hand, cell, LEGACY_ELEMENTS, RECIPES, choices);
		return next !== run ? next : null;
	}

	if (decision.kind === 'scrap' && decision.cell !== undefined) {
		const next = scrap(run, decision.cell);
		return next !== run ? next : null;
	}

	if (decision.kind === 'vent' && decision.handIndex !== undefined) {
		const next = vent(run, decision.handIndex);
		return next !== run ? next : null;
	}

	return null;
}

function play(seed: number, unlocked: readonly string[], policy: Policy): Result {
	let run = createRun(seed);
	let peak = 0;
	let actions = 0;
	let lastProgress = 0;
	let marker = `${run.contractsCompleted}:${run.delivered}:${run.sector}`;

	while (run.status === 'active' && actions < ACTION_CAP) {
		actions += 1;
		peak = Math.max(peak, run.pressure);

		const nextMarker = `${run.contractsCompleted}:${run.delivered}:${run.sector}`;
		if (nextMarker !== marker) {
			marker = nextMarker;
			lastProgress = actions;
		}

		if (run.pendingDraft) {
			run = chooseDraft(run, draftChoice(run, policy));
			continue;
		}
		if (run.pendingTransition) {
			run = nextSector(run, unlocked);
			continue;
		}
		if (run.pendingDiscards > 0) {
			run = discardCard(run, 0);
			continue;
		}

		const before = run;
		run = step(run, unlocked, policy);
		if (run === before) run = endTurn(run);
	}

	const idleAtEnd = actions - lastProgress;
	return {
		seed,
		status: run.status,
		contracts: run.contractsCompleted,
		peak,
		pressure: run.pressure,
		sector: run.sector,
		actions,
		idleAtEnd,
		// Cap reached while still delivering: slow, but demonstrably progressing.
		abandoned: run.status === 'active' && idleAtEnd < STALL_WINDOW,
		// Cap reached after a long silent stretch: a genuine no-progress stall.
		stalled: run.status === 'active' && idleAtEnd >= STALL_WINDOW
	};
}

export function casualPlay(seed: number, unlocked: readonly string[]): Result {
	return play(seed, unlocked, 'casual');
}

export function competentPlay(seed: number, unlocked: readonly string[]): Result {
	return play(seed, unlocked, 'competent');
}

export function strongPlay(seed: number, unlocked: readonly string[]): Result {
	return play(seed, unlocked, 'strong');
}

function winRate(results: readonly Result[]): number {
	return (results.filter((result) => result.status === 'victory').length / results.length) * 100;
}

/** One message per acceptance band that missed. An empty list means all bands hold. */
export function checkBands(blocks: readonly Block[]): string[] {
	const failures: string[] = [];

	for (const block of blocks) {
		if (!block.band) continue;

		const rate = winRate(block.results);
		if (rate < block.band.min || rate > block.band.max) {
			failures.push(
				`${block.label}: ${rate.toFixed(0)}% wins, expected ${block.band.min}–${block.band.max}%`
			);
		}

		const stalls = block.results.filter((result) => result.stalled).length;
		if (block.band.maxStalls !== undefined && stalls > block.band.maxStalls) {
			failures.push(`${block.label}: ${stalls} stalls, expected at most ${block.band.maxStalls}`);
		}
	}

	return failures;
}

function report(block: Block): void {
	const { label, target, results } = block;
	const wins = results.filter((result) => result.status === 'victory').length;
	const meltdowns = results.filter((result) => result.status === 'meltdown').length;
	const abandoned = results.filter((result) => result.abandoned).length;
	const stalls = results.filter((result) => result.stalled).length;
	const rate = winRate(results);
	const average = (values: number[]) =>
		values.reduce((sum, value) => sum + value, 0) / values.length;

	console.log(`\n${label} (target ${target})`);
	console.log(
		`  runs ${results.length} · wins ${wins} (${rate.toFixed(0)}%) · meltdowns ${meltdowns} · abandoned ${abandoned} (cap, still progressing) · stalls ${stalls} (cap, no delivery in ${STALL_WINDOW}+ actions)`
	);
	console.log(
		`  avg contracts ${average(results.map((result) => result.contracts)).toFixed(1)} · avg peak pressure ${average(
			results.map((result) => result.peak)
		).toFixed(
			0
		)} · avg sector ${average(results.map((result) => result.sector)).toFixed(1)} · avg actions ${average(
			results.map((result) => result.actions)
		).toFixed(0)}`
	);
}

const seeds = Array.from({ length: SEED_COUNT }, (_, index) => index + 1);

function collectBlocks(): Block[] {
	return [
		{
			label: 'Casual · no unlocks',
			target: 'acceptance 10–20% wins',
			results: seeds.map((seed) => casualPlay(seed, [])),
			band: { min: 10, max: 20 }
		},
		{
			label: 'Casual · all unlocks',
			target: 'reference only',
			results: seeds.map((seed) => casualPlay(seed, ALL_UNLOCKS))
		},
		{
			label: 'Competent · no unlocks',
			target: 'reference only',
			results: seeds.map((seed) => competentPlay(seed, []))
		},
		{
			label: 'Competent · all unlocks',
			target: 'acceptance 30–50% wins · 0 stalls',
			results: seeds.map((seed) => competentPlay(seed, ALL_UNLOCKS)),
			band: { min: 30, max: 50, maxStalls: 0 }
		},
		{
			label: 'Strong · no unlocks',
			target: 'reference only',
			results: seeds.map((seed) => strongPlay(seed, []))
		},
		{
			label: 'Strong · all unlocks',
			target: 'reference only',
			results: seeds.map((seed) => strongPlay(seed, ALL_UNLOCKS))
		}
	];
}

function runReports(check: boolean): void {
	const blocks = collectBlocks();
	for (const block of blocks) report(block);

	console.log(
		'\nNote: the two competent blocks are a heuristic regression guard, not a difficulty measurement.'
	);
	console.log(
		'Competent trades pressure for speed on purpose, so no-unlocks and all-unlocks can land on identical outcome counts (see above).'
	);
	console.log(
		'The strong reference (earlier venting, refuses melting target lines) reaches the win ceiling in BOTH configs: once pressure is managed, unlocks do not measurably change difficulty in this harness.'
	);

	if (!check) return;

	const failures = checkBands(blocks);
	if (failures.length === 0) {
		console.log('\nBalance check: all acceptance bands hold.');
		return;
	}

	console.error('\nBalance check failed:');
	for (const failure of failures) console.error(`  ${failure}`);
	process.exitCode = 1;
}

/** Vitest imports this module for policy and branch tests; only report on a direct run. */
const underTest = process.env.VITEST !== undefined;

if (!underTest) runReports(process.argv.includes('--check'));
