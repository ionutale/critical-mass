import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

describe('page', () => {
	it('renders the reactor', () => {
		render(Page);
		expect(screen.getByRole('heading', { name: /critical mass/i })).toBeInTheDocument();
		expect(screen.getByLabelText(/pressure 0 of 100/i)).toBeInTheDocument();
	});
});
