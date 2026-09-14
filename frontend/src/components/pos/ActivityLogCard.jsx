import React, { useState, useEffect } from 'react';
import { staffAPI } from '../../lib/api';
import { Card, CardContent } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { ScrollArea } from '../ui/scroll-area';
import { ShieldCheck } from 'lucide-react';

const ACTION_STYLES = {
  'order.cancel': { label: 'Order cancelled', cls: 'bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300' },
  'payment.capture': { label: 'Payment captured', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300' },
  'wastage.log': { label: 'Waste logged', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300' },
  'day.close': { label: 'Day closed', cls: 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-white/70' },
  'menu_item.delete': { label: 'Menu item deleted', cls: 'bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300' },
  'category.delete': { label: 'Category deleted', cls: 'bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300' },
  'inventory.delete': { label: 'Inventory deleted', cls: 'bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300' },
  'staff.delete': { label: 'Staff removed', cls: 'bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300' },
  'branch.delete': { label: 'Branch deleted', cls: 'bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300' },
  'purchase_order.cancel': { label: 'PO cancelled', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300' },
};

const relTime = (iso) => {
  const d = new Date(iso);
  const mins = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

/**
 * DineDesk Guard — Activity Log card.
 * Shows the immutable who/when/why trail of sensitive actions.
 * Owner/manager only (backend enforces the same rule).
 */
export default function ActivityLogCard({ canView }) {
  const [logs, setLogs] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!canView) return;
    let alive = true;
    staffAPI.auditLogs({ limit: 30 })
      .then((res) => { if (alive) setLogs(res.data); })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [canView]);

  if (!canView) return null;

  return (
    <Card className="border-slate-100 dark:border-white/[0.06] shadow-sm overflow-hidden" data-testid="activity-log-card">
      <CardContent className="p-0">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-white/[0.06]">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <h3 className="font-heading font-bold text-sm text-slate-900 dark:text-white">Activity Log</h3>
          <span className="text-[10px] text-slate-400 dark:text-white/40 ml-auto">Every sensitive action, recorded</span>
        </div>
        <ScrollArea className="max-h-[320px]">
          <div className="divide-y divide-slate-50 dark:divide-white/[0.04]">
            {logs === null && !error && (
              [...Array(4)].map((_, i) => (
                <div key={i} className="px-4 py-3 space-y-1.5">
                  <Skeleton className="h-3.5 w-40 rounded-md" />
                  <Skeleton className="h-3 w-64 max-w-full rounded-md" />
                </div>
              ))
            )}
            {error && (
              <p className="px-4 py-4 text-xs text-slate-400 dark:text-white/40">Activity log unavailable right now.</p>
            )}
            {logs && logs.length === 0 && (
              <p className="px-4 py-4 text-xs text-slate-400 dark:text-white/40">No sensitive actions recorded yet — a calm restaurant.</p>
            )}
            {logs && logs.map((log) => {
              const style = ACTION_STYLES[log.action] || { label: log.action, cls: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-white/60' };
              return (
                <div key={log.id} className="px-4 py-2.5 flex items-start gap-2.5" data-testid="audit-log-row">
                  <span className={`mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${style.cls}`}>{style.label}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-700 dark:text-white/70 leading-snug">{log.summary || log.entity_label || ''}</p>
                    <p className="text-[10px] text-slate-400 dark:text-white/40 mt-0.5">
                      {log.user_name} · {log.user_role} · {relTime(log.created_at)}
                      {log.reason ? ` · ${log.reason}` : ''}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
