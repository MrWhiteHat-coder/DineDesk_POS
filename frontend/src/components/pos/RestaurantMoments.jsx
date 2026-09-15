import React, { useState, useEffect, useRef, useCallback } from 'react';
import { kdsAPI } from '../../lib/api';

/*
 * Restaurant Moments — the restaurant feels alive.
 *
 * Brand-illustrated moments, fired only by REAL events:
 *   order placed → chef runs the KOT to the kitchen
 *   kitchen starts cooking / order ready / order completed  (KDS status diffs)
 *   payment success, walk-in customer, discount applied, day closed,
 *   offline saved (no internet), offline sync finished (celebration),
 *   low stock alert, AI insight ready, order error (retry)
 *
 * Rules:
 *   - Real events only — no fabricated activity (honest-data rule).
 *   - One moment at a time, CENTERED on screen, auto-dismiss, never blocks clicks.
 *   - Same type max once / 30s. Queue capped. Mute via localStorage.
 *   - momentAndWait() resolves when the moment finishes — used to sequence
 *     payment success → moment → receipt popup.
 */

import orderPlacedImg from '../../assets/moments/order_placed.png';
import sendingKitchenImg from '../../assets/moments/sending_kitchen.png';
import kitchenStartedImg from '../../assets/moments/kitchen_started.png';
import orderReadyImg from '../../assets/moments/order_ready.png';
import servedTableImg from '../../assets/moments/served_table.png';
import paymentSuccessImg from '../../assets/moments/payment_success.png';
import tableCleanedImg from '../../assets/moments/table_cleaned.png';
import newCustomerImg from '../../assets/moments/new_customer.png';
import discountAppliedImg from '../../assets/moments/discount_applied.png';
import dayCloseImg from '../../assets/moments/day_close.png';
import syncingImg from '../../assets/moments/syncing.png';
import errorRetryImg from '../../assets/moments/error_retry.png';
import noInternetImg from '../../assets/moments/no_internet.png';
import inventoryAlertImg from '../../assets/moments/inventory_alert.png';
import aiInsightImg from '../../assets/moments/ai_insight.png';
import celebrationImg from '../../assets/moments/celebration.png';

export const MOMENT_TYPES = {
  order_placed:      { img: orderPlacedImg,      anim: 'moment-bob',     title: 'Order placed!',            sub: 'Sent to the kitchen counter.',      tone: 'emerald' },
  sending_kitchen:   { img: sendingKitchenImg,   anim: 'moment-run',     title: 'On its way to the kitchen!', sub: 'Chef is running with the KOT.',    tone: 'amber' },
  kitchen_started:   { img: kitchenStartedImg,   anim: 'moment-flicker', title: 'Kitchen started working!',  sub: 'Flames on — your food is cooking.', tone: 'amber' },
  order_ready:       { img: orderReadyImg,       anim: 'moment-bounce',  title: 'Order ready!',              sub: 'Hot and fresh — serve it now.',      tone: 'emerald' },
  served_table:      { img: servedTableImg,      anim: 'moment-bob',     title: 'Enjoy your meal!',          sub: 'Served fresh to the table.',         tone: 'emerald' },
  payment_success:   { img: paymentSuccessImg,   anim: 'moment-bounce',  title: 'Payment successful!',       sub: 'Bill settled — nicely done.',        tone: 'emerald' },
  table_cleaned:     { img: tableCleanedImg,     anim: 'moment-sweep',   title: 'Table cleaned!',            sub: 'Ready for the next guests.',         tone: 'emerald' },
  new_customer:      { img: newCustomerImg,      anim: 'moment-wave',    title: 'Welcome, walk-in guest!',   sub: 'Order punched without details.',     tone: 'emerald' },
  discount_applied:  { img: discountAppliedImg,  anim: 'moment-swing',   title: 'Discount applied!',         sub: 'Guest saves — smiles guaranteed.',   tone: 'emerald' },
  day_close:         { img: dayCloseImg,         anim: 'moment-bounce',  title: 'Day closed!',               sub: 'Great work today — rest well.',      tone: 'slate' },
  syncing:           { img: syncingImg,          anim: 'moment-pulse',   title: 'Syncing…',                  sub: 'Almost done — orders on the way.',   tone: 'slate' },
  no_internet:       { img: noInternetImg,       anim: 'moment-shake',   title: 'No internet',               sub: 'Order saved offline — will auto-sync.', tone: 'slate' },
  error_retry:       { img: errorRetryImg,       anim: 'moment-shake',   title: 'Oops! Something went wrong.', sub: 'Nothing changed — let us try again.', tone: 'rose' },
  inventory_alert:   { img: inventoryAlertImg,   anim: 'moment-shake',   title: 'Low stock!',                sub: 'An item is running low — check inventory.', tone: 'amber' },
  ai_insight:        { img: aiInsightImg,        anim: 'moment-pulse',   title: 'Quick insight ready!',      sub: 'DineDesk Intelligence found something.', tone: 'slate' },
  celebration:       { img: celebrationImg,      anim: 'moment-jump',    title: "You're doing amazing!",     sub: 'Offline orders delivered successfully.', tone: 'emerald' },
};

const TONES = {
  emerald: 'border-emerald-200/80 dark:border-emerald-400/20 bg-white/95 dark:bg-[#161A20]/95',
  amber: 'border-amber-200/80 dark:border-amber-400/20 bg-white/95 dark:bg-[#161A20]/95',
  slate: 'border-slate-200/80 dark:border-white/[0.08] bg-white/95 dark:bg-[#161A20]/95',
  rose: 'border-rose-200/80 dark:border-rose-400/20 bg-white/95 dark:bg-[#161A20]/95',
};

