/** Procedural reactor cues. No files, no network, never throws. */

export type SoundCue = 'pick' | 'fusion' | 'vent' | 'contract' | 'meltdown' | 'victory';

type AudioFactory = () => AudioContext;

let muted = false;
let context: AudioContext | null = null;
let factory: AudioFactory = () => new AudioContext();

function release(): void {
	const current = context;
	context = null;
	if (!current) return;
	try {
		void current.close().catch(() => {});
	} catch {
		// Already gone.
	}
}

export function setSoundEnabled(enabled: boolean): void {
	muted = !enabled;
	if (muted) release();
}

export function setSoundContextFactory(next: AudioFactory): void {
	factory = next;
}

export function resetSound(): void {
	release();
	muted = false;
	factory = () => new AudioContext();
}

function tone(
	ctx: AudioContext,
	type: OscillatorType,
	frequency: number,
	start: number,
	duration: number,
	peak: number,
	endFrequency?: number
): void {
	const oscillator = ctx.createOscillator();
	const gain = ctx.createGain();
	oscillator.type = type;
	oscillator.frequency.setValueAtTime(frequency, start);
	if (endFrequency !== undefined) {
		oscillator.frequency.exponentialRampToValueAtTime(Math.max(endFrequency, 1), start + duration);
	}
	gain.gain.setValueAtTime(0.0001, start);
	gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), start + 0.015);
	gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
	oscillator.connect(gain);
	gain.connect(ctx.destination);
	oscillator.start(start);
	oscillator.stop(start + duration + 0.02);
}

function noise(ctx: AudioContext, start: number, duration: number, peak: number): void {
	const frames = Math.max(1, Math.floor(ctx.sampleRate * duration));
	const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
	const data = buffer.getChannelData(0);
	for (let index = 0; index < frames; index += 1) {
		data[index] = (Math.random() * 2 - 1) * (1 - index / frames);
	}
	const source = ctx.createBufferSource();
	const gain = ctx.createGain();
	source.buffer = buffer;
	gain.gain.setValueAtTime(peak, start);
	gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
	source.connect(gain);
	gain.connect(ctx.destination);
	source.start(start);
	source.stop(start + duration);
}

function render(ctx: AudioContext, cue: SoundCue): void {
	const now = ctx.currentTime;

	switch (cue) {
		case 'pick':
			tone(ctx, 'triangle', 540, now, 0.08, 0.04);
			break;
		case 'fusion':
			tone(ctx, 'sawtooth', 330, now, 0.18, 0.035, 660);
			tone(ctx, 'sine', 880, now + 0.05, 0.22, 0.03);
			noise(ctx, now, 0.12, 0.02);
			break;
		case 'vent':
			noise(ctx, now, 0.4, 0.06);
			tone(ctx, 'sine', 220, now, 0.35, 0.02, 90);
			break;
		case 'contract':
			tone(ctx, 'sine', 660, now, 0.2, 0.04);
			tone(ctx, 'sine', 990, now + 0.09, 0.28, 0.035);
			break;
		case 'meltdown':
			tone(ctx, 'sawtooth', 180, now, 0.8, 0.05, 55);
			noise(ctx, now, 0.7, 0.08);
			break;
		case 'victory':
			[523, 659, 784, 1046].forEach((frequency, index) => {
				tone(ctx, 'sine', frequency, now + index * 0.11, 0.5, 0.04);
			});
			break;
	}
}

/** Play one cue. Muted or unsupported audio is a silent no-op. */
export function playSound(cue: SoundCue): boolean {
	if (muted) return false;

	try {
		context ??= factory();
		if (!context) return false;
		if (context.state === 'suspended') void context.resume().catch(() => {});
		render(context, cue);
		return true;
	} catch {
		return false;
	}
}
