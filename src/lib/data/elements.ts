import type { ElementRecord, ElementSymbol, Mass, Valence } from '../types';

/**
 * The 12 real light elements: exactly one for every (valence, mass) pair.
 * These are game properties, not chemical claims.
 *
 * | Valence | Mass 1 | Mass 2 | Mass 3 |
 * |---|---|---|---|
 * | 1 | H | Li | Na |
 * | 2 | He | Be | Mg |
 * | 3 | C | N | O |
 * | 4 | Ne | Si | Fe |
 */
function el(symbol: ElementSymbol, name: string, valence: Valence, mass: Mass): ElementRecord {
	return { symbol, name, valence, mass };
}

export const ELEMENTS: readonly ElementRecord[] = [
	el('H', 'Hydrogen', 1, 1),
	el('Li', 'Lithium', 1, 2),
	el('Na', 'Sodium', 1, 3),
	el('He', 'Helium', 2, 1),
	el('Be', 'Beryllium', 2, 2),
	el('Mg', 'Magnesium', 2, 3),
	el('C', 'Carbon', 3, 1),
	el('N', 'Nitrogen', 3, 2),
	el('O', 'Oxygen', 3, 3),
	el('Ne', 'Neon', 4, 1),
	el('Si', 'Silicon', 4, 2),
	el('Fe', 'Iron', 4, 3)
];

export const ELEMENT_BY_SYMBOL: ReadonlyMap<ElementSymbol, ElementRecord> = new Map(
	ELEMENTS.map((element) => [element.symbol, element])
);

/** The element at a (valence, mass) pair, or undefined when out of range. */
export function elementAt(valence: number, mass: number): ElementRecord | undefined {
	return ELEMENTS.find((element) => element.valence === valence && element.mass === mass);
}

/** Rarity = valence × mass tier (1–12). */
export function rarityOf(element: ElementRecord): number {
	return element.valence * element.mass;
}
