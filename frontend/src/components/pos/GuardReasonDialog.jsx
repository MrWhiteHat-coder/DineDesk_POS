import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { ShieldAlert, Loader2 } from 'lucide-react';

/**
 * DineDesk Guard — reason capture for sensitive, audited actions.
 * Cancel/delete/wastage-type actions must never happen silently: this small
 * dialog asks WHY and forwards the reason to the audited endpoint.
 *
 * Usage:
 *   guard.confirm({ title, description, confirmLabel, action: (reason) => api(...) })
 */
export default function GuardReasonDialog() {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handler = (e) => {
      setConfig(e.detail);
      setReason('');
      setError('');
      setBusy(false);
      setOpen(true);
    };
    window.addEventListener('dinedesk:guard-confirm', handler);
    return () => window.removeEventListener('dinedesk:guard-confirm', handler);
  }, []);

  if (!open || !config) return null;

  const handleConfirm = async () => {
    if (reason.trim().length < 3) {
      setError('Please give a short reason (min 3 characters)');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await config.action(reason.trim());
      setOpen(false);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Action failed — nothing was changed');
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) setOpen(v); }}>
      <DialogContent className="max-w-sm rounded-2xl" data-testid="guard-reason-dialog">
        <DialogHeader>
          <div className="w-11 h-11 rounded-full bg-amber-50 dark:bg-amber-400/10 flex items-center justify-center mb-1">
            <ShieldAlert className="w-5.5 h-5.5 text-amber-600 dark:text-amber-400" />
          </div>
          <DialogTitle className="font-heading text-left">{config.title || 'Confirm action'}</DialogTitle>
          <DialogDescription className="text-left">
            {config.description || 'This action is recorded in the activity log with your name and time.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <label htmlFor="guard-reason" className="text-xs font-semibold text-slate-500 dark:text-white/50">
            Reason <span className="text-rose-500">*</span>
          </label>
          <Textarea
            id="guard-reason"
            value={reason}
            onChange={(e) => { setReason(e.target.value); setError(''); }}
            placeholder={config.placeholder || 'e.g. Customer changed their mind'}
            rows={3}
            autoFocus
            disabled={busy}
            data-testid="guard-reason-input"
          />
          {error && <p className="text-xs text-rose-500 font-medium" role="alert">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy} className="rounded-xl min-h-[44px]">
            Keep as is
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={busy || reason.trim().length < 3}
            className="rounded-xl min-h-[44px] bg-[#0F2417] hover:bg-[#1a3d28] dark:bg-[#2E9E5B] dark:hover:bg-[#2ba765] text-white"
            data-testid="guard-confirm-btn"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : (config.confirmLabel || 'Confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Fire the guard dialog: guard.confirm({ title, description, action }) */
export const guard = {
  confirm: (config) => window.dispatchEvent(new CustomEvent('dinedesk:guard-confirm', { detail: config })),
};
