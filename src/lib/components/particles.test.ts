import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import ParticleField from './ParticleField.svelte';

describe('particle field', () => {
	it('renders a canvas when motion is allowed', () => {
		const { container } = render(ParticleField, { props: { seed: 7, reducedMotion: false } });

		expect(container.querySelector('canvas')).not.toBeNull();
	});

	it('renders nothing under reduced motion', () => {
		const { container } = render(ParticleField, { props: { seed: 7, reducedMotion: true } });

		expect(container.querySelector('canvas')).toBeNull();
	});
});
