import type { ElementRecord, RecipeRecord, RunState } from '../types';

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

		const pressure = 4 + resultElement.tier + 2 * index + (resultElement.heavy ? 8 : 0);
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

	const pressureAfter = run.pressure + pressureGain;
	return {
		steps,
		grid,
		pressureGain,
		pressureAfter,
		meltdown: pressureAfter >= run.pressureCap
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

	return {
		...run,
		grid: preview.grid,
		hand,
		discard: [...run.discard, card],
		pressure: preview.pressureAfter,
		turn: run.turn + 1,
		maxChain: Math.max(run.maxChain, preview.steps.length),
		status: preview.meltdown ? 'meltdown' : 'active'
	};
}
