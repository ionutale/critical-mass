/** Deterministic spark and debris fields for the reactor overlay. */

export interface Particle {
	/** Normalized position and velocity, origin at the reactor centre. */
	x: number;
	y: number;
	vx: number;
	vy: number;
	size: number;
	life: number;
	/** Palette index: cyan, magenta, amber, lime. */
	hue: number;
}

function seeded(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) | 0;
		let t = Math.imul(state ^ (state >>> 15), 1 | state);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
	};
}

export function createParticles(seed: number, count: number): Particle[] {
	const random = seeded(seed);

	return Array.from({ length: Math.max(0, count) }, () => ({
		x: 0.5 + (random() - 0.5) * 0.18,
		y: 0.5 + (random() - 0.5) * 0.18,
		vx: (random() - 0.5) * 1.1,
		vy: (random() - 0.5) * 1.1 - 0.15,
		size: 0.8 + random() * 2.6,
		life: 0.45 + random() * 0.9,
		hue: Math.floor(random() * 4)
	}));
}
