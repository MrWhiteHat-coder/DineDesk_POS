import React, { useState, useEffect, useRef } from 'react';
import { dayReportAPI } from '../../lib/api';
import { toast } from 'sonner';
import { FileText, Printer, IndianRupee, ShoppingCart, Clock, TrendingUp, CreditCard, Banknote, Smartphone, Download, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ReactMarkdown from 'react-markdown';

export default function DayCloseReport({ sessionId, open, onClose }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiInsights, setAiInsights] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const printRef = useRef(null);

  useEffect(() => {
    if (sessionId && open) {
      setLoading(true);
      setAiInsights('');
      dayReportAPI.get(sessionId).then(res => {
        setReport(res.data);
        fetchAiInsights();
      }).catch(() => toast.error('Failed to load report')).finally(() => setLoading(false));
    }
  }, [sessionId, open]);

  const fetchAiInsights = async () => {
    setAiLoading(true);
    try {
      const res = await dayReportAPI.getAiInsights(sessionId);
      setAiInsights(res.data.insights || '');
    } catch {
      setAiInsights('AI insights temporarily unavailable.');
    } finally {
      setAiLoading(false);
    }
  };

  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=700,height=900');
    win.document.write(`<html><head><title>Day Close Report</title><style>body{font-family:system-ui,-apple-system,sans-serif;font-size:13px;max-width:650px;margin:0 auto;padding:20px}h1{font-size:20px;text-align:center;margin-bottom:4px}h2{font-size:15px;border-bottom:1px solid #ddd;padding-bottom:4px;margin:16px 0 8px}.row{display:flex;justify-content:space-between;padding:3px 0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}table{width:100%;border-collapse:collapse;margin:8px 0}th,td{text-align:left;padding:4px 8px;border-bottom:1px solid #eee}th{font-weight:600;background:#f5f5f5}.center{text-align:center}.bold{font-weight:bold}.big{font-size:18px}</style></head><body>`);
    win.document.write(printRef.current?.innerHTML || '');
    win.document.write('</body></html>');
    win.document.close();
    win.print();
  };

  const handleDownloadPdf = async () => {
    try {
      toast.info('Generating PDF report...');
      const res = await dayReportAPI.getPdf(sessionId);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      // Open in new tab for viewing
      window.open(url, '_blank');
      // Also trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = `day-report-${report?.session?.date || 'report'}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      toast.error('Failed to generate PDF');
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="rounded-2xl max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="day-close-report-modal">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5" /> Day Close Report</DialogTitle>
            {report && (
              <div className="flex items-center gap-2">
                <Button onClick={handleDownloadPdf} variant="outline" className="h-8 rounded-lg text-xs gap-1.5" data-testid="download-pdf-btn">
                  <Download className="w-3.5 h-3.5" /> PDF
                </Button>
                <Button onClick={handlePrint} variant="outline" className="h-8 rounded-lg text-xs gap-1.5" data-testid="print-report-btn">
                  <Printer className="w-3.5 h-3.5" /> Print
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-4 border-slate-800 border-t-transparent rounded-full animate-spin" /></div>
        ) : report ? (
          <div ref={printRef} className="space-y-5">
            {/* Header */}
            <div className="text-center border-b border-slate-200 pb-3">
              <h1 className="text-lg font-bold text-slate-900">Daily Sales Report</h1>
              <p className="text-sm text-slate-500">{report.session.date} | {report.session.opened_at && new Date(report.session.opened_at).toLocaleTimeString()} - {report.session.closed_at ? new Date(report.session.closed_at).toLocaleTimeString() : 'Ongoing'}</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-green-50 rounded-xl p-3 border border-green-200">
                <IndianRupee className="w-5 h-5 text-green-600 mb-1" />
                <p className="text-xs text-green-600">Total Sales</p>
                <p className="text-xl font-bold text-green-700">₹{report.summary.total_sales.toFixed(2)}</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 border border-blue-200">
                <ShoppingCart className="w-5 h-5 text-blue-600 mb-1" />
                <p className="text-xs text-blue-600">Orders</p>
                <p className="text-xl font-bold text-blue-700">{report.summary.total_orders}</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-3 border border-purple-200">
                <TrendingUp className="w-5 h-5 text-purple-600 mb-1" />
                <p className="text-xs text-purple-600">Avg Order</p>
                <p className="text-xl font-bold text-purple-700">₹{report.summary.average_order_value.toFixed(0)}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                <Clock className="w-5 h-5 text-slate-600 mb-1" />
                <p className="text-xs text-slate-600">Pending</p>
                <p className="text-xl font-bold text-slate-700">{report.summary.pending_orders}</p>
              </div>
            </div>

            {/* Payment Breakdown */}
            <div>
              <h2 className="text-sm font-bold text-slate-900 mb-2 border-b border-slate-200 pb-1">Payment Breakdown</h2>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex items-center gap-2 bg-green-50 p-2.5 rounded-lg border border-green-200">
                  <Banknote className="w-5 h-5 text-green-600" />
                  <div><p className="text-[10px] text-green-600">Cash</p><p className="font-bold text-green-700">₹{(report.payment_breakdown.cash || 0).toFixed(2)}</p></div>
                </div>
                <div className="flex items-center gap-2 bg-blue-50 p-2.5 rounded-lg border border-blue-200">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                  <div><p className="text-[10px] text-blue-600">Card</p><p className="font-bold text-blue-700">₹{(report.payment_breakdown.card || 0).toFixed(2)}</p></div>
                </div>
                <div className="flex items-center gap-2 bg-purple-50 p-2.5 rounded-lg border border-purple-200">
                  <Smartphone className="w-5 h-5 text-purple-600" />
                  <div><p className="text-[10px] text-purple-600">UPI</p><p className="font-bold text-purple-700">₹{(report.payment_breakdown.upi || 0).toFixed(2)}</p></div>
                </div>
              </div>
            </div>

            {/* Cash Summary */}
            <div>
              <h2 className="text-sm font-bold text-slate-900 mb-2 border-b border-slate-200 pb-1">Cash Drawer</h2>
              <div className="bg-slate-50 rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-slate-600">Opening Cash</span><span className="font-semibold">₹{report.cash_summary.opening_cash.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Cash Sales</span><span className="font-semibold text-green-600">+₹{report.cash_summary.cash_sales.toFixed(2)}</span></div>
                <div className="flex justify-between border-t border-slate-200 pt-1"><span className="text-slate-600">Expected Cash</span><span className="font-bold">₹{report.cash_summary.expected_cash.toFixed(2)}</span></div>
                {report.cash_summary.closing_cash !== null && (
                  <>
                    <div className="flex justify-between"><span className="text-slate-600">Closing Cash</span><span className="font-semibold">₹{report.cash_summary.closing_cash.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-600">Difference</span><span className={`font-bold ${report.cash_summary.difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>₹{report.cash_summary.difference?.toFixed(2)}</span></div>
                  </>
                )}
              </div>
            </div>

            {/* Top Items */}
            {report.top_items.length > 0 && (
              <div>
                <h2 className="text-sm font-bold text-slate-900 mb-2 border-b border-slate-200 pb-1">Top Selling Items</h2>
                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-slate-50"><th className="text-left px-3 py-2 font-semibold text-slate-600">Item</th><th className="text-right px-3 py-2 font-semibold text-slate-600">Qty</th><th className="text-right px-3 py-2 font-semibold text-slate-600">Revenue</th></tr></thead>
                    <tbody>
                      {report.top_items.map((item, i) => (
                        <tr key={i} className="border-t border-slate-100"><td className="px-3 py-1.5 text-slate-800">{item.name}</td><td className="px-3 py-1.5 text-right text-slate-600">{item.quantity}</td><td className="px-3 py-1.5 text-right font-semibold text-slate-800">₹{item.revenue.toFixed(2)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Hourly Chart */}
            {report.hourly_breakdown.length > 0 && (
              <div>
                <h2 className="text-sm font-bold text-slate-900 mb-2 border-b border-slate-200 pb-1">Hourly Breakdown</h2>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={report.hourly_breakdown}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="revenue" fill="#1E293B" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* AI Insights */}
            <div>
              <h2 className="text-sm font-bold text-slate-900 mb-2 border-b border-slate-200 pb-1 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" /> AI Insights & Tomorrow's Suggestions
              </h2>
              {aiLoading ? (
                <div className="flex items-center gap-2 py-6 justify-center text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Generating AI insights...</span>
                </div>
              ) : aiInsights ? (
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 prose prose-sm max-w-none text-slate-700" data-testid="ai-insights-section">
                  <ReactMarkdown>{aiInsights}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-slate-400 text-sm text-center py-4">No AI insights available</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-center text-slate-400 py-8">No report data available</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
