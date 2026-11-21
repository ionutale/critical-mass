import { describe, expect, it } from 'vitest';
import {
	checkBands,
	casualPlay,
	DEFAULT_BANDS,
	plannerPlay,
	report,
	stabilizeOnlyPlay
} from './balance';
import type { BalanceResults, Result } from './balance';

const SEEDS = [1, 2, 3, 4, 5] as const;

function median(values: readonly number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	if (sorted.length % 2 === 1) return sorted[middle] ?? 0;
	return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function resultsFor(run: (seed: number) => Result): Result[] {
	return SEEDS.map((seed) => run(seed));
}

function healthySuite(): BalanceResults {
	return {
		planner: resultsFor(plannerPlay),
		casual: resultsFor(casualPlay),
		stabilizeOnly: resultsFor(stabilizeOnlyPlay)
	};
}

describe('planner policy', () => {
	it('terminates without stalling on seeds 1-5', () => {
		for (const seed of SEEDS) {
			const result = plannerPlay(seed);

			expect(result.status).toBe('overload');
			expect(result.stalled).toBe(false);
			expect(result.turns).toBeGreaterThan(1);
			expect(result.turns).toBeLessThanOrEqual(DEFAULT_BANDS.maxTurns);
		}
	});

	it('is deterministic for the same seed', () => {
		expect(plannerPlay(7)).toEqual(plannerPlay(7));
	});

	it('plays an unlocked save without stalling', () => {
		const result = plannerPlay(3, ['starter-sodium', 'pool-nitrogen']);

		expect(result.status).toBe('overload');
		expect(result.stalled).toBe(false);
	});

	it('lands in the target turn band', () => {
		const turns = resultsFor(plannerPlay).map((result) => result.turns);

		expect(median(turns)).toBeGreaterThanOrEqual(DEFAULT_BANDS.targetMinTurns);
		expect(median(turns)).toBeLessThanOrEqual(DEFAULT_BANDS.targetMaxTurns);
		for (const turn of turns) {
			expect(turn).toBeGreaterThanOrEqual(DEFAULT_BANDS.minTurns);
			expect(turn).toBeLessThanOrEqual(DEFAULT_BANDS.maxTurns);
		}
	});

	it('finds at least two upgrade paths across seeds', () => {
		const paths = new Set(
			resultsFor(plannerPlay).map((result) => [...result.upgrades].sort().join(','))
		);

		expect(paths.size).toBeGreaterThanOrEqual(DEFAULT_BANDS.minUpgradePaths);
	});

	it('scores meaningfully above casual play', () => {
		const plannerScores = resultsFor(plannerPlay).map((result) => result.score);
		const casualScores = resultsFor(casualPlay).map((result) => result.score);

		expect(median(plannerScores)).toBeGreaterThanOrEqual(
			median(casualScores) * DEFAULT_BANDS.minScoreRatio
		);
	});
});

describe('casual policy', () => {
	it('terminates on every seed', () => {
		const results = resultsFor(casualPlay);

		for (const result of results) {
			expect(result.status).toBe('overload');
			expect(result.stalled).toBe(false);
		}
	});
});

describe('stabilize-only policy', () => {
	it('still overloads because the Heat floor rises', () => {
		for (const seed of SEEDS) {
			const result = stabilizeOnlyPlay(seed);

			expect(result.status).toBe('overload');
			expect(result.stalled).toBe(false);
			expect(result.turns).toBeLessThanOrEqual(DEFAULT_BANDS.maxStabilizeTurns);
		}
	});
});

describe('checkBands', () => {
	it('passes a healthy suite', () => {
		const check = checkBands(healthySuite());

		expect(check.failures).toEqual([]);
		expect(check.ok).toBe(true);
	});

	it('fails when the turn band misses', () => {
		const suite = healthySuite();
		const shortRun: Result = {
			seed: 1,
			status: 'overload',
			score: 0,
			turns: 2,
			bestChain: 0,
			upgrades: [],
			stalled: false
		};
		const check = checkBands({ ...suite, planner: [shortRun] });

		expect(check.ok).toBe(false);
		expect(check.failures.some((failure) => failure.includes('turns'))).toBe(true);
	});

	it('fails when the planner stalls', () => {
		const suite = healthySuite();
		const stalled: Result = {
			seed: 1,
			status: 'active',
			score: 0,
			turns: 24,
			bestChain: 0,
			upgrades: [],
			stalled: true
		};
		const check = checkBands({ ...suite, planner: [stalled] });

		expect(check.ok).toBe(false);
		expect(check.failures.some((failure) => failure.includes('stall'))).toBe(true);
	});

	it('fails when the score spread collapses', () => {
		const suite = healthySuite();
		const casual = suite.casual.map((result) => ({ ...result, score: 10_000 }));
		const check = checkBands({ ...suite, casual });

		expect(check.ok).toBe(false);
		expect(check.failures.some((failure) => failure.includes('score'))).toBe(true);
	});
});

describe('report', () => {
	it('summarises turns, score, chains, stalls, and upgrade paths', () => {
		const text = report(healthySuite());

		expect(text).toContain('planner');
		expect(text).toContain('turns');
		expect(text).toContain('score');
		expect(text).toContain('stalls');
		expect(text).toContain('upgrade paths');
	});
});
