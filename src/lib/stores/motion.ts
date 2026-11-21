import { derived, readable } from 'svelte/store';
import { save as arcadeSave } from './arcade';
import { save as legacySave } from './game';

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

/**
 * Reduced motion if the player asked for it in either save store or the OS
 * asked for it. The arcade save is the live one; the legacy save is read too
 * while the retiring screens still share this store (removed in Task 13).
 */
export const reducedMotion = derived(
	[arcadeSave, legacySave, systemReducedMotion],
	([$arcade, $legacy, $system]) =>
		$arcade.settings.reduceMotion || $legacy.settings.reduceMotion || $system
);

// Svelte's transitions are driven by the Web Animations API. Without it the
// element cannot be animated, so every duration collapses to 0.
const canAnimate =
	typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function';

/**
 * Duration for a Svelte transition. Returns 0 when the user asked for reduced
 * motion (setting or OS preference) or when the environment cannot animate, so
 * both motion switches disable the motion.
 */
export function transitionDuration(reduced: boolean, base: number): number {
	return reduced || !canAnimate ? 0 : base;
}
