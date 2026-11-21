/** Element valence: 1–4; governs whether and how an Element fuses. */
export type Valence = 1 | 2 | 3 | 4;

/** Element mass tier: 1–3; sets a result's Rarity and score. */
export type Mass = 1 | 2 | 3;

/** The 12 real light elements used by the valence table. */
export type ElementSymbol =
	'H' | 'Li' | 'Na' | 'He' | 'Be' | 'Mg' | 'C' | 'N' | 'O' | 'Ne' | 'Si' | 'Fe';

export interface ElementRecord {
	symbol: ElementSymbol;
	name: string;
	valence: Valence;
	mass: Mass;
}
