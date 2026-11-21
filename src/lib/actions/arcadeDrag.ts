import type { ElementSymbol } from '../types';

/** Vertical travel, in pixels, that counts as a swipe. */
export const SWIPE_DISTANCE = 48;

/** Movement, in pixels, before a gesture claims the pointer from native scroll. */
export const DRAG_THRESHOLD = 8;

/**
 * Page-scroll lock owners. Every live gesture that has claimed the pointer adds
 * one owner, and the body is restored only when the last one releases, so two
 * interleaved drags cannot leave `touch-action: none` behind.
 */
let scrollLockOwners = 0;
let savedBodyTouchAction = '';

function lockPageScroll(): void {
	if (typeof document === 'undefined') return;
	if (scrollLockOwners === 0) savedBodyTouchAction = document.body.style.touchAction;
	scrollLockOwners += 1;
	document.body.style.touchAction = 'none';
}

function unlockPageScroll(): void {
	if (typeof document === 'undefined' || scrollLockOwners === 0) return;
	scrollLockOwners -= 1;
	if (scrollLockOwners === 0) document.body.style.touchAction = savedBodyTouchAction;
}

export interface DragPlacementHandlers {
	/** A hand card was picked up. */
	begin(cardIndex: number): void;
	/** The pointer entered `cell`, or left the board (`null`). */
	hover(cell: number | null): void;
	/** The card was released over `cell`; commit it. */
	commit(cardIndex: number, cell: number): void;
	/** The gesture ended without a valid cell, or was swiped away. */
	cancel(): void;
}

export interface DragPlacementConfig {
	cardIndex: number;
	symbol: ElementSymbol;
	disabled?: boolean;
	handlers?: DragPlacementHandlers;
}

export interface DragTileConfig {
	cell: number;
	symbol: ElementSymbol | null;
	disabled?: boolean;
	/** Called when the tile is released away from its own cell. */
	onScrap?: (cell: number) => void;
	/** Called when the gesture ends on the tile's own cell (a tap). */
	onCancel?: (cell: number) => void;
	/**
	 * Called when the gesture is a downward swipe. Cancelling takes precedence
	 * over scrapping: a swipe down on a placed tile clears the gesture, it does
	 * not destroy the tile.
	 */
	onSwipeCancel?: (cell: number) => void;
}

export interface SwipeConfig {
	disabled?: boolean;
	onSwipeUp?: () => void;
	onSwipeDown?: () => void;
}

interface Session {
	pointerId: number;
	startX: number;
	startY: number;
	lastCell: number | null;
	ghost: HTMLElement;
	node: HTMLElement;
	previousNodeTouchAction: string;
	/** True once this session claimed the pointer and owns a page-scroll slot. */
	scrollLocked: boolean;
	move: (event: PointerEvent) => void;
	end: (event: PointerEvent) => void;
	cancel: (event?: PointerEvent) => void;
}

/** True when the gesture reads as vertical rather than a horizontal scroll. */
function isVerticalGesture(dx: number, dy: number): boolean {
	return Math.abs(dy) >= DRAG_THRESHOLD && Math.abs(dy) >= Math.abs(dx);
}

/** True once the pointer has travelled far enough to be a gesture, not a tap. */
function isMoved(dx: number, dy: number): boolean {
	return Math.max(Math.abs(dx), Math.abs(dy)) >= DRAG_THRESHOLD;
}

const ARROW_DELTAS: Readonly<Record<string, readonly [row: number, col: number]>> = {
	ArrowUp: [-1, 0],
	ArrowDown: [1, 0],
	ArrowLeft: [0, -1],
	ArrowRight: [0, 1]
};

/** The first empty cell in reading order, or null when the board is full. */
export function firstEmptyCell(grid: readonly unknown[]): number | null {
	const index = grid.findIndex((tile) => tile == null);
	return index === -1 ? null : index;
}

/**
 * Move a keyboard ghost one step in an arrow direction, skipping occupied
 * cells. Stays put (returns `null`) at the edge or when the row is blocked.
 */
export function stepCell(
	cell: number,
	key: string,
	grid: readonly unknown[],
	size = 5
): number | null {
	const delta = ARROW_DELTAS[key];
	if (!delta) return null;

	let row = Math.floor(cell / size);
	let col = cell % size;

	for (;;) {
		row += delta[0];
		col += delta[1];
		if (row < 0 || row >= size || col < 0 || col >= size) return null;

		const next = row * size + col;
		if (grid[next] == null) return next;
	}
}

