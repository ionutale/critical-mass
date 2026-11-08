export interface RngStep {
	value: number;
	state: number;
}

export function nextRandom(state: number): RngStep {
	const next = (state + 0x6d2b79f5) | 0;
	let value = Math.imul(next ^ (next >>> 15), 1 | next);
	value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
	return {
		value: ((value ^ (value >>> 14)) >>> 0) / 4294967296,
		state: next
	};
}

export function pickIndex(state: number, length: number): { index: number; state: number } {
	if (length <= 0) return { index: 0, state };
	const step = nextRandom(state);
	return {
		index: Math.floor(step.value * length),
		state: step.state
	};
}

export function shuffleWithState<T>(
	items: readonly T[],
	state: number
): { items: T[]; state: number } {
	const shuffled = [...items];
	let current = state;

	for (let index = shuffled.length - 1; index > 0; index--) {
		const step = nextRandom(current);
		current = step.state;
		const swap = Math.floor(step.value * (index + 1));
		[shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
	}

	return { items: shuffled, state: current };
}
