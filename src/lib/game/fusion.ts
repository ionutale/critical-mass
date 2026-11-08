import type { ElementRecord, RecipeRecord, RunState } from '../types';
import { chainReduction, fusionScale, heavyReduction } from './effects';
import { endTurn } from './turn';

export interface FusionStep {
	step: number;
	a: string;
	b: string;
	result: string;
	cell: number;
	pressure: number;
}

export interface PlacementPreview {
	steps: FusionStep[];
	grid: (string | null)[];
	pressureGain: number;
	pressureAfter: number;
	meltdown: boolean;
	saved: boolean;
}

function neighbors(cell: number): number[] {
	const row = Math.floor(cell / 5);
	const col = cell % 5;
	const result: number[] = [];
	if (row > 0) result.push(cell - 5);
	if (col < 4) result.push(cell + 1);
	if (row < 4) result.push(cell + 5);
	if (col > 0) result.push(cell - 1);
	return result;
}

function findRecipe(
	a: string,
	b: string,
	recipes: readonly RecipeRecord[],
	hasCatalyst: boolean
): RecipeRecord | null {
	const [left, right] = a <= b ? [a, b] : [b, a];
	return (
		recipes.find((recipe) => {
			if (recipe.catalyst && !hasCatalyst) return false;
			const [ra, rb] = recipe.a <= recipe.b ? [recipe.a, recipe.b] : [recipe.b, recipe.a];
			return ra === left && rb === right;
		}) ?? null
	);
}

export function previewPlacement(
	run: RunState,
	handIndex: number,
	cell: number,
	elements: readonly ElementRecord[],
	recipes: readonly RecipeRecord[]
): PlacementPreview | null {
	if (run.status !== 'active') return null;
	if (run.pendingDraft || run.pendingTransition) return null;
	if (cell < 0 || cell > 24 || run.grid[cell] !== null) return null;

	const placed = run.hand[handIndex];
	if (!placed) return null;

	const bySymbol = new Map(elements.map((element) => [element.symbol, element]));
	const grid = [...run.grid];
	grid[cell] = placed;
	const steps: FusionStep[] = [];
	let active = placed;
	const activeCell = cell;
	let pressureGain = 0;

	for (let index = 0; index < 24; index++) {
		let consumed: number | null = null;
		let result: string | null = null;

		for (const candidate of neighbors(activeCell)) {
			const other = grid[candidate];
			if (!other) continue;
			const recipe = findRecipe(active, other, recipes, run.hasCatalyst);
			if (!recipe) continue;
			consumed = candidate;
			result = recipe.result;
			break;
		}

		if (consumed === null || result === null) break;

		const resultElement = bySymbol.get(result);
		if (!resultElement) break;

		const heavyDiscount = resultElement.heavy ? heavyReduction(run) : 0;
		const basePressure =
			4 + resultElement.tier + 2 * index + (resultElement.heavy ? 8 : 0) - heavyDiscount;
		const chainDiscount = index === 0 ? 0 : Math.min(2 * index, chainReduction(run));
		const pressure = Math.max(
			1,
			Math.round(Math.max(1, basePressure - chainDiscount) * fusionScale(run))
		);
		steps.push({
			step: index + 1,
			a: active,
			b: grid[consumed]!,
			result,
			cell: consumed,
			pressure
		});
		pressureGain += pressure;
		grid[consumed] = null;
		grid[activeCell] = result;
		active = result;
	}

	const overCap = run.pressure + pressureGain >= run.pressureCap;
	const saved = overCap && run.meltdownSaves > 0;
	const pressureAfter = saved ? run.pressureCap - 1 : run.pressure + pressureGain;

	return {
		steps,
		grid,
		pressureGain,
		pressureAfter,
		meltdown: overCap && !saved,
		saved
	};
}

export function placeCard(
	run: RunState,
	handIndex: number,
	cell: number,
	elements: readonly ElementRecord[],
	recipes: readonly RecipeRecord[]
): RunState {
	const preview = previewPlacement(run, handIndex, cell, elements, recipes);
	if (!preview) return run;

	const card = run.hand[handIndex];
	const hand = run.hand.filter((_, index) => index !== handIndex);

	const meltdownSaves = preview.saved ? run.meltdownSaves - 1 : run.meltdownSaves;

	const next: RunState = {
		...run,
		grid: preview.grid,
		hand,
		discard: [...run.discard, card],
		pressure: preview.pressureAfter,
		maxChain: Math.max(run.maxChain, preview.steps.length),
		contractMaxChain: Math.max(run.contractMaxChain, preview.steps.length),
		meltdownSaves,
		status: preview.meltdown ? 'meltdown' : 'active'
	};

	return next.status === 'meltdown' ? next : endTurn(next);
}
