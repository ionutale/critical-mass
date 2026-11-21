import type { FusionStep } from '../../game/arcade/fusion';
import type { ElementSymbol } from '../../types';

/**
 * Motion primitives for the arcade choreography.
 *
 * Every helper is a no-op (or applies its final value instantly) when the
 * caller passes `reducedMotion`, or when the environment has no Web Animations
 * API. Callers can therefore run the same code path everywhere; motion never
 * changes the committed state. All animations use `transform`/`opacity` only,
 * so they stay on the compositor and never move the board.
 */

/** A rectangle captured before the store commits. */
export interface Box {
	left: number;
	top: number;
	width: number;
	height: number;
}

export interface MotionOptions {
	/** Collapse the move to its final state. */
	reducedMotion?: boolean;
	duration?: number;
	delay?: number;
	easing?: string;
}

export interface MergeOptions extends MotionOptions {
	/** Delay between successive ghosts, in milliseconds. */
	stagger?: number;
}

/** A handle that stops an in-flight animation. */
export interface MotionHandle {
	cancel(): void;
}

/** True when the environment can animate and the user has not opted out. */
export function animationsAvailable(): boolean {
	return typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function';
}

function enabled(options: MotionOptions): boolean {
	return !options.reducedMotion && animationsAvailable();
}

/** One board cell's ghost, captured from the pre-commit DOM. */
export interface GhostSpec {
	cell: number;
	/** 0-based chain step that consumed this cell, or `result` for the survivor. */
	step: number | 'result';
	symbol: ElementSymbol;
	box: Box | null;
	surviving: boolean;
}

/**
 * Everything the playback layer needs about a placement. Captured before
 * `place()` because the store commits immediately and the consumed tiles and
 * hand card disappear from the board.
 */
export interface PlaybackModel {
	id: number;
	originCell: number;
	card: ElementSymbol;
	steps: readonly FusionStep[];
	ghosts: readonly GhostSpec[];
	/** Where the placed card left the hand, relative to the board stage. */
	flight: Box | null;
	/** Where the spent card lands (the discard counter). */
	discard: Box | null;
	/** Where the gained points float from. */
	score: Box | null;
	scoreFrom: number;
	scoreTo: number;
	heatFrom: number;
	heatTo: number;
	/** Hand cards that survive the placement; later indices were dealt in. */
	keptHand: number;
	overload: boolean;
}

/** The DOM nodes the playback reads; all optional so SSR and tests are safe. */
export interface ChoreographyRefs {
	stage: HTMLElement | null;
	hand: HTMLElement | null;
	heat: HTMLElement | null;
	score: HTMLElement | null;
	discard: HTMLElement | null;
}

function isElement(value: unknown): value is Element {
	return typeof Element !== 'undefined' && value instanceof Element;
}

