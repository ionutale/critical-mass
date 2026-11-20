import { UNLOCKS } from '../../data/arcade/unlocks';
import type { UnlockRecord } from '../../data/arcade/unlocks';
import type { RunState } from './turn';

/**
 * Lifetime meta progression. Every field is cumulative across runs; `unlocks`
 * stores the ids already earned so evaluation is idempotent.
 */
export interface MetaState {
	bestScore: number;
	totalScore: number;
	runs: number;
	bestChain: number;
	unlocks: string[];
}

/** The scoring facts of one finished run. */
export interface RunStats {
	score: number;
	chain: number;
	turns: number;
}

/** A fresh save: no runs, no score, no unlocks. */
export function createMeta(overrides: Partial<MetaState> = {}): MetaState {
	return {
		bestScore: 0,
		totalScore: 0,
		runs: 0,
		bestChain: 0,
		unlocks: [],
		...overrides
	};
}

export function runStats(run: Pick<RunState, 'score' | 'bestChain' | 'turn'>): RunStats {
	return { score: run.score, chain: run.bestChain, turns: run.turn };
}

/** The lifetime metric a threshold node reads. */
export function metricValue(meta: MetaState, metric: UnlockRecord['metric']): number {
	switch (metric) {
		case 'totalScore':
			return meta.totalScore;
		case 'bestChain':
			return meta.bestChain;
		case 'runs':
			return meta.runs;
	}
}

/**
 * Ids newly earned by this meta state, in table order. Pure: callers append the
 * result to `meta.unlocks`, after which the same meta yields an empty list.
 */
export function evaluateUnlocks(meta: MetaState): string[] {
	const owned = new Set(meta.unlocks);

	return UNLOCKS.filter(
		(unlock) => !owned.has(unlock.id) && metricValue(meta, unlock.metric) >= unlock.threshold
	).map((unlock) => unlock.id);
}

/**
 * Tally an overloaded run into the save and append any unlocks it crossed.
 * Unfinished runs are ignored, so the caller can commit defensively.
 *
 * The store calls this once per Overload; calling it twice for the same run
 * would count that run twice, because a run carries no identity token.
 */
export function recordRun(
	meta: MetaState,
	run: Pick<RunState, 'status' | 'score' | 'bestChain' | 'turn'>
): MetaState {
	if (run.status !== 'overload') return meta;

	const stats = runStats(run);
	const tallied: MetaState = {
		...meta,
		bestScore: Math.max(meta.bestScore, stats.score),
		totalScore: meta.totalScore + stats.score,
		runs: meta.runs + 1,
		bestChain: Math.max(meta.bestChain, stats.chain),
		unlocks: [...meta.unlocks]
	};

	const newlyUnlocked = evaluateUnlocks(tallied);
	if (newlyUnlocked.length === 0) return tallied;

	return { ...tallied, unlocks: [...tallied.unlocks, ...newlyUnlocked] };
}