/** The cell under a pointer, preferring real hit-testing over the event target. */
function cellUnder(event: PointerEvent): number | null {
	if (typeof document === 'undefined') return null;

	let element: Element | null = null;
	if (typeof document.elementFromPoint === 'function') {
		try {
			element = document.elementFromPoint(event.clientX, event.clientY);
		} catch {
			element = null;
		}
	}
	if (!element && event.target instanceof Element) element = event.target;

	const cell = element?.closest<HTMLElement>('[data-cell]');
	if (!cell || cell.dataset.cell === undefined) return null;

	const value = Number(cell.dataset.cell);
	return Number.isInteger(value) ? value : null;
}

/** A floating card that follows the pointer for the duration of a drag. */
function createGhost(symbol: ElementSymbol): HTMLElement {
	const ghost = document.createElement('div');
	ghost.dataset.dragGhost = '';
	ghost.setAttribute('aria-hidden', 'true');
	ghost.textContent = symbol;
	ghost.style.cssText = [
		'position: fixed',
		'z-index: 50',
		'display: grid',
		'place-items: center',
		'width: 52px',
		'height: 52px',
		'pointer-events: none',
		'border: 1px solid rgba(56, 225, 255, 0.85)',
		'border-radius: 10px',
		'background: rgba(13, 20, 36, 0.94)',
		'color: #38e1ff',
		'font: 700 22px ui-monospace, monospace',
		'box-shadow: 0 0 18px rgba(56, 225, 255, 0.4)',
		'transform: translate(-50%, -50%)',
		'user-select: none'
	].join(';');
	return ghost;
}

function positionGhost(ghost: HTMLElement, x: number, y: number): void {
	ghost.style.left = `${x}px`;
	ghost.style.top = `${y}px`;
}

/**
 * Shared pointer session plumbing: capture the pointer, float a ghost, block
 * page scroll only while the gesture is live, and clean every bit of it up.
 */
function openSession(
	node: HTMLElement,
	event: PointerEvent,
	symbol: ElementSymbol
): Session | null {
	if (typeof document === 'undefined') return null;
	if (event.button > 0) return null;

	const ghost = createGhost(symbol);
	document.body.appendChild(ghost);
	positionGhost(ghost, event.clientX, event.clientY);

	const session: Session = {
		pointerId: event.pointerId,
		startX: event.clientX,
		startY: event.clientY,
		lastCell: null,
		ghost,
		node,
		previousNodeTouchAction: node.style.touchAction,
		scrollLocked: false,
		move: () => {},
		end: () => {},
		cancel: () => {}
	};

	try {
		node.setPointerCapture?.(event.pointerId);
	} catch {
		// jsdom and detached nodes do not implement pointer capture.
	}

	return session;
}

/**
 * Claim the gesture from native scrolling. Called only once the pointer has
 * moved past `DRAG_THRESHOLD`, so a mostly horizontal swipe on the hand still
 * scrolls it instead of being swallowed.
 */
function suppressScroll(session: Session): void {
	if (session.scrollLocked) return;
	session.scrollLocked = true;
	session.node.style.touchAction = 'none';
	lockPageScroll();
}

function closeSession(session: Session): void {
	window.removeEventListener('pointermove', session.move);
	window.removeEventListener('pointerup', session.end);
	window.removeEventListener('pointercancel', session.cancel);
	session.ghost.remove();
	if (session.scrollLocked) {
		session.node.style.touchAction = session.previousNodeTouchAction;
		unlockPageScroll();
	}
	try {
		session.node.releasePointerCapture?.(session.pointerId);
	} catch {
		// Nothing captured (or jsdom): nothing to release.
	}
}

function listen(session: Session): void {
	window.addEventListener('pointermove', session.move, { passive: false });
	window.addEventListener('pointerup', session.end);
	window.addEventListener('pointercancel', session.cancel);
}

/**
 * Svelte action: pick up a hand card with the pointer, hover empty cells to
 * drive the live preview, and commit on release. Releasing outside the board,
 * or swiping down, cancels.
 */
