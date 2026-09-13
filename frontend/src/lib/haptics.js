/**
 * Haptic feedback — native-feel tap confirmation on Android (navigator.vibrate).
 * iOS Safari does not support the Vibration API; every call degrades to a no-op
 * there, so this is safe to sprinkle anywhere a tap should "feel" confirmed.
 *
 * Patterns are deliberately tiny (ms) — premium products buzz, they don't rattle.
 */

const supported = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

const fire = (pattern) => {
  if (!supported) return;
  try { navigator.vibrate(pattern); } catch { /* never break a tap over haptics */ }
};

export const haptics = {
  /** Light tick — menu item added to cart, minor toggles. */
  tick: () => fire(8),
  /** Medium double-pulse — order placed, payment recorded, day opened. */
  success: () => fire([12, 40, 18]),
  /** Distinct triple pulse — destructive or important (day close). */
  warning: () => fire([10, 30, 10, 30, 24]),
  /** Soft single press — navigation, sheet opens. */
  press: () => fire(6),
};

export default haptics;
