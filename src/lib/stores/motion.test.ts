import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initGame } from './game';
import { reducedMotion } from './motion';

beforeEach(() => {
	window.localStorage.clear();
});

describe('motion', () => {
	it('follows the reduce-motion setting', () => {
		initGame({ settings: { sound: true, reduceMotion: true } });
		expect(get(reducedMotion)).toBe(true);

		initGame({ settings: { sound: true, reduceMotion: false } });
		expect(get(reducedMotion)).toBe(false);
	});

	it('reacts when the operating system changes its preference', async () => {
		const listeners: ((event: MediaQueryListEvent) => void)[] = [];
		const query = {
			matches: false,
			addEventListener: vi.fn((_: 'change', listener: (event: MediaQueryListEvent) => void) => {
				listeners.push(listener);
			}),
			removeEventListener: vi.fn()
		} as unknown as MediaQueryList;

		vi.stubGlobal(
			'matchMedia',
			vi.fn(() => query)
		);
		vi.resetModules();

		const motion = await import('./motion');
		const stores = await import('./game');
		stores.initGame({ settings: { sound: true, reduceMotion: false }, introSeen: true });

		expect(get(motion.reducedMotion)).toBe(false);
		expect(query.addEventListener).toHaveBeenCalled();

		(query as { matches: boolean }).matches = true;
		for (const listener of listeners) listener({ matches: true } as MediaQueryListEvent);

		expect(get(motion.reducedMotion)).toBe(true);

		vi.unstubAllGlobals();
	});
});