/** Snapshot an element's viewport rectangle, or null when it is not mounted. */
export function boxOf(element: Element | null | undefined): Box | null {
	if (!element) return null;
	const rect = element.getBoundingClientRect();
	return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

function boxOfTarget(target: Element | Box): Box {
	if (isElement(target)) {
		return boxOf(target) ?? { left: 0, top: 0, width: 0, height: 0 };
	}
	return target;
}

/** Rebase a viewport box onto an ancestor's box, so ghosts scroll with the board. */
function relativeTo(box: Box | null, origin: Box | null): Box | null {
	if (!box || !origin) return box;
	return {
		left: box.left - origin.left,
		top: box.top - origin.top,
		width: box.width,
		height: box.height
	};
}

function applyOpacity(element: Element, opacity: string): void {
	if ('style' in element) {
		(element as HTMLElement).style.opacity = opacity;
	}
}

/**
 * Fly an element (usually a proxy rendered at the source) to another element.
 * The proxy ends at the target's centre, scaled to its size and faded out.
 */
export function flight(from: Element, to: Element, options: MotionOptions = {}): Animation | null {
	if (!enabled(options)) return null;

	const source = from.getBoundingClientRect();
	const target = to.getBoundingClientRect();
	const dx = target.left + target.width / 2 - (source.left + source.width / 2);
	const dy = target.top + target.height / 2 - (source.top + source.height / 2);
	const scale =
		source.width > 0 && target.width > 0 ? Math.min(1.4, target.width / source.width) : 0.9;

	const animation = from.animate(
		[
			{ transform: 'translate(0, 0) scale(1)', opacity: 1 },
			{ transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0.9, offset: 0.8 },
			{ transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0 }
		],
		{
			duration: options.duration ?? 200,
			delay: options.delay ?? 0,
			easing: options.easing ?? 'cubic-bezier(0.3, 0.7, 0.3, 1)',
			fill: 'both'
		}
	);

	return animation;
}

export interface ProxyOptions extends MotionOptions {
	/** The symbol drawn on the temporary element. */
	symbol: string;
	/** Where the element starts, captured before the store commits. */
	from: Box | null;
	/** The element it flies into (the discard counter). */
	to: Element | null;
	/** Extra class for the proxy; defaults to the discard chip. */
	className?: string;
}

/**
 * Fly a temporary chip from a captured rectangle into a live element. Used for
 * discards, which have no board cell to land on. The chip is appended to the
 * body and removed when the flight finishes, is cancelled, or cannot animate.
 */
export function flyProxy(options: ProxyOptions): Animation | null {
	if (!options.from || !options.to || typeof document === 'undefined') return null;
	if (!enabled(options)) return null;

	const proxy = document.createElement('span');
	proxy.className = options.className ?? 'discard-ghost';
	proxy.textContent = options.symbol;
	proxy.setAttribute('aria-hidden', 'true');
	proxy.style.cssText = `position: fixed; left: ${options.from.left}px; top: ${options.from.top}px;`;
	document.body.appendChild(proxy);

	const animation = flight(proxy, options.to, options);
	if (!animation) {
		proxy.remove();
		return null;
	}

	const remove = () => proxy.remove();
	animation.addEventListener('finish', remove);
	animation.addEventListener('cancel', remove);
	// Safety net: if the animation is interrupted without finish/cancel, the chip
	// must still leave the page.
	window.setTimeout(remove, (options.duration ?? 200) + (options.delay ?? 0) + 400);
	return animation;
}

/**
 * Slide each consumed-tile ghost into the surviving cell, shrinking and fading
 * as it lands. Ghosts merge one after another on the `stagger`.
 */
export function mergeGhosts(
	ghosts: readonly Element[],
	target: Element | Box,
	options: MergeOptions = {}
): Animation[] {
	if (ghosts.length === 0) return [];

	if (!enabled(options)) {
		for (const ghost of ghosts) applyOpacity(ghost, '0');
		return [];
	}

	const destination = boxOfTarget(target);
	return ghosts.map((ghost, index) => {
		const source = ghost.getBoundingClientRect();
		const dx = destination.left + destination.width / 2 - (source.left + source.width / 2);
		const dy = destination.top + destination.height / 2 - (source.top + source.height / 2);
		const scale =
			source.width > 0 && destination.width > 0 ? destination.width / source.width : 0.4;

		return ghost.animate(
			[
				{ transform: 'translate(0, 0) scale(1)', opacity: 1 },
				{ transform: 'translate(0, 0) scale(1.12)', opacity: 1, offset: 0.35 },
				{ transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0 }
			],
			{
				duration: options.duration ?? 280,
				delay: (options.delay ?? 0) + index * (options.stagger ?? 0),
				easing: options.easing ?? 'cubic-bezier(0.3, 0.7, 0.3, 1)',
				fill: 'both'
			}
		);
	});
}

/** A short scale pop, used for the fusion result and reached milestones. */
export function pulse(element: Element, options: MotionOptions = {}): Animation | null {
	if (!enabled(options)) return null;

	return element.animate(
		[
			{ transform: 'scale(1)' },
			{ transform: 'scale(1.16)', offset: 0.45 },
			{ transform: 'scale(1)' }
		],
		{
			duration: options.duration ?? 280,
			delay: options.delay ?? 0,
			easing: options.easing ?? 'cubic-bezier(0.2, 0.9, 0.25, 1)',
			fill: 'none'
		}
	);
}

/** Reactor shake for an Overload surge. */
export function shake(element: Element, options: MotionOptions = {}): Animation | null {
	if (!enabled(options)) return null;

	return element.animate(
		[
			{ transform: 'translateX(0)' },
			{ transform: 'translateX(-5px)' },
			{ transform: 'translateX(5px)' },
			{ transform: 'translateX(-3px)' },
			{ transform: 'translateX(3px)' },
			{ transform: 'translateX(0)' }
		],
		{
			duration: options.duration ?? 360,
			delay: options.delay ?? 0,
			easing: 'ease-in-out',
			fill: 'none'
		}
	);
}

/** Deal a fresh hand card in from above the hand. */
export function dealIn(element: Element, options: MotionOptions = {}): Animation | null {
	if (!enabled(options)) return null;

	return element.animate(
		[
			{ transform: 'translateY(-10px) scale(0.92)', opacity: 0 },
			{ transform: 'translateY(0) scale(1)', opacity: 1 }
		],
		{
			duration: options.duration ?? 240,
			delay: options.delay ?? 0,
			easing: options.easing ?? 'cubic-bezier(0.2, 0.9, 0.25, 1)',
			fill: 'none'
		}
	);
}

/** Tween a gauge's fill from an earlier ratio to its committed width. */
export function tweenBar(
	element: Element,
	fromRatio: number,
	options: MotionOptions = {}
): Animation | null {
	if (!enabled(options)) return null;

	if ('style' in element) {
		(element as HTMLElement).style.transformOrigin = 'left center';
	}
	const from = Math.min(1, Math.max(0, fromRatio));

	return element.animate([{ transform: `scaleX(${from})` }, { transform: 'scaleX(1)' }], {
		duration: options.duration ?? 440,
		delay: options.delay ?? 0,
		easing: options.easing ?? 'cubic-bezier(0.25, 0.8, 0.3, 1)',
		fill: 'none'
	});
}

function setText(element: Element, value: number): void {
	const text = String(value);
	if (
		typeof Node !== 'undefined' &&
		element.childNodes.length === 1 &&
		element.firstChild?.nodeType === Node.TEXT_NODE
	) {
		(element.firstChild as Text).data = text;
		return;
	}
	element.textContent = text;
}

const NOOP_HANDLE: MotionHandle = { cancel: () => {} };

/**
 * Count a number element (the score) from `from` to `to`. Writes through the
 * existing text node so Svelte keeps ownership of it, and silences `aria-live`
 * while the frames run so a screen reader hears only the final value.
 */
export function tweenNumber(
	element: Element,
	from: number,
	to: number,
	options: MotionOptions = {}
): MotionHandle {
	const reduced =
		options.reducedMotion ||
		!animationsAvailable() ||
		typeof requestAnimationFrame !== 'function' ||
		typeof performance === 'undefined';

	if (reduced) {
		setText(element, to);
		return NOOP_HANDLE;
	}

	const duration = options.duration ?? 520;
	const delay = options.delay ?? 0;
	const previousLive = element.getAttribute('aria-live');
	element.setAttribute('aria-live', 'off');
	setText(element, from);

	let frame = 0;
	let timer = 0;
	let done = false;

	function restoreLive(): void {
		if (previousLive === null) element.removeAttribute('aria-live');
		else element.setAttribute('aria-live', previousLive);
	}

	function finish(): void {
		if (done) return;
		done = true;
		if (frame) cancelAnimationFrame(frame);
		if (timer) clearTimeout(timer);
		setText(element, to);
		restoreLive();
	}

	const start = performance.now() + delay;
	function tick(now: number): void {
		if (done) return;
		const elapsed = now - start;

		if (elapsed < 0) {
			frame = requestAnimationFrame(tick);
			return;
		}

		const progress = Math.min(1, elapsed / duration);
		const eased = 1 - (1 - progress) ** 3;
		setText(element, Math.round(from + (to - from) * eased));

		if (progress < 1) frame = requestAnimationFrame(tick);
		else finish();
	}

	frame = requestAnimationFrame(tick);
	// rAF can be throttled in background tabs; guarantee the committed value.
	timer = window.setTimeout(finish, delay + duration + 80);

	return {
		cancel(): void {
			finish();
		}
	};
}

export interface CaptureInput {
	id: number;
	stage: HTMLElement | null;
	hand: HTMLElement | null;
	heat: HTMLElement | null;
	score: HTMLElement | null;
	discard: HTMLElement | null;
	handIndex: number;
	cell: number;
	card: ElementSymbol;
	/** The board before the commit, for the consumed tiles' symbols. */
	grid: readonly (ElementSymbol | null)[];
	/** The hand before the commit, so new draws can be dealt in. */
	handBefore: readonly ElementSymbol[];
	/** The resolved board, for the surviving result symbol. */
	finalGrid: readonly (ElementSymbol | null)[];
	steps: readonly FusionStep[];
	scoreFrom: number;
	scoreTo: number;
	heatFrom: number;
	heatTo: number;
	overload: boolean;
}

/**
 * Capture the board, chain, and DOM boxes for a placement *before* the store
 * commits. Every lookup is optional so a missing node (SSR, an unusual layout)
 * simply drops that part of the choreography instead of failing the commit.
 */
export function capturePlayback(input: CaptureInput): PlaybackModel {
	const stageBox = boxOf(input.stage);
	const cellElement = (cell: number): HTMLElement | null =>
		input.stage?.querySelector<HTMLElement>(`button[data-cell="${cell}"]`) ?? null;

	const ghosts: GhostSpec[] = [];
	const seen = new Set<number>();

	input.steps.forEach((step, index) => {
		// Later steps can never repeat a cell, but never stack a ghost.
		if (seen.has(step.cell)) return;
		seen.add(step.cell);
		ghosts.push({
			cell: step.cell,
			step: index,
			symbol: input.grid[step.cell] ?? step.b,
			box: relativeTo(boxOf(cellElement(step.cell)), stageBox),
			surviving: false
		});
	});

	const final = input.steps[input.steps.length - 1];
	ghosts.push({
		cell: input.cell,
		step: 'result',
		symbol: input.finalGrid[input.cell] ?? final?.result ?? input.card,
		box: relativeTo(boxOf(cellElement(input.cell)), stageBox),
		surviving: true
	});

	const handCard = input.hand?.querySelectorAll<HTMLElement>('.cards > button')[input.handIndex];
	const scoreValue = input.score?.querySelector<HTMLElement>('[data-testid="score-value"]');

	return {
		id: input.id,
		originCell: input.cell,
		card: input.card,
		steps: input.steps,
		ghosts,
		flight: relativeTo(boxOf(handCard), stageBox),
		discard: relativeTo(boxOf(input.discard), stageBox),
		score: relativeTo(boxOf(scoreValue), stageBox),
		scoreFrom: input.scoreFrom,
		scoreTo: input.scoreTo,
		heatFrom: input.heatFrom,
		heatTo: input.heatTo,
		keptHand: Math.max(0, input.handBefore.length - 1),
		overload: input.overload
	};
}
