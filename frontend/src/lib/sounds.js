/**
 * DineDesk sound kit — synthesized with WebAudio, zero assets to load.
 *
 * A gentle two-note chime for the Kitchen Display: soft enough for an
 * 8-hour shift, distinct enough to cut through kitchen noise. Uses a
 * sine "music box" tone with quick exponential decay — warm, not harsh.
 *
 * Browsers require a user gesture before audio; the first tap on any
 * page arms it automatically via the listener below.
 */

let ctx = null;

const ensureCtx = () => {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
};

/* Arm on the first user gesture (browser autoplay policy) */
if (typeof window !== 'undefined') {
  const arm = () => { ensureCtx(); window.removeEventListener('pointerdown', arm); };
  window.addEventListener('pointerdown', arm, { once: true });
}

const tone = (audioCtx, { freq, start, dur, gain = 0.12, type = 'sine' }) => {
  const osc = audioCtx.createOscillator();
  const vol = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  vol.gain.setValueAtTime(0, audioCtx.currentTime + start);
  vol.gain.linearRampToValueAtTime(gain, audioCtx.currentTime + start + 0.015);
  vol.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + start + dur);
  osc.connect(vol).connect(audioCtx.destination);
  osc.start(audioCtx.currentTime + start);
  osc.stop(audioCtx.currentTime + start + dur + 0.05);
};

export const sounds = {
  /** Kitchen Display: new order landed — soft rising two-note chime (C6→E6). */
  newOrder: () => {
    const ac = ensureCtx();
    if (!ac) return;
    try {
      tone(ac, { freq: 1046.5, start: 0, dur: 0.28, gain: 0.10 });
      tone(ac, { freq: 1318.5, start: 0.13, dur: 0.38, gain: 0.12 });
    } catch { /* audio must never break the kitchen */ }
  },
  /** Task done inside the app (order ready, day opened) — single warm note. */
  done: () => {
    const ac = ensureCtx();
    if (!ac) return;
    try {
      tone(ac, { freq: 880, start: 0, dur: 0.3, gain: 0.09 });
    } catch { /* noop */ }
  },
};

export default sounds;
