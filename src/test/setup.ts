import '@testing-library/jest-dom/vitest';

// jsdom does not implement the Web Animations API. Svelte's `animate:` directives
// call `Element#getAnimations()` to detect in-flight animations when a keyed block
// loses a node, so provide the empty result jsdom would have if nothing animated.
if (typeof Element !== 'undefined' && typeof Element.prototype.getAnimations !== 'function') {
	Element.prototype.getAnimations = () => [];
}

class MemoryStorage implements Storage {
	private readonly map = new Map<string, string>();

	get length(): number {
		return this.map.size;
	}

	clear(): void {
		this.map.clear();
	}

	getItem(key: string): string | null {
		return this.map.get(key) ?? null;
	}

	key(index: number): string | null {
		return [...this.map.keys()][index] ?? null;
	}

	removeItem(key: string): void {
		this.map.delete(key);
	}

	setItem(key: string, value: string): void {
		this.map.set(key, value);
	}
}

if (typeof window !== 'undefined' && !window.localStorage) {
	const storage = new MemoryStorage();
	Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
	Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
}
