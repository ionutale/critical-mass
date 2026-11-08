export interface ElementRecord {
	symbol: string;
	name: string;
	number: number;
	tier: number;
	heavy: boolean;
}

export interface RecipeRecord {
	a: string;
	b: string;
	result: string;
	catalyst: boolean;
}

export type Modifier = 'one-chain' | 'no-vent' | 'pressure-50' | 'two-targets';

export interface ContractTemplate {
	id: string;
	sector: 1 | 2 | 3;
	slot: 1 | 2 | 3 | 4 | 5;
	target: string;
	count: number;
	modifier: Modifier | null;
	brief: string;
}

export type ModuleEffect =
	| 'vent+5'
	| 'cap+10'
	| 'fusion-10'
	| 'hand+1'
	| 'draw+1'
	| 'add-he-2'
	| 'duplicate-card'
	| 'catalyst'
	| 'neutron'
	| 'chain-bonus-2'
	| 'delivery+1'
	| 'reroll'
	| 'count-1'
	| 'draft+1'
	| 'meltdown-save'
	| 'sector-shield';

export interface ModuleRecord {
	id: string;
	name: string;
	description: string;
	effect: ModuleEffect;
}

export interface UnlockRecord {
	id: string;
	name: string;
	description: string;
	cost: number;
	kind: 'card' | 'module' | 'contract';
	ref: string;
}

export type DraftOption =
	| { kind: 'cards'; element: string; count: 2 }
	| { kind: 'module'; moduleId: string }
	| { kind: 'patch'; patchId: string };

export type RunStatus = 'active' | 'meltdown' | 'victory';

export interface RunState {
	seed: number;
	rngState: number;
	grid: (string | null)[];
	deck: string[];
	hand: string[];
	discard: string[];
	pressure: number;
	pressureCap: number;
	sectorFloor: number;
	sector: 1 | 2 | 3;
	contractId: string;
	delivered: number;
	contractsCompleted: number;
	turn: number;
	scrapsUsed: number;
	pendingDiscards: number;
	modules: string[];
	hasCatalyst: boolean;
	ventsThisContract: number;
	maxChain: number;
	deliveredTargets: string[];
	pendingDraft: DraftOption[] | null;
	pendingTransition: boolean;
	status: RunStatus;
}

export interface MetaState {
	research: number;
	unlocks: string[];
	stats: { runs: number; wins: number; bestSector: number; contracts: number };
}

export interface SaveState {
	version: 1;
	run: RunState | null;
	meta: MetaState;
	settings: { sound: boolean; reduceMotion: boolean };
	introSeen: boolean;
}
