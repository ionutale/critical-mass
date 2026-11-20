import { describe, expect, it } from 'vitest';
import type { ElementSymbol } from '../types';
import { ELEMENTS, ELEMENT_BY_SYMBOL, elementAt, rarityOf } from './elements';

const TABLE: readonly {
	valence: 1 | 2 | 3 | 4;
	mass: 1 | 2 | 3;
	symbol: ElementSymbol;
	name: string;
}[] = [
	{ valence: 1, mass: 1, symbol: 'H', name: 'Hydrogen' },
	{ valence: 1, mass: 2, symbol: 'Li', name: 'Lithium' },
	{ valence: 1, mass: 3, symbol: 'Na', name: 'Sodium' },
	{ valence: 2, mass: 1, symbol: 'He', name: 'Helium' },
	{ valence: 2, mass: 2, symbol: 'Be', name: 'Beryllium' },
	{ valence: 2, mass: 3, symbol: 'Mg', name: 'Magnesium' },
	{ valence: 3, mass: 1, symbol: 'C', name: 'Carbon' },
	{ valence: 3, mass: 2, symbol: 'N', name: 'Nitrogen' },
	{ valence: 3, mass: 3, symbol: 'O', name: 'Oxygen' },
	{ valence: 4, mass: 1, symbol: 'Ne', name: 'Neon' },
	{ valence: 4, mass: 2, symbol: 'Si', name: 'Silicon' },
	{ valence: 4, mass: 3, symbol: 'Fe', name: 'Iron' }
];

describe('ELEMENTS', () => {
	it('has exactly 12 elements, one for every valence/mass pair', () => {
		expect(ELEMENTS).toHaveLength(12);

		for (const valence of [1, 2, 3, 4] as const) {
			for (const mass of [1, 2, 3] as const) {
				const matches = ELEMENTS.filter(
					(element) => element.valence === valence && element.mass === mass
				);
				expect(matches, `valence ${valence} / mass ${mass}`).toHaveLength(1);
			}
		}
	});

	it('matches the designed table', () => {
		for (const row of TABLE) {
			const element = elementAt(row.valence, row.mass);
			expect(element, `valence ${row.valence} / mass ${row.mass}`).toEqual({
				symbol: row.symbol,
				name: row.name,
				valence: row.valence,
				mass: row.mass
			});
		}
	});

	it('uses real light-element names', () => {
		for (const row of TABLE) {
			expect(ELEMENT_BY_SYMBOL.get(row.symbol)?.name).toBe(row.name);
		}
	});

	it('keeps every symbol unique', () => {
		const symbols = ELEMENTS.map((element) => element.symbol);
		expect(new Set(symbols).size).toBe(symbols.length);
		expect([...ELEMENT_BY_SYMBOL.keys()].sort()).toEqual([...symbols].sort());
	});
});

describe('elementAt', () => {
	it('finds Magnesium at valence 2 / mass 3', () => {
		expect(elementAt(2, 3)?.symbol).toBe('Mg');
	});

	it('finds Iron at valence 4 / mass 3', () => {
		expect(elementAt(4, 3)?.symbol).toBe('Fe');
	});

	it('returns undefined for pairs outside the table', () => {
		expect(elementAt(0, 1)).toBeUndefined();
		expect(elementAt(5, 1)).toBeUndefined();
		expect(elementAt(1, 0)).toBeUndefined();
		expect(elementAt(1, 4)).toBeUndefined();
	});
});

describe('rarityOf', () => {
	it('is valence multiplied by mass', () => {
		expect(rarityOf(elementAt(4, 3)!)).toBe(12);
		expect(rarityOf(elementAt(1, 1)!)).toBe(1);
		expect(rarityOf(elementAt(3, 2)!)).toBe(6);
	});

	it('yields the expected scored rarities', () => {
		const rarities = new Set(ELEMENTS.filter((element) => element.valence > 1).map(rarityOf));
		expect([...rarities].sort((a, b) => a - b)).toEqual([2, 3, 4, 6, 8, 9, 12]);
	});
});
