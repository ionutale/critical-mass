import type { MetaState, RunState, SaveState } from '../types';

export const emptyGrid = (): (string | null)[] => Array<string | null>(25).fill(null);

export function metaFixture(overrides: Partial<MetaState> = {}): MetaState {
	return {
		research: 0,
		unlocks: [],
		stats: { runs: 0, wins: 0, bestSector: 1, contracts: 0 },
		...overrides
	};
}

export function runFixture(overrides: Partial<RunState> = {}): RunState {
	return {
		seed: 42,
		rngState: 7,
		grid: emptyGrid(),
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
		pendingDraftKind: null,
		pendingTransition: false,
		patches: [],
		researchEarned: 0,
		contractMaxChain: 0,
		contractReduction: 0,
		meltdownSaves: 0,
		sectorShield: 0,
		status: 'active',
		...overrides
	};
}

export function saveFixture(overrides: Partial<SaveState> = {}): SaveState {
	return {
		version: 1,
		run: runFixture(),
		meta: metaFixture(),
		settings: { sound: true, reduceMotion: false },
		introSeen: true,
		...overrides
	};
}
