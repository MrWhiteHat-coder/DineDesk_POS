import { useRef, useCallback } from 'react';

/**
 * useDragToDismiss — native-style swipe-down-to-close for bottom sheets.
 *
 * Attach the returned handlers to the sheet's grab handle (or the sheet
 * itself). While dragging, the sheet follows the finger 1:1 (with slight
 * resistance past 160px); release either snaps back or dismisses past a
 * 110px threshold / fast flick (velocity > 0.6 px/ms).
 *
 * onDismiss is only called when the sheet should actually close — the parent
 * unmounts/hides it and the transform resets with the element.
 *
 * Reduced-motion users still get dismissal (it's a gesture, not decoration),
 * but the transition is instant via the CSS side.
 */
export default function useDragToDismiss({ onDismiss, threshold = 110 } = {}) {
  const startY = useRef(null);
  const lastY = useRef(null);
  const lastT = useRef(null);
  const elRef = useRef(null);
  /** True while the current gesture began inside a scrollable area that is
   *  not at its top — the gesture belongs to scrolling, not dragging. */
  const scrollLocked = useRef(false);

  const setTransform = (y) => {
    const el = elRef.current;
    if (el) el.style.transform = y > 0 ? `translateY(${y}px)` : '';
  };

  const onTouchStart = useCallback((e) => {
    startY.current = e.touches[0].clientY;
    lastY.current = startY.current;
    lastT.current = performance.now();
    // Walk up from the touch target to the sheet root: if the gesture starts
    // inside any scrollable container that still has scroll-up room, lock
    // dragging for this gesture so the content scrolls instead of the sheet
    // following the finger (the "can't scroll back up" bug).
    scrollLocked.current = false;
    let node = e.target;
    while (node && node !== elRef.current && node !== document.body) {
      if (node.nodeType === 1) {
        const cs = getComputedStyle(node);
        if (/(auto|scroll)/.test(cs.overflowY) && node.scrollTop > 0) {
          scrollLocked.current = true;
          break;
        }
      }
      node = node.parentElement;
    }
  }, []);

  const onTouchMove = useCallback((e) => {
    if (startY.current === null || scrollLocked.current) return;
    const y = e.touches[0].clientY;
    const dy = y - startY.current;
    if (dy > 0) {
      // resistance grows as you drag further — premium rubber-band feel
      setTransform(Math.min(160 + (dy - 160) * 0.35, dy));
      const el = elRef.current || e.currentTarget;
      if (el) el.style.transition = 'none';
    }
    lastY.current = y;
    lastT.current = performance.now();
  }, []);

  const onTouchEnd = useCallback(() => {
    if (startY.current === null) return;
    scrollLocked.current = false;
    const dy = (lastY.current ?? 0) - (startY.current ?? 0);
    const dt = Math.max(1, performance.now() - (lastT.current ?? performance.now()));
    const velocity = dy / dt; // px per ms
    const el = elRef.current;
    if (el) el.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';

    if (dy > threshold || velocity > 0.6) {
      if (el) el.style.transform = 'translateY(100%)';
      setTimeout(() => {
        setTransform('');
        onDismiss?.();
      }, 180);
    } else {
      setTransform('');
    }
    startY.current = null;
    lastY.current = null;
  }, [onDismiss, threshold]);

  /** Ref to spread on the draggable sheet element. */
  const dragRef = (el) => { elRef.current = el; };

  return {
    dragRef,
    dragHandlers: { onTouchStart, onTouchMove, onTouchEnd },
  };
}
