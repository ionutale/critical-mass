import type { ContractTemplate, ElementRecord, RecipeRecord } from '../types';

export interface ValidationResult {
	ok: boolean;
	errors: string[];
}

function closure(
	elements: readonly ElementRecord[],
	recipes: readonly RecipeRecord[],
	allowCatalyst: boolean
): Set<string> {
	const known = new Set(elements.map((element) => element.symbol));
	const reachable = new Set<string>(known.has('H') ? ['H'] : []);

	let changed = true;
	while (changed) {
		changed = false;
		for (const recipe of recipes) {
			if (recipe.catalyst && !allowCatalyst) continue;
			if (reachable.has(recipe.a) && reachable.has(recipe.b) && known.has(recipe.result)) {
				if (!reachable.has(recipe.result)) {
					reachable.add(recipe.result);
					changed = true;
				}
			}
		}
	}

	return reachable;
}

export function validateContent(content: {
	elements: readonly ElementRecord[];
	recipes: readonly RecipeRecord[];
	contracts: readonly ContractTemplate[];
}): ValidationResult {
	const errors: string[] = [];
	const symbols = new Set<string>();
	const numbers = new Set<number>();

	for (const element of content.elements) {
		if (symbols.has(element.symbol)) errors.push(`Duplicate symbol ${element.symbol}.`);
		symbols.add(element.symbol);
		if (numbers.has(element.number)) errors.push(`Duplicate atomic number ${element.number}.`);
		numbers.add(element.number);
	}

	if (!symbols.has('H')) errors.push('Hydrogen is missing.');

	for (const recipe of content.recipes) {
		if (!symbols.has(recipe.a) || !symbols.has(recipe.b)) {
			errors.push(`Recipe ${recipe.a}+${recipe.b} uses an unknown element.`);
			continue;
		}
		if (!symbols.has(recipe.result)) {
			errors.push(`Recipe ${recipe.a}+${recipe.b} produces an unknown element.`);
			continue;
		}

		const result = content.elements.find((element) => element.symbol === recipe.result)!;
		const a = content.elements.find((element) => element.symbol === recipe.a)!;
		const b = content.elements.find((element) => element.symbol === recipe.b)!;
		if (result.number <= a.number || result.number <= b.number) {
			errors.push(`Recipe ${recipe.a}+${recipe.b} produces a lighter element.`);
		}
	}

	const withoutCatalyst = closure(content.elements, content.recipes, false);
	for (const element of content.elements) {
		if (!element.heavy && !withoutCatalyst.has(element.symbol)) {
			errors.push(`${element.symbol} is unreachable without a catalyst.`);
		}
	}

	const withCatalyst = closure(content.elements, content.recipes, true);
	for (const contract of content.contracts) {
		if (!symbols.has(contract.target)) {
			errors.push(`Contract ${contract.id} targets an unknown element.`);
		} else if (!withCatalyst.has(contract.target)) {
			errors.push(`Contract ${contract.id} targets an unreachable element.`);
		}
	}

	return { ok: errors.length === 0, errors };
}