const SHOW_MS = 3400;
const EXIT_MS = 380;
const TYPE_COOLDOWN_MS = 30000;
const MAX_QUEUE = 3;

export default function RestaurantMoments() {
  const [current, setCurrent] = useState(null); // {key, type, sub, resolve}
  const [leaving, setLeaving] = useState(false);
  const queueRef = useRef([]);
  const busyRef = useRef(false);
  const lastFiredRef = useRef({});
  const timerRef = useRef(null);

  /* ── queue playback (one at a time) ── */
  const pump = useCallback(() => {
    if (busyRef.current) return;
    const next = queueRef.current.shift();
    if (!next) return;
    busyRef.current = true;
    setCurrent(next);
    setLeaving(false);
    timerRef.current = setTimeout(() => {
      setLeaving(true);
      timerRef.current = setTimeout(() => {
        setCurrent(null);
        busyRef.current = false;
        next.resolve?.();
        pump();
      }, EXIT_MS);
    }, SHOW_MS);
  }, []);

  const enqueue = useCallback((type, sub, resolve) => {
    const now = Date.now();
    const suppressed =
      localStorage.getItem('dinedesk-moments-muted') === 'true' ||
      now - (lastFiredRef.current[type] || 0) < TYPE_COOLDOWN_MS ||
      queueRef.current.length >= MAX_QUEUE;
    if (suppressed) {
      // Callers waiting on the moment (payment → receipt sequencing) must not
      // hang when the moment is muted/cooled-down — resolve at once.
      if (resolve) setTimeout(resolve, 350);
      return;
    }
    lastFiredRef.current[type] = now;
    queueRef.current.push({ key: `${type}-${now}`, type, sub, resolve });
    pump();
  }, [pump]);

  useEffect(() => () => {
    clearTimeout(timerRef.current);
    // Never leave sequenced callers hanging if we unmount mid-moment.
    if (busyRef.current && current?.resolve) current.resolve();
  }, [current]);

  /* ── external event bus: window.dispatchEvent(momentEvent('payment_success')) ── */
  useEffect(() => {
    const onMoment = (e) => {
      const t = e.detail && e.detail.type;
      if (t && MOMENT_TYPES[t]) enqueue(t, e.detail.sub, e.detail.resolve);
    };
    window.addEventListener('dinedesk:moment', onMoment);
    return () => window.removeEventListener('dinedesk:moment', onMoment);
  }, [enqueue]);

  /* ── KDS polling: kitchen_start / ready / served diffs (real kitchen events) ── */
  useEffect(() => {
    if (localStorage.getItem('dinedesk-moments-muted') === 'true') return;
    let alive = true;
    const seen = {};   // orderId → status
    let baseline = false;
    const poll = async () => {
      try {
        const res = await kdsAPI.getOrders();
        if (!alive) return;
        const incoming = res.data || [];
        for (const o of incoming) {
          const prev = seen[o.id];
          if (baseline && prev && prev !== o.status) {
            if (o.status === 'preparing') enqueue('kitchen_started');
            else if (o.status === 'ready') enqueue('order_ready');
            else if (o.status === 'completed') enqueue(o.order_type === 'dine_in' ? 'table_cleaned' : 'served_table');
          }
          seen[o.id] = o.status;
        }
        baseline = true;
      } catch { /* moments never disturb */ }
    };
    poll();
    const iv = setInterval(poll, 12000);
    return () => { alive = false; clearInterval(iv); };
  }, [enqueue]);

  if (!current) return null;
  const cfg = MOMENT_TYPES[current.type];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none select-none px-4"
      role="status"
      aria-live="polite"
      data-testid="restaurant-moment"
    >
      <div
        className={`flex items-center gap-3 pl-2.5 pr-6 py-2.5 rounded-2xl border shadow-[0_24px_70px_-18px_rgba(15,36,23,0.45)] backdrop-blur-sm transition-all duration-300 ease-out ${TONES[cfg.tone]} ${leaving ? 'opacity-0 scale-95' : 'opacity-100 scale-100 animate-moment-in'}`}
      >
        <img
          src={cfg.img}
          alt=""
          aria-hidden="true"
          className={`w-[92px] h-[74px] object-contain object-bottom ${cfg.anim}`}
          draggable="false"
        />
        <div className="min-w-0">
          <p className="text-[14px] font-bold font-heading text-slate-900 dark:text-white leading-tight">{cfg.title}</p>
          <p className="text-[12px] text-slate-500 dark:text-white/50 leading-snug">{current.sub || cfg.sub}</p>
        </div>
      </div>
    </div>
  );
}

/** Fire from anywhere: moment('payment_success') or moment('syncing', '3 orders queued') */
export const moment = (type, sub) => {
  window.dispatchEvent(new CustomEvent('dinedesk:moment', { detail: { type, sub } }));
};

/**
 * Fire a moment and wait for it to finish — sequenced flows like
 * payment success → moment → receipt popup. Resolves immediately (short
 * beat) when moments are muted or the type is on cooldown.
 */
export const momentAndWait = (type, sub) => new Promise((resolve) => {
  window.dispatchEvent(new CustomEvent('dinedesk:moment', { detail: { type, sub, resolve } }));
});
