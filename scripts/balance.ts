import {
	DEFAULT_BANDS,
	casualPlay,
	checkBands,
	plannerPlay,
	report,
	stabilizeOnlyPlay
} from '../src/lib/game/arcade/balance';
import type { BalanceBands, BalanceResults, Result } from '../src/lib/game/arcade/balance';

const DEFAULT_SEED_COUNT = 20;

/** Where the CLI writes; injectable so the entry can be tested without a child process. */
export interface BalanceOutput {
	log(message: string): void;
	error(message: string): void;
}

function seedCount(args: readonly string[]): number {
	const inline = args.find((arg) => arg.startsWith('--seeds='));
	const value = inline
		? Number(inline.slice('--seeds='.length))
		: args.includes('--seeds')
			? Number(args[args.indexOf('--seeds') + 1])
			: DEFAULT_SEED_COUNT;

	return Number.isInteger(value) && value > 0 ? value : DEFAULT_SEED_COUNT;
}

/**
 * Run the harness and return the process exit code: `1` when `--check` asked
 * for enforcement and any band missed, `0` otherwise. Without `--check` the
 * report is printed for inspection and the command stays a report-only run,
 * saying so explicitly.
 */
export function runBalance(
	args: readonly string[] = [],
	bands: BalanceBands = DEFAULT_BANDS,
	output: BalanceOutput = console
): number {
	const seeds = Array.from({ length: seedCount(args) }, (_, index) => index + 1);
	const play = (policy: (seed: number) => Result): Result[] => seeds.map((seed) => policy(seed));

	const results: BalanceResults = {
		planner: play(plannerPlay),
		casual: play(casualPlay),
		stabilizeOnly: play(stabilizeOnlyPlay)
	};

	output.log(report(results, bands));

	if (!args.includes('--check')) {
		output.log('Report only: pass --check to exit 1 when a band misses.');
		return 0;
	}

	const check = checkBands(results, bands);
	if (check.ok) return 0;

	for (const failure of check.failures) output.error(`FAIL ${failure}`);
	return 1;
}

// Tests import `runBalance`; only a real CLI invocation prints or sets a code.
if (process.env.VITEST === undefined) {
	process.exitCode = runBalance(process.argv.slice(2));
}
