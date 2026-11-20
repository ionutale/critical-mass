import type { ElementSymbol } from '../../types';

/**
 * The minimal engine input the arcade fusion rules need.
 *
 * Task 3's `RunState` structurally extends this interface, so the fusion engine
 * never depends on fields it does not read (deck, score, status, …).
 */
export interface FusionState {
	grid: (ElementSymbol | null)[];
	hand: ElementSymbol[];
	heat: number;
	heatCap: number;
	turn: number;
	upgrades: string[];
	/** True once this turn's Heat Sink has absorbed the first Fusion. Optional for minimal fixtures. */
	heatSinkUsed?: boolean;
}
