import type {
	ContractTemplate,
	ElementRecord,
	ModuleRecord,
	RecipeRecord,
	UnlockRecord
} from '../types';

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
	modules?: readonly ModuleRecord[];
	unlocks?: readonly UnlockRecord[];
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
	const elementBySymbol = new Map(content.elements.map((element) => [element.symbol, element]));
	const seenContracts = new Set<string>();

	for (const contract of content.contracts) {
		if (seenContracts.has(contract.id)) errors.push(`Duplicate contract id ${contract.id}.`);
		seenContracts.add(contract.id);

		if (contract.count < 1 || contract.count > 3) {
			errors.push(`Contract ${contract.id} has an invalid count.`);
		}

		const target = elementBySymbol.get(contract.target);
		if (!target) {
			errors.push(`Contract ${contract.id} targets an unknown element.`);
			continue;
		}

		const reachable = contract.sector === 3 ? withCatalyst : withoutCatalyst;
		if (!reachable.has(contract.target)) {
			errors.push(`Contract ${contract.id} targets an unreachable element.`);
		}

		if (contract.sector === 1 && (target.heavy || target.tier > 7)) {
			errors.push(`Contract ${contract.id} targets an element beyond sector 1.`);
		}
		if (contract.sector === 2 && (target.heavy || target.tier > 14)) {
			errors.push(`Contract ${contract.id} targets an element beyond sector 2.`);
		}
		if (contract.sector === 3 && !target.heavy) {
			errors.push(`Contract ${contract.id} does not target a heavy element.`);
		}

		if (contract.slot === 5) {
			const boss = contract.sector === 1 ? 'Mg' : contract.sector === 2 ? 'Fe' : 'U';
			if (contract.target !== boss) {
				errors.push(`Contract ${contract.id} is not the ${boss} sector boss.`);
			}
		}
	}

	for (const sector of [1, 2, 3] as const) {
		const inSector = content.contracts.filter((contract) => contract.sector === sector);
		if (inSector.length !== 10) {
			errors.push(`Sector ${sector} has ${inSector.length} contracts instead of 10.`);
		}
		for (const slot of [1, 2, 3, 4, 5] as const) {
			const variants = inSector.filter((contract) => contract.slot === slot);
			if (variants.length !== 2) {
				errors.push(`Sector ${sector} slot ${slot} has ${variants.length} variants instead of 2.`);
			}
		}
	}

	const modules = content.modules ?? [];
	const moduleIds = new Set<string>();
	for (const module of modules) {
		if (moduleIds.has(module.id)) errors.push(`Duplicate module id ${module.id}.`);
		moduleIds.add(module.id);
		if (!module.name.trim()) errors.push(`Module ${module.id} has no name.`);
		if (!module.description.trim()) errors.push(`Module ${module.id} has no description.`);
	}
	if (content.modules && modules.length !== 24) {
		errors.push(`Expected 24 modules, found ${modules.length}.`);
	}

	const unlocks = content.unlocks ?? [];
	const unlockIds = new Set<string>();
	for (const unlock of unlocks) {
		if (unlockIds.has(unlock.id)) errors.push(`Duplicate unlock id ${unlock.id}.`);
		unlockIds.add(unlock.id);

		if (!['card', 'module', 'contract'].includes(unlock.kind)) {
			errors.push(`Unlock ${unlock.id} has an unknown kind.`);
		}
		if (!Number.isInteger(unlock.cost) || unlock.cost < 3 || unlock.cost > 12) {
			errors.push(`Unlock ${unlock.id} has an out-of-range research cost.`);
		}
		if (unlock.kind === 'card') {
			if (!symbols.has(unlock.ref)) {
				errors.push(`Unlock ${unlock.id} references an unknown card ${unlock.ref}.`);
			}
		} else if (!moduleIds.has(unlock.ref)) {
			errors.push(`Unlock ${unlock.id} references an unknown module ${unlock.ref}.`);
		}
	}
	if (content.unlocks && unlocks.length !== 12) {
		errors.push(`Expected 12 unlocks, found ${unlocks.length}.`);
	}

	return { ok: errors.length === 0, errors };
}
