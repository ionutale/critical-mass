import type { RecipeRecord } from '../types';

function recipe(a: string, b: string, result: string, catalyst = false): RecipeRecord {
	return { a, b, result, catalyst };
}

export const RECIPES: readonly RecipeRecord[] = [
	recipe('H', 'H', 'He'),
	recipe('He', 'He', 'Be'),
	recipe('Be', 'He', 'C'),
	recipe('C', 'H', 'N'),
	recipe('N', 'H', 'O'),
	recipe('C', 'He', 'O'),
	recipe('O', 'He', 'Ne'),
	recipe('Ne', 'He', 'Mg'),
	recipe('Mg', 'He', 'Si'),
	recipe('Si', 'He', 'S'),
	recipe('S', 'He', 'Ar'),
	recipe('Ar', 'He', 'Ca'),
	recipe('Ca', 'He', 'Ti'),
	recipe('Ti', 'He', 'Cr'),
	recipe('Cr', 'He', 'Fe'),
	recipe('Fe', 'He', 'Co', true),
	recipe('Co', 'He', 'Ni', true),
	recipe('Ni', 'He', 'Cu', true),
	recipe('Cu', 'He', 'Zn', true),
	recipe('Zn', 'He', 'Ag', true),
	recipe('Ag', 'He', 'Au', true),
	recipe('Au', 'He', 'Hg', true),
	recipe('Hg', 'He', 'Pb', true),
	recipe('Pb', 'He', 'U', true),
	// Side branches: each new pair gives a placed tile an extra fusable neighbor.
	recipe('H', 'Be', 'B'),
	recipe('B', 'He', 'N'),
	recipe('C', 'N', 'F'),
	recipe('F', 'He', 'Ne'),
	recipe('N', 'O', 'Ne'),
	recipe('Si', 'C', 'P'),
	recipe('P', 'He', 'S'),
	recipe('Pb', 'U', 'Np', true),
	recipe('U', 'He', 'Np', true),
	recipe('U', 'Np', 'Pu', true),
	recipe('Np', 'He', 'Pu', true),
	recipe('Pu', 'He', 'Am', true)
];
