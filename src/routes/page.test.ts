import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it } from 'vitest';
import Page from './+page.svelte';

beforeEach(() => {
	window.localStorage.clear();
});

describe('page', () => {
	it('opens the title and continues into the reactor', async () => {
		render(Page);

		expect(screen.getByRole('heading', { name: /critical mass/i })).toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: /continue run/i }));

		expect(screen.getByLabelText(/pressure 0 of 100/i)).toBeInTheDocument();
	});
});
