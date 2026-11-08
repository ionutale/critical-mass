import { CONTRACTS } from '../src/lib/data/contracts';
import { ELEMENTS } from '../src/lib/data/elements';
import { MODULES } from '../src/lib/data/modules';
import { RECIPES } from '../src/lib/data/recipes';
import { UNLOCKS } from '../src/lib/data/unlocks';
import { validateContent } from '../src/lib/game/validate';

const result = validateContent({
	elements: ELEMENTS,
	recipes: RECIPES,
	contracts: CONTRACTS,
	modules: MODULES,
	unlocks: UNLOCKS
});
console.log(
	`${ELEMENTS.length} elements, ${RECIPES.length} recipes, ${CONTRACTS.length} contracts, ${MODULES.length} modules, ${UNLOCKS.length} unlocks`
);

if (!result.ok) {
	for (const error of result.errors) console.error(`- ${error}`);
	process.exit(1);
}

console.log('Content OK');
