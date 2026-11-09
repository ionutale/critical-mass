import { ELEMENTS } from '../src/lib/data/elements';
import { RECIPES } from '../src/lib/data/recipes';
import { UNLOCKS } from '../src/lib/data/unlocks';
import { activeContract, chooseDraft, deliver, nextSector } from '../src/lib/game/contracts';
import { previewPlacement, placeCard } from '../src/lib/game/fusion';
import { createRun, discardCard, endTurn, scrap, vent } from '../src/lib/game/turn';
import type { RunState } from '../src/lib/types';

interface Result {
	seed: number;
	status: RunState['status'];
	contracts: number;
	peak: number;
	pressure: number;
	sector: number;
	actions: number;
}

const ALL_UNLOCKS = UNLOCKS.map((unlock) => unlock.id);

function play(seed: number, unlocked: readonly string[]): Result {
	let run = createRun(seed);
	let peak = 0;
	let actions = 0;

	while (run.status === 'active' && actions < 4000) {
		actions += 1;
		peak = Math.max(peak, run.pressure);

		if (run.pendingDraft) {
			run = chooseDraft(run, 0);
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

		const contract = activeContract(run);
		const targetCells = run.grid
			.map((tile, index) => (tile === contract.target ? index : -1))
			.filter((index) => index >= 0);

		if (targetCells.length > 0) {
			run = deliver(run, targetCells[0], unlocked);
			continue;
		}

		if (run.pressure > run.pressureCap * 0.7 && run.hand.length > 0) {
			run = vent(run, 0);
			continue;
		}

		let best: { hand: number; cell: number; gain: number } | null = null;
		let safe: { hand: number; cell: number; gain: number } | null = null;
		for (let hand = 0; hand < run.hand.length; hand += 1) {
			for (let cell = 0; cell < 25; cell += 1) {
				const preview = previewPlacement(run, hand, cell, ELEMENTS, RECIPES);
				if (!preview || preview.meltdown) continue;

				const candidate = { hand, cell, gain: preview.pressureGain };
				if (preview.steps.length > 0) {
					if (!best || candidate.gain < best.gain) best = candidate;
				} else if (!safe || candidate.gain < safe.gain) {
					safe = candidate;
				}
			}
		}

		const choice = best ?? safe;
		if (choice && run.pressure + choice.gain <= run.pressureCap) {
			run = placeCard(run, choice.hand, choice.cell, ELEMENTS, RECIPES);
			continue;
		}
		if (run.hand.length > 0) {
			run = vent(run, 0);
			continue;
		}

		if (run.grid.every((tile) => tile !== null)) {
			const cell = run.grid.findIndex((tile) => tile !== contract.target);
			if (cell >= 0 && run.scrapsUsed < 1) {
				run = scrap(run, cell);
				continue;
			}
		}

		const empty = run.grid.findIndex((tile) => tile === null);
		if (empty >= 0 && run.hand.length > 0) {
			run = placeCard(run, 0, empty, ELEMENTS, RECIPES);
			continue;
		}
		run = endTurn(run);
	}

	return {
		seed,
		status: run.status,
		contracts: run.contractsCompleted,
		peak,
		pressure: run.pressure,
		sector: run.sector,
		actions
	};
}

function report(label: string, results: Result[]): void {
	const wins = results.filter((result) => result.status === 'victory').length;
	const meltdowns = results.filter((result) => result.status === 'meltdown').length;
	const rate = (wins / results.length) * 100;
	const average = (values: number[]) =>
		values.reduce((sum, value) => sum + value, 0) / values.length;

	console.log(`\n${label}`);
	console.log(
		`  runs ${results.length} · wins ${wins} (${rate.toFixed(0)}%) · meltdowns ${meltdowns}`
	);
	console.log(
		`  avg contracts ${average(results.map((result) => result.contracts)).toFixed(1)} · avg peak pressure ${average(
			results.map((result) => result.peak)
		).toFixed(0)} · avg sector ${average(results.map((result) => result.sector)).toFixed(1)}`
	);
}

const seeds = Array.from({ length: 40 }, (_, index) => index + 1);
report(
	'No unlocks (target 10–20% wins)',
	seeds.map((seed) => play(seed, []))
);
report(
	'All unlocks (target 30–50% wins)',
	seeds.map((seed) => play(seed, ALL_UNLOCKS))
);
