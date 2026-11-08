import type { RunState } from '../types';

export function createRun(seed: number): RunState {
	const grid: (string | null)[] = Array<string | null>(25).fill(null);
	grid[12] = 'H';

	return {
		seed,
		rngState: seed,
		grid,
		deck: [],
		hand: ['H', 'H', 'H', 'H', 'H'],
		discard: [],
		pressure: 0,
		pressureCap: 100,
		sectorFloor: 0,
		sector: 1,
		contractId: 's1-1a',
		delivered: 0,
		contractsCompleted: 0,
		turn: 1,
		scrapsUsed: 0,
		pendingDiscards: 0,
		modules: [],
		hasCatalyst: false,
		ventsThisContract: 0,
		maxChain: 0,
		deliveredTargets: [],
		pendingDraft: null,
		pendingTransition: false,
		status: 'active'
	};
}
