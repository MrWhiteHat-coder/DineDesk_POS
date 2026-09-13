import { useEffect, useRef, useState } from 'react';

/**
 * Animated count-up number — rolls from the previous value to `value` with an
 * ease-out curve. Re-animates whenever `value` changes (order counts, sales).
 *
 * Premium touches baked in:
 *  - respects prefers-reduced-motion (renders final value instantly)
 *  - formats with en-IN grouping (₹12,450) via toLocaleString
 *  - duration scales slightly with distance so big jumps don't feel rushed
 *
 * Renderless styling: pass className/font classes straight through.
 */
export default function CountUp({
  value = 0,
  duration = 900,
  prefix = '',
  suffix = '',
  className = '',
  format = (n) => n.toLocaleString('en-IN'),
}) {
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const [display, setDisplay] = useState(prefersReducedMotion ? value : 0);
  const fromRef = useRef(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplay(value);
      return undefined;
    }

    const from = fromRef.current;
    const to = Number(value) || 0;
    if (from === to) {
      setDisplay(to);
      return undefined;
    }

    const dist = Math.abs(to - from);
    // Long distances get proportionally more time, clamped 600–1200ms
    const dur = Math.min(1200, Math.max(600, duration * (0.5 + Math.min(1, dist / Math.max(to, 1)))));
    const start = performance.now();

    const step = (now) => {
      const t = Math.min(1, (now - start) / dur);
      // easeOutExpo — fast start, gentle settle (premium feel)
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      const current = from + (to - from) * eased;
      setDisplay(current);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = to;
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = to;
    };
  }, [value, duration, prefersReducedMotion]);

  const rounded = Math.round(display * 100) / 100;
  const isInt = Number.isInteger(Number(value));

  return (
    <span className={className}>
      {prefix}
      {format(isInt ? Math.round(rounded) : rounded)}
      {suffix}
    </span>
  );
}