export function dragPlacement(node: HTMLElement, config: DragPlacementConfig) {
	let options = config;
	let session: Session | null = null;

	function move(event: PointerEvent): void {
		if (!session || event.pointerId !== session.pointerId) return;

		const dx = event.clientX - session.startX;
		const dy = event.clientY - session.startY;

		// A horizontal swipe belongs to the hand's scroller; only vertical
		// travel turns the press into a placement drag.
		if (!session.scrollLocked) {
			if (!isVerticalGesture(dx, dy)) return;
			suppressScroll(session);
		}

		if (event.cancelable) event.preventDefault();
		positionGhost(session.ghost, event.clientX, event.clientY);

		// Cancel wins over placement: a downward swipe is never a commit.
		if (dy > SWIPE_DISTANCE) {
			const handlers = options.handlers;
			closeSession(session);
			session = null;
			handlers?.cancel();
			return;
		}

		const cell = cellUnder(event);
		if (cell !== session.lastCell) {
			session.lastCell = cell;
			options.handlers?.hover(cell);
		}
	}

	function end(event: PointerEvent): void {
		if (!session || event.pointerId !== session.pointerId) return;

		const current = session;
		const hovered = current.lastCell;
		const dx = event.clientX - current.startX;
		const dy = event.clientY - current.startY;
		const cell = cellUnder(event);
		closeSession(current);
		session = null;

		// Same precedence as `move`, for a pointerup that jumps without moves.
		if (dy > SWIPE_DISTANCE && Math.abs(dy) >= Math.abs(dx)) {
			options.handlers?.cancel();
			return;
		}

		// Commit only the cell the live preview was already showing. A release
		// that never hovered a cell has no preview to honour.
		if (cell === null || cell !== hovered) {
			options.handlers?.cancel();
			return;
		}
		options.handlers?.commit(options.cardIndex, cell);
	}

	function cancel(): void {
		if (!session) return;
		closeSession(session);
		session = null;
		options.handlers?.cancel();
	}

	function begin(event: PointerEvent): void {
		if (session || options.disabled || !options.handlers) return;

		const next = openSession(node, event, options.symbol);
		if (!next) return;

		next.move = move;
		next.end = end;
		next.cancel = cancel;
		session = next;
		listen(next);

		options.handlers.begin(options.cardIndex);
	}

	node.addEventListener('pointerdown', begin);

	return {
		update(next: DragPlacementConfig) {
			options = next;
			if (next.disabled && session) cancel();
		},
		destroy() {
			node.removeEventListener('pointerdown', begin);
			if (session) {
				closeSession(session);
				session = null;
			}
		}
	};
}

/**
 * Svelte action for a placed tile: drag it off its cell to Scrap it. A release
 * back over the original cell cancels, so a tap still reaches the cell's click.
 */
export function dragTile(node: HTMLElement, config: DragTileConfig) {
	let options = config;
	let session: Session | null = null;

	function move(event: PointerEvent): void {
		if (!session || event.pointerId !== session.pointerId) return;

		const dx = event.clientX - session.startX;
		const dy = event.clientY - session.startY;

		if (!session.scrollLocked) {
			if (!isMoved(dx, dy)) return;
			suppressScroll(session);
		}

		if (event.cancelable) event.preventDefault();
		positionGhost(session.ghost, event.clientX, event.clientY);

		// Cancel takes precedence over scrap: a downward swipe never destroys
		// the tile, no matter where the pointer is released.
		if (dy > SWIPE_DISTANCE && Math.abs(dy) >= Math.abs(dx)) {
			closeSession(session);
			session = null;
			options.onSwipeCancel?.(options.cell);
		}
	}

	function end(event: PointerEvent): void {
		if (!session || event.pointerId !== session.pointerId) return;

		const current = session;
		const dx = event.clientX - current.startX;
		const dy = event.clientY - current.startY;
		const cell = cellUnder(event);
		closeSession(current);
		session = null;

		if (dy > SWIPE_DISTANCE && Math.abs(dy) >= Math.abs(dx)) {
			options.onSwipeCancel?.(options.cell);
			return;
		}

		// A tap (no real travel) or a release back on the tile is not a scrap.
		if (!isMoved(dx, dy) || (cell !== null && cell === options.cell)) {
			options.onCancel?.(options.cell);
			return;
		}
		options.onScrap?.(options.cell);
	}

	function cancel(): void {
		if (!session) return;
		closeSession(session);
		session = null;
		options.onCancel?.(options.cell);
	}

	function begin(event: PointerEvent): void {
		if (session || options.disabled || !options.symbol) return;

		const next = openSession(node, event, options.symbol);
		if (!next) return;

		next.move = move;
		next.end = end;
		next.cancel = cancel;
		session = next;
		listen(next);
	}

	node.addEventListener('pointerdown', begin);

	return {
		update(next: DragTileConfig) {
			options = next;
			if (next.disabled && session) cancel();
		},
		destroy() {
			node.removeEventListener('pointerdown', begin);
			if (session) {
				closeSession(session);
				session = null;
			}
		}
	};
}

