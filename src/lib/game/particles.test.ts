import { describe, expect, it } from 'vitest';
import { createParticles } from './particles';

describe('particles', () => {
	it('is deterministic for a seed', () => {
		const a = createParticles(1234, 40);
		const b = createParticles(1234, 40);

		expect(a).toEqual(b);
		expect(a).toHaveLength(40);
	});

	it('changes with the seed', () => {
		const a = createParticles(1, 20);
		const b = createParticles(2, 20);

		expect(a).not.toEqual(b);
	});

	it('keeps every particle inside the field and alive for a while', () => {
		for (const particle of createParticles(99, 60)) {
			expect(particle.x).toBeGreaterThanOrEqual(0);
			expect(particle.x).toBeLessThanOrEqual(1);
			expect(particle.y).toBeGreaterThanOrEqual(0);
			expect(particle.y).toBeLessThanOrEqual(1);
			expect(particle.life).toBeGreaterThan(0);
			expect(particle.size).toBeGreaterThan(0);
		}
	});
});
