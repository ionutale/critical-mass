/** Element valence: 1–4; governs whether and how an Element fuses. */
export type Valence = 1 | 2 | 3 | 4;

/** Element mass tier: 1–3; sets a result's Rarity and score. */
export type Mass = 1 | 2 | 3;

/** The 12 real light elements used by the valence table. */
export type ElementSymbol =
	'H' | 'Li' | 'Na' | 'He' | 'Be' | 'Mg' | 'C' | 'N' | 'O' | 'Ne' | 'Si' | 'Fe';

export interface ElementRecord {
	symbol: ElementSymbol;
	name: string;
	valence: Valence;
	mass: Mass;
}

/**
 * @deprecated Interim shape for the retiring roguelike engine (recipes, contracts,
 * validation). Kept only so the old game keeps compiling until Tasks 2–4 and 13
 * replace it. Do not use in new code.
 */
export interface LegacyElementRecord {
	symbol: string;
	name: string;
	number: number;
	tier: number;
	heavy: boolean;
}

// ---------------------------------------------------------------------------
// Retiring roguelike types (contracts, sectors, modules, patches). Kept until
// the engine and UI are replaced; see the mechanics redesign plan, Task 13.
// ---------------------------------------------------------------------------

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

export interface PatchRecord {
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
	pendingDraftKind: 'contract' | 'sector' | null;
	pendingTransition: boolean;
	patches: string[];
	researchEarned: number;
	contractMaxChain: number;
	contractReduction: number;
	meltdownSaves: number;
	sectorShield: number;
	status: RunStatus;
}

export interface MetaState {
	research: number;
	unlocks: string[];
	stats: { runs: number; wins: number; bestSector: number; contracts: number };
}

export interface Settings {
	sound: boolean;
	reduceMotion: boolean;
}

/**
 * Save schema v2. Task 7 performs the v1 → v2 migration: existing runs reset,
 * settings and meta unlocks persist. `run` still uses the retiring run shape
 * until Task 3/7 replace it.
 */
export interface SaveState {
	version: 2;
	run: RunState | null;
	meta: MetaState;
	settings: Settings;
	introSeen: boolean;
}