/**
 * Svelte action: reactor swipes. Swipe up (not starting on a tile) opens the
 * Stabilize picker; swipe down cancels. The click that follows a swipe is
 * swallowed so the gesture cannot also place or scrap.
 */
export function swipeGestures(node: HTMLElement, config: SwipeConfig) {
	let options = config;
	let track: {
		pointerId: number;
		x: number;
		y: number;
		onTile: boolean;
		locked: boolean;
		previousTouchAction: string;
	} | null = null;
	let swallowClick = false;
	let swallowTimer: ReturnType<typeof setTimeout> | null = null;

	function armClickSwallow(): void {
		swallowClick = true;
		if (swallowTimer !== null) clearTimeout(swallowTimer);
		// A swipe that produces no click must not eat an unrelated later tap.
		swallowTimer = setTimeout(() => {
			swallowClick = false;
			swallowTimer = null;
		}, 500);
	}

	function up(event: PointerEvent): void {
		const current = track;
		if (!current || event.pointerId !== current.pointerId) return;

		const dx = event.clientX - current.x;
		const dy = event.clientY - current.y;
		const vertical = Math.abs(dy) >= Math.abs(dx) && Math.abs(dy) >= SWIPE_DISTANCE;
		stop();

		if (!vertical) return;
		armClickSwallow();
		// Presses on a tile belong to `dragTile`, which performs its own cancel
		// on a downward swipe; only the click is swallowed here.
		if (current.onTile) return;
		if (dy < 0) options.onSwipeUp?.();
		else options.onSwipeDown?.();
	}

	function cancel(): void {
		stop();
	}

	function move(event: PointerEvent): void {
		const current = track;
		if (!current || event.pointerId !== current.pointerId) return;
		if (current.locked) {
			if (event.cancelable) event.preventDefault();
			return;
		}
		if (current.onTile) return;

		const dx = event.clientX - current.x;
		const dy = event.clientY - current.y;
		if (!isVerticalGesture(dx, dy)) return;

		// Claim the gesture only once it is unmistakably a vertical swipe, so a
		// resting board still scrolls the page and a horizontal drag stays native.
		current.locked = true;
		node.style.touchAction = 'none';
		if (event.cancelable) event.preventDefault();
	}

	function stop(): void {
		const current = track;
		track = null;
		window.removeEventListener('pointermove', move);
		window.removeEventListener('pointerup', up);
		window.removeEventListener('pointercancel', cancel);
		if (current?.locked) node.style.touchAction = current.previousTouchAction;
	}

	function down(event: PointerEvent): void {
		if (options.disabled || event.button > 0 || track) return;

		const target = event.target instanceof Element ? event.target : null;
		const cell = target?.closest<HTMLElement>('[data-cell]') ?? null;

		swallowClick = false;
		track = {
			pointerId: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			onTile: cell?.dataset.filled === 'true',
			locked: false,
			previousTouchAction: node.style.touchAction
		};

		window.addEventListener('pointermove', move, { passive: false });
		window.addEventListener('pointerup', up);
		window.addEventListener('pointercancel', cancel);
	}

	/** A press that loses focus or leaves the surface can no longer complete. */
	function abandon(event?: Event): void {
		if (event && 'buttons' in event && (event as PointerEvent).buttons !== 0) return;
		stop();
	}

	function click(event: MouseEvent): void {
		if (!swallowClick) return;
		swallowClick = false;
		if (swallowTimer !== null) {
			clearTimeout(swallowTimer);
			swallowTimer = null;
		}
		event.preventDefault();
		event.stopPropagation();
	}

	node.addEventListener('pointerdown', down);
	node.addEventListener('pointerleave', abandon);
	node.addEventListener('click', click, true);
	window.addEventListener('blur', abandon);

	return {
		update(next: SwipeConfig) {
			options = next;
		},
		destroy() {
			node.removeEventListener('pointerdown', down);
			node.removeEventListener('pointerleave', abandon);
			node.removeEventListener('click', click, true);
			window.removeEventListener('blur', abandon);
			if (swallowTimer !== null) {
				clearTimeout(swallowTimer);
				swallowTimer = null;
			}
			stop();
		}
	};
}
