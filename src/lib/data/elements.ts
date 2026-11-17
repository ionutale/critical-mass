import type { ElementRecord } from '../types';

function el(
	symbol: string,
	name: string,
	number: number,
	tier: number,
	heavy = false
): ElementRecord {
	return { symbol, name, number, tier, heavy };
}

export const ELEMENTS: readonly ElementRecord[] = [
	el('H', 'Hydrogen', 1, 0),
	el('He', 'Helium', 2, 1),
	el('Be', 'Beryllium', 4, 2),
	el('B', 'Boron', 5, 2.5),
	el('C', 'Carbon', 6, 3),
	el('N', 'Nitrogen', 7, 4),
	el('O', 'Oxygen', 8, 5),
	el('F', 'Fluorine', 9, 5.5),
	el('Ne', 'Neon', 10, 6),
	el('Mg', 'Magnesium', 12, 7),
	el('Si', 'Silicon', 14, 8),
	el('P', 'Phosphorus', 15, 8.5),
	el('S', 'Sulfur', 16, 9),
	el('Ar', 'Argon', 18, 10),
	el('Ca', 'Calcium', 20, 11),
	el('Ti', 'Titanium', 22, 12),
	el('Cr', 'Chromium', 24, 13),
	el('Fe', 'Iron', 26, 14),
	el('Co', 'Cobalt', 27, 15, true),
	el('Ni', 'Nickel', 28, 16, true),
	el('Cu', 'Copper', 29, 17, true),
	el('Zn', 'Zinc', 30, 18, true),
	el('Ag', 'Silver', 47, 19, true),
	el('Au', 'Gold', 79, 20, true),
	el('Hg', 'Mercury', 80, 21, true),
	el('Pb', 'Lead', 82, 22, true),
	el('U', 'Uranium', 92, 23, true),
	el('Np', 'Neptunium', 93, 24, true),
	el('Pu', 'Plutonium', 94, 25, true),
	el('Am', 'Americium', 95, 26, true)
];

export const ELEMENT_BY_SYMBOL = new Map(ELEMENTS.map((element) => [element.symbol, element]));
