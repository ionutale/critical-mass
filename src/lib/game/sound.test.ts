import { beforeEach, describe, expect, it } from 'vitest';
import { playSound, resetSound, setSoundContextFactory, setSoundEnabled } from './sound';

interface FakeCalls {
	oscillators: number;
	gains: number;
	buffers: number;
	sources: number;
	resumed: number;
	closed: number;
}

function fakeAudio(state: AudioContext['state'] = 'running') {
	const calls: FakeCalls = {
		oscillators: 0,
		gains: 0,
		buffers: 0,
		sources: 0,
		resumed: 0,
		closed: 0
	};
	const connectable = () => {
		const node = {
			connect: () => node,
			disconnect: () => {},
			start: () => {},
			stop: () => {}
		};
		return node;
	};
	const context = {
		currentTime: 0,
		state,
		sampleRate: 44_100,
		destination: {},
		createOscillator: () => {
			calls.oscillators += 1;
			return {
				...connectable(),
				type: 'sine',
				frequency: {
					value: 0,
					setValueAtTime: () => {},
					exponentialRampToValueAtTime: () => {}
				}
			};
		},
		createGain: () => {
			calls.gains += 1;
			return {
				...connectable(),
				gain: {
					value: 0,
					setValueAtTime: () => {},
					linearRampToValueAtTime: () => {},
					exponentialRampToValueAtTime: () => {}
				}
			};
		},
		createBuffer: (_channels: number, length: number) => {
			calls.buffers += 1;
			return { getChannelData: () => new Float32Array(length), sampleRate: 44_100 };
		},
		createBufferSource: () => {
			calls.sources += 1;
			return { ...connectable(), buffer: null };
		},
		resume: async () => {
			calls.resumed += 1;
		},
		close: async () => {
			calls.closed += 1;
		}
	} as unknown as AudioContext;

	return { context, calls };
}

beforeEach(() => resetSound());

describe('reactor sound', () => {
	it('does not build a context while muted', () => {
		let built = 0;
		setSoundContextFactory(() => {
			built += 1;
			return fakeAudio().context;
		});
		setSoundEnabled(false);

		expect(playSound('fusion')).toBe(false);
		expect(built).toBe(0);
	});

	it('plays every cue through one context', () => {
		const { context, calls } = fakeAudio();
		let built = 0;
		setSoundContextFactory(() => {
			built += 1;
			return context;
		});
		setSoundEnabled(true);

		for (const cue of ['pick', 'fusion', 'vent', 'contract', 'meltdown', 'victory'] as const) {
			expect(playSound(cue)).toBe(true);
		}

		expect(built).toBe(1);
		expect(calls.oscillators).toBeGreaterThan(0);
		expect(calls.gains).toBeGreaterThan(0);
	});

	it('resumes a suspended context', () => {
		const { context, calls } = fakeAudio('suspended');
		setSoundContextFactory(() => context);
		setSoundEnabled(true);

		playSound('pick');

		expect(calls.resumed).toBe(1);
	});

	it('never throws when the browser has no audio', () => {
		setSoundContextFactory(() => {
			throw new Error('no audio');
		});
		setSoundEnabled(true);

		expect(() => playSound('victory')).not.toThrow();
		expect(playSound('victory')).toBe(false);
	});

	it('closes the context when muted', () => {
		const { context, calls } = fakeAudio();
		setSoundContextFactory(() => context);
		setSoundEnabled(true);
		playSound('fusion');

		setSoundEnabled(false);

		expect(calls.closed).toBe(1);
	});
});
