import React, { useState, useEffect, useCallback } from 'react';
import { wastageAPI, inventoryAPI } from '../../lib/api';
import { toast } from 'sonner';
import { haptics } from '../../lib/haptics';
import { moment } from '../../components/pos/RestaurantMoments';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import CountUp from '../../components/ui/CountUp';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { Trash2, Plus, TrendingDown, TrendingUp, FileWarning, IndianRupee, Package, Sparkles } from 'lucide-react';

const REASONS = [
  { value: 'spoiled', label: 'Spoilage', hint: 'Went bad before use' },
  { value: 'expired', label: 'Past expiry', hint: 'Expired stock' },
  { value: 'damaged', label: 'Damaged', hint: 'Broken / unusable' },
  { value: 'overprep', label: 'Over-preparation', hint: 'Prepped too much' },
  { value: 'spillage', label: 'Spillage', hint: 'Accidental loss' },
  { value: 'other', label: 'Other', hint: 'Anything else' },
];

const REASON_STYLES = {
  spoiled: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
  expired: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  damaged: 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300',
  overprep: 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
  spillage: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300',
  other: 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300',
};

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function WastagePage() {
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logOpen, setLogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // form state
  const [invItemId, setInvItemId] = useState('');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const fetchData = useCallback(async (days = 30) => {
    setLoading(true);
    try {
      // Inventory loads independently — the Log Waste picker must work even
      // if a wastage endpoint hiccups on an older deploy.
      const [logsRes, sumRes, invRes] = await Promise.all([
        wastageAPI.list(days).catch(() => ({ data: [] })),
        wastageAPI.summary(7).catch(() => ({ data: null })),
        inventoryAPI.getAll().catch(() => ({ data: [] })),
      ]);
      setLogs(logsRes.data || []);
      setSummary(sumRes.data || null);
      setInventory(invRes.data || []);
    } catch {
      toast.error('Failed to load wastage data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const selectedItem = inventory.find(i => i.id === invItemId);
  const estCost = selectedItem ? (parseFloat(qty) || 0) * (selectedItem.cost_per_unit || 0) : 0;

  const handleLogWaste = async () => {
    if (!invItemId || !qty || parseFloat(qty) <= 0 || !reason) {
      toast.error('Pick an item, quantity and reason');
      return;
    }
    setSaving(true);
    try {
      await wastageAPI.create({ inventory_item_id: invItemId, quantity: parseFloat(qty), reason, notes: notes.trim() || null });
      toast.success(`Waste logged — ${fmt(estCost)} impact recorded`);
      moment('inventory_alert', 'Waste recorded — keep an eye on stock levels.');
      setLogOpen(false);
      setInvItemId(''); setQty(''); setReason(''); setNotes('');
      haptics.success();
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to log waste');
    } finally {
      setSaving(false);
    }
  };

  const changePct = summary?.change_pct;
  const wasteDown = changePct !== null && changePct !== undefined && changePct <= 0;

  return (
    <div className="space-y-4 md:space-y-5 animate-fade-in" data-testid="wastage-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-heading font-extrabold text-xl md:text-2xl text-slate-900 dark:text-white flex items-center gap-2">
            <Trash2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" /> Wastage Control
          </h1>
          <p className="text-sm text-slate-500 dark:text-white/50 mt-0.5">Every rupee of waste, tracked and explained.</p>
        </div>
        <Button
          onClick={() => setLogOpen(true)}
          className="h-11 rounded-xl bg-[#0F2417] dark:bg-[#2E9E5B] hover:bg-[#1a3d28] dark:hover:bg-[#2ba765] text-white font-bold px-5 shadow-md shadow-emerald-900/20 active:scale-[0.98] transition-all"
          data-testid="log-waste-btn"
        >
          <Plus className="w-4 h-4 mr-1.5" /> Log Waste
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-white/[0.04] rounded-2xl border border-slate-100 dark:border-white/[0.06] p-4 shadow-sm" data-testid="waste-total-card">
          <p className="text-[11px] font-bold tracking-wide text-slate-400 dark:text-white/40 uppercase">Waste cost · 7d</p>
          <p className="text-2xl font-extrabold font-numbers text-slate-900 dark:text-white mt-1.5 flex items-center gap-1">
            <IndianRupee className="w-5 h-5 text-slate-400" />
            <CountUp value={summary?.total_cost ?? 0} duration={800} format={(n) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
          </p>
          {changePct !== null && changePct !== undefined && (
            <p className={`text-[11px] font-bold mt-1 flex items-center gap-1 ${wasteDown ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {wasteDown ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
              {changePct > 0 ? '+' : ''}{changePct}% vs previous week
            </p>
          )}
        </div>
        <div className="bg-white dark:bg-white/[0.04] rounded-2xl border border-slate-100 dark:border-white/[0.06] p-4 shadow-sm">
          <p className="text-[11px] font-bold tracking-wide text-slate-400 dark:text-white/40 uppercase">Entries · 7d</p>
          <p className="text-2xl font-extrabold font-numbers text-slate-900 dark:text-white mt-1.5">
            <CountUp value={summary?.entries ?? 0} duration={600} />
          </p>
          <p className="text-[11px] text-slate-400 dark:text-white/40 mt-1">waste events logged</p>
        </div>
        <div className="bg-white dark:bg-white/[0.04] rounded-2xl border border-slate-100 dark:border-white/[0.06] p-4 shadow-sm">
          <p className="text-[11px] font-bold tracking-wide text-slate-400 dark:text-white/40 uppercase">Top reason</p>
          <p className="text-base font-bold text-slate-900 dark:text-white mt-2 truncate">
            {summary?.by_reason && Object.keys(summary.by_reason).length
              ? Object.entries(summary.by_reason).sort((a, b) => b[1] - a[1])[0][0]
              : '—'}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-white/40 mt-1">
            {summary?.by_reason && Object.keys(summary.by_reason).length
              ? `${fmt(Object.entries(summary.by_reason).sort((a, b) => b[1] - a[1])[0][1])} this week`
              : 'No waste logged yet'}
          </p>
        </div>
        <div className="bg-white dark:bg-white/[0.04] rounded-2xl border border-slate-100 dark:border-white/[0.06] p-4 shadow-sm">
          <p className="text-[11px] font-bold tracking-wide text-slate-400 dark:text-white/40 uppercase">Most wasted item</p>
          <p className="text-base font-bold text-slate-900 dark:text-white mt-2 truncate">{summary?.top_item?.[0] || '—'}</p>
          <p className="text-[11px] text-slate-400 dark:text-white/40 mt-1">{summary?.top_item ? `${summary.top_item[1]} units · ${fmt(summary.top_item[2])} lost` : 'Nothing wasted'}</p>
        </div>
      </div>

      {/* AI insight strip (from intelligence service, honest) */}
      {summary?.entries > 0 && (
        <div className="rounded-2xl bg-gradient-to-r from-[#0F2417] to-[#1B5A38] dark:from-[#0d1f14] dark:to-[#143524] text-white px-4 py-3 flex items-start gap-3 shadow-md" data-testid="waste-ai-strip">
          <Sparkles className="w-4 h-4 text-amber-300 mt-0.5 flex-shrink-0" />
          <p className="text-xs leading-relaxed text-white/90">
            <span className="font-bold">DineDesk Intelligence:</span>{' '}
            {summary?.change_pct !== null && summary?.change_pct !== undefined && summary.change_pct > 15
              ? `Waste cost is up ${summary.change_pct}% vs last week — review ${summary?.top_item?.[0] || 'top wasted items'} before tomorrow's prep.`
              : summary?.change_pct !== null && summary?.change_pct !== undefined && summary.change_pct < -15
                ? `Waste is down ${Math.abs(summary.change_pct)}% vs last week — current prep quantities are working well.`
                : `Waste held ${summary?.change_pct === 0 ? 'flat' : 'steady'} this week (${fmt(summary?.total_cost)}). Log every event to sharpen the trend.`}
            {' '}Advisory only — you decide.
          </p>
        </div>
      )}

      {/* History */}
      <div className="bg-white dark:bg-white/[0.04] rounded-2xl border border-slate-100 dark:border-white/[0.06] shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
          <h2 className="font-heading font-bold text-sm text-slate-900 dark:text-white">Waste log</h2>
          <span className="text-[11px] text-slate-400 dark:text-white/40">Last 30 days</span>
        </div>
        {loading ? (
          <div className="space-y-3" data-testid="wastage-skeleton">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-white/[0.04] border border-slate-100 dark:border-white/[0.06]">
                <Skeleton className="w-10 h-10 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-36 max-w-[50%] rounded-md" />
                  <Skeleton className="h-3 w-24 rounded-md" />
                </div>
                <Skeleton className="h-4 w-14 rounded-md" />
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4" data-testid="waste-empty">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center mb-3">
              <Package className="w-7 h-7 text-emerald-500" />
            </div>
            <p className="font-heading font-bold text-slate-700 dark:text-white/80">Zero waste logged</p>
            <p className="text-xs text-slate-400 dark:text-white/40 mt-1 max-w-xs">
              Log spoilage, damage and over-prep here — DineDesk turns it into cost insight over time.
            </p>
            <Button onClick={() => setLogOpen(true)} variant="outline" className="mt-4 rounded-xl h-10">
              <Plus className="w-4 h-4 mr-1" /> Log first entry
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-white/[0.04]">
            {logs.map((log) => (
              <div key={log.id} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors" data-testid={`waste-log-${log.id}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${REASON_STYLES[log.reason] || REASON_STYLES.other}`}>
                  <FileWarning className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{log.item_name}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${REASON_STYLES[log.reason] || REASON_STYLES.other}`}>
                      {log.reason_label || REASONS.find(r => r.value === log.reason)?.label || log.reason}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-white/40 mt-0.5 truncate">
                    {log.quantity}{log.unit ? ` ${log.unit}` : ''} · {new Date(log.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {log.logged_by_name ? ` · ${log.logged_by_name}` : ''}
                    {log.notes ? ` · "${log.notes}"` : ''}
                  </p>
                </div>
                <p className="text-sm font-extrabold font-numbers text-amber-600 dark:text-amber-400 flex-shrink-0">-{fmt(log.estimated_cost)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Log waste dialog */}
      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent className="rounded-2xl max-w-md" data-testid="log-waste-modal">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-emerald-600" /> Log Wastage
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3.5 py-1">
            <div>
              <Label className="text-xs text-slate-500 dark:text-white/50">Inventory item</Label>
              <Select value={invItemId} onValueChange={setInvItemId}>
                <SelectTrigger className="mt-1 h-11 rounded-xl" data-testid="waste-item-select">
                  <SelectValue placeholder="Pick an item" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {inventory.map(i => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name} ({i.quantity}{i.unit} in stock)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-500 dark:text-white/50">Quantity wasted</Label>
                <Input type="number" min="0" step="0.01" value={qty} onChange={e => setQty(e.target.value)}
                  placeholder="0.00" className="mt-1 h-11 rounded-xl" data-testid="waste-qty-input" />
                {selectedItem && <p className="text-[10px] text-slate-400 mt-1">Unit: {selectedItem.unit || 'units'}</p>}
              </div>
              <div>
                <Label className="text-xs text-slate-500 dark:text-white/50">Reason</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger className="mt-1 h-11 rounded-xl" data-testid="waste-reason-select">
                    <SelectValue placeholder="Why?" />
                  </SelectTrigger>
                  <SelectContent>
                    {REASONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-500 dark:text-white/50">Notes (optional)</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. left unlabeled in freezer"
                className="mt-1 h-11 rounded-xl" data-testid="waste-notes-input" />
            </div>
            {estCost > 0 && (
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 px-3.5 py-2.5 flex items-center justify-between" data-testid="waste-cost-preview">
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">Estimated cost impact</span>
                <span className="text-base font-extrabold font-numbers text-amber-700 dark:text-amber-300">{fmt(estCost)}</span>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setLogOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleLogWaste} disabled={saving}
              className="rounded-xl bg-[#0F2417] dark:bg-[#2E9E5B] hover:bg-[#1a3d28] dark:hover:bg-[#2ba765] text-white font-bold"
              data-testid="waste-save-btn">
              {saving ? 'Logging…' : 'Log Waste'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
