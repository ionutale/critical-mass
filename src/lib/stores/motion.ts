import { derived, readable } from 'svelte/store';
import { save } from './game';

function prefersReducedMotion(): boolean {
	if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const systemReducedMotion = readable(prefersReducedMotion(), (set) => {
	if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

	const query = window.matchMedia('(prefers-reduced-motion: reduce)');
	const onChange = (event: MediaQueryListEvent) => set(event.matches);
	query.addEventListener?.('change', onChange);

	return () => query.removeEventListener?.('change', onChange);
});

export const reducedMotion = derived(
	[save, systemReducedMotion],
	([$save, $system]) => $save.settings.reduceMotion || $system
);
