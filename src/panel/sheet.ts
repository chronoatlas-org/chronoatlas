// The panel as a "bottom sheet" on phones: it sits between the map and the timeline and has three
// heights. You drag its handle, or tap it to cycle, or use the arrow keys on it. On wider
// screens the panel is a side panel and none of this applies (the handle is hidden by CSS).
//
// The heights here must match `.panel[data-sheet=…]` in src/style.css.

export type SheetHeight = 'peek' | 'half' | 'full';

const ORDER: readonly SheetHeight[] = ['peek', 'half', 'full'];

/** Pixel heights for a viewport of the given height. */
export function sheetHeights(viewportHeight: number): Record<SheetHeight, number> {
  return { peek: 112, half: Math.round(viewportHeight * 0.45), full: Math.round(viewportHeight * 0.72) };
}

/** Tapping the handle: peek → half → full → peek. */
export function cycleHeight(height: SheetHeight): SheetHeight {
  return ORDER[(ORDER.indexOf(height) + 1) % ORDER.length];
}

/** Arrow keys: one step bigger (+1) or smaller (-1), stopping at the ends. */
export function stepHeight(height: SheetHeight, direction: 1 | -1): SheetHeight {
  return ORDER[Math.min(ORDER.length - 1, Math.max(0, ORDER.indexOf(height) + direction))];
}

/** Where a drag ends up: the height nearest to where it was let go. */
export function nearestHeight(px: number, heights: Record<SheetHeight, number>): SheetHeight {
  return ORDER.reduce((best, h) => (Math.abs(heights[h] - px) < Math.abs(heights[best] - px) ? h : best));
}

/** A drag shorter than this is a tap. */
const TAP_DISTANCE = 6;

/**
 * Makes `.panel-handle` inside `container` resize it. The listeners are on the container, so they
 * keep working when Preact redraws the handle.
 */
export function attachSheetHandle(
  container: HTMLElement,
  getHeight: () => SheetHeight,
  setHeight: (height: SheetHeight) => void,
): void {
  let drag: { pointerId: number; startY: number; startPx: number; moved: boolean } | null = null;
  let suppressClick = false;

  const isHandle = (target: EventTarget | null) => target instanceof Element && target.closest('.panel-handle') !== null;

  container.addEventListener('pointerdown', (event) => {
    if (!isHandle(event.target) || event.button !== 0) return;
    drag = { pointerId: event.pointerId, startY: event.clientY, startPx: container.getBoundingClientRect().height, moved: false };
    container.setPointerCapture(event.pointerId);
    container.classList.add('is-dragging');
  });

  container.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dy = drag.startY - event.clientY;
    if (Math.abs(dy) >= TAP_DISTANCE) drag.moved = true;
    if (!drag.moved) return;
    const heights = sheetHeights(window.innerHeight);
    const px = Math.min(heights.full, Math.max(heights.peek, drag.startPx + dy));
    container.style.height = `${px}px`;
  });

  const endDrag = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    container.classList.remove('is-dragging');
    if (drag.moved) {
      const px = container.getBoundingClientRect().height;
      container.style.height = '';
      setHeight(nearestHeight(px, sheetHeights(window.innerHeight)));
      suppressClick = true; // the click that follows a drag isn't a tap
    }
    drag = null;
  };
  container.addEventListener('pointerup', endDrag);
  container.addEventListener('pointercancel', endDrag);

  // A tap, or Enter/Space on the focused handle, arrives as a click.
  container.addEventListener('click', (event) => {
    if (!isHandle(event.target)) return;
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    setHeight(cycleHeight(getHeight()));
  });

  container.addEventListener('keydown', (event) => {
    if (!isHandle(event.target)) return;
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      setHeight(stepHeight(getHeight(), event.key === 'ArrowUp' ? 1 : -1));
    }
  });
}
