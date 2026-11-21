import {
	casualPlay,
	checkBands,
	plannerPlay,
	report,
	stabilizeOnlyPlay
} from '../src/lib/game/arcade/balance';
import type { BalanceResults, Result } from '../src/lib/game/arcade/balance';

const DEFAULT_SEED_COUNT = 20;

function seedCount(args: readonly string[]): number {
	const inline = args.find((arg) => arg.startsWith('--seeds='));
	const value = inline
		? Number(inline.slice('--seeds='.length))
		: args.includes('--seeds')
			? Number(args[args.indexOf('--seeds') + 1])
			: DEFAULT_SEED_COUNT;

	return Number.isInteger(value) && value > 0 ? value : DEFAULT_SEED_COUNT;
}

function main(): void {
	const args = process.argv.slice(2);
	const seeds = Array.from({ length: seedCount(args) }, (_, index) => index + 1);
	const play = (policy: (seed: number) => Result): Result[] => seeds.map((seed) => policy(seed));

	const results: BalanceResults = {
		planner: play(plannerPlay),
		casual: play(casualPlay),
		stabilizeOnly: play(stabilizeOnlyPlay)
	};

	console.log(report(results));

	if (!args.includes('--check')) return;

	const check = checkBands(results);
	if (check.ok) return;

	for (const failure of check.failures) console.error(`FAIL ${failure}`);
	process.exitCode = 1;
}

/** Vitest may import this module; only report on a real `pnpm balance` run. */
const underTest = process.env.VITEST !== undefined;
const invoked =
	process.env.npm_lifecycle_event === 'balance' ||
	process.argv.some((arg) => arg.endsWith('scripts/balance.ts'));

if (!underTest && invoked) main();
