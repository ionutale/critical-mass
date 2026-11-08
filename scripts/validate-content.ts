import { CONTRACTS } from '../src/lib/data/contracts';
import { ELEMENTS } from '../src/lib/data/elements';
import { RECIPES } from '../src/lib/data/recipes';
import { validateContent } from '../src/lib/game/validate';

const result = validateContent({ elements: ELEMENTS, recipes: RECIPES, contracts: CONTRACTS });
console.log(
	`${ELEMENTS.length} elements, ${RECIPES.length} recipes, ${CONTRACTS.length} contracts`
);

if (!result.ok) {
	for (const error of result.errors) console.error(`- ${error}`);
	process.exit(1);
}

console.log('Content OK');
