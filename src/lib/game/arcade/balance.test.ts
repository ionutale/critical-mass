import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runBalance } from '../../../../scripts/balance';
import { createRun } from './turn';
import {
	archetypeOf,
	cardPlay,
	casualPlay,
	checkBands,
	countViablePlays,
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
		card: resultsFor(cardPlay),
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

	it('lands in the target turn band without a harness sprint', () => {
		const turns = resultsFor(plannerPlay).map((result) => result.turns);

		expect(median(turns)).toBeGreaterThanOrEqual(DEFAULT_BANDS.targetMinTurns);
		expect(median(turns)).toBeLessThanOrEqual(DEFAULT_BANDS.targetMaxTurns);
		for (const turn of turns) {
			expect(turn).toBeGreaterThanOrEqual(DEFAULT_BANDS.minTurns);
			expect(turn).toBeLessThanOrEqual(DEFAULT_BANDS.maxTurns);
		}
	});

	it('ends runs at the engine clock, never past the floor-only cap', () => {
		const planner = resultsFor(plannerPlay);
		const floorOnly = resultsFor(stabilizeOnlyPlay);
		const naturalCap = Math.max(...floorOnly.map((result) => result.turns));

		for (const result of planner) {
			expect(result.turns).toBeLessThanOrEqual(naturalCap);
		}
		expect(Math.min(...planner.map((result) => result.turns))).toBeGreaterThanOrEqual(
			DEFAULT_BANDS.targetMinTurns
		);
	});

	it('finds at least two upgrade paths across seeds', () => {
		const paths = new Set(
			resultsFor(plannerPlay).map((result) => [...result.upgrades].sort().join(','))
		);

		expect(paths.size).toBeGreaterThanOrEqual(DEFAULT_BANDS.minUpgradePaths);
	});

	it('offers at least two viable placements on typical turns', () => {
		const results = resultsFor(plannerPlay);
		const medianViable = median(results.map((result) => result.viablePlays));

		for (const result of results) {
			expect(result.viablePlays, `seed ${result.seed}`).toBeGreaterThan(0);
		}
		expect(medianViable).toBeGreaterThanOrEqual(DEFAULT_BANDS.minViablePlays);
	});

	it('counts only non-dominated placements for a turn', () => {
		const count = countViablePlays(createRun(7));

		expect(count).toBeGreaterThan(0);
		expect(Number.isInteger(count)).toBe(true);
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

describe('card policy', () => {
	it('terminates and overloads on every seed', () => {
		for (const seed of SEEDS) {
			const result = cardPlay(seed);

			expect(result.status).toBe('overload');
			expect(result.stalled).toBe(false);
			expect(result.upgrades.length).toBeGreaterThan(0);
		}
	});

	it('reaches a card-focused build', () => {
		const results = resultsFor(cardPlay);

		expect(results.some((result) => result.archetype === 'card')).toBe(true);
	});

	it('classifies builds by card and modifier stock', () => {
		expect(archetypeOf([])).toBe('none');
		expect(archetypeOf(['add-c', 'add-h-2'])).toBe('card');
		expect(archetypeOf(['coolant', 'efficient', 'salvage'])).toBe('modifier');
		expect(archetypeOf(['add-c', 'coolant'])).toBe('mixed');
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
			viablePlays: 3,
			archetype: 'none',
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
			viablePlays: 3,
			archetype: 'none',
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

	it('fails when the casual baseline is empty', () => {
		const suite = healthySuite();
		const check = checkBands({ ...suite, casual: [] });

		expect(check.ok).toBe(false);
		expect(check.failures).toContain('casual produced no runs');
	});

	it('fails when the casual median score is zero', () => {
		const suite = healthySuite();
		const casual = suite.casual.map((result) => ({ ...result, score: 0 }));
		const check = checkBands({ ...suite, casual });

		expect(check.ok).toBe(false);
		expect(check.failures.some((failure) => failure.includes('casual median score is 0'))).toBe(
			true
		);
	});

	it('fails when typical turns offer too few viable plays', () => {
		const suite = healthySuite();
		const planner = suite.planner.map((result) => ({ ...result, viablePlays: 1 }));
		const check = checkBands({ ...suite, planner });

		expect(check.ok).toBe(false);
		expect(check.failures.some((failure) => failure.includes('viable plays'))).toBe(true);
	});

	it('fails when only one build archetype is viable', () => {
		const suite = healthySuite();
		const planner = suite.planner.map((result) => ({ ...result, archetype: 'modifier' as const }));
		const card = suite.card.map((result) => ({ ...result, archetype: 'modifier' as const }));
		const check = checkBands({ ...suite, planner, card });

		expect(check.ok).toBe(false);
		expect(check.failures.some((failure) => failure.includes('build archetypes'))).toBe(true);
	});

	it('fails when the card policy does not overload', () => {
		const suite = healthySuite();
		const card = [{ ...suite.card[0]!, status: 'active' as const, turns: 40 }];
		const check = checkBands({ ...suite, card });

		expect(check.ok).toBe(false);
		expect(check.failures.some((failure) => failure.includes('card did not overload'))).toBe(true);
	});
});

describe('balance CLI', () => {
	function capture(): {
		lines: string[];
		output: { log: (line: string) => void; error: (line: string) => void };
	} {
		const lines: string[] = [];
		return {
			lines,
			output: {
				log: (line: string) => lines.push(line),
				error: (line: string) => lines.push(line)
			}
		};
	}

	it('exits 1 on a failing --check', () => {
		const { lines, output } = capture();
		const code = runBalance(
			['--seeds=1', '--check'],
			{ ...DEFAULT_BANDS, targetMinTurns: 99 },
			output
		);

		expect(code).toBe(1);
		expect(lines.join('\n')).toContain('FAIL planner turns median');
	});

	it('exits 0 on a passing --check and skips the cross-seed path band for one seed', () => {
		const { lines, output } = capture();
		const code = runBalance(['--seeds=1', '--check'], DEFAULT_BANDS, output);

		expect(code).toBe(0);
		expect(lines.join('\n')).toContain('Bands: PASS');
	});

	it('states that a plain run is report-only', () => {
		const { lines, output } = capture();
		const code = runBalance(['--seeds=1'], { ...DEFAULT_BANDS, targetMinTurns: 99 }, output);

		expect(code).toBe(0);
		expect(lines.join('\n')).toContain('Bands: FAIL');
		expect(lines.join('\n')).toContain('Report only: pass --check');
	});

	it('runs under direct vite-node invocation and exits on the band result', () => {
		const cli = resolve(process.cwd(), 'node_modules/vite-node/dist/cli.mjs');
		expect(existsSync(cli)).toBe(true);

		const env = { ...process.env };
		delete env.VITEST;

		const result = spawnSync(
			process.execPath,
			[cli, 'scripts/balance.ts', '--seeds=1', '--check'],
			{ cwd: process.cwd(), env, encoding: 'utf8', timeout: 30_000 }
		);

		expect(result.error).toBeUndefined();
		expect(result.status).toBe(0);
		expect(result.stdout).toContain('Balance report');
		expect(result.stdout).toContain('Bands: PASS');
	}, 30_000);
});

describe('report', () => {
	it('summarises turns, score, chains, stalls, upgrades, viability, and builds', () => {
		const text = report(healthySuite());

		expect(text).toContain('planner');
		expect(text).toContain('card');
		expect(text).toContain('turns');
		expect(text).toContain('score');
		expect(text).toContain('stalls');
		expect(text).toContain('natural cap');
		expect(text).toContain('upgrade paths');
		expect(text).toContain('viable plays');
		expect(text).toContain('build archetypes');
	});
});
