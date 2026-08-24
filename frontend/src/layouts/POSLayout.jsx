import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { daySessionAPI } from '../lib/api';
import { toast } from 'sonner';
import DayCloseReport from '../components/pos/DayCloseReport';
import TopBar from '../components/pos/TopBar';
import BottomNav from '../components/pos/BottomNav';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

export default function POSLayout() {
  const { user, restaurant, logout } = useAuth();
  const location = useLocation();

  const [isDayOpen, setIsDayOpen] = useState(false);
  const [currentSession, setCurrentSession] = useState(null);
  const [showDayOpenModal, setShowDayOpenModal] = useState(false);
  const [showDayCloseModal, setShowDayCloseModal] = useState(false);
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDayReport, setShowDayReport] = useState(false);
  const [reportSessionId, setReportSessionId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [todayOrders, setTodayOrders] = useState([]);

  useEffect(() => {
    fetchDaySession();
  }, []);

  useEffect(() => {
    if (isDayOpen) {
      fetchTodayOrders();
    }
  }, [isDayOpen]);

  const fetchDaySession = async () => {
    try {
      const res = await daySessionAPI.getCurrent();
      if (res.data) {
        setCurrentSession(res.data);
        setIsDayOpen(true);
      } else {
        setCurrentSession(null);
        setIsDayOpen(false);
      }
    } catch (err) {
      console.error('Failed to fetch day session:', err);
    }
  };

  const fetchTodayOrders = async () => {
    try {
      const { orderAPI } = await import('../lib/api');
      const res = await orderAPI.getToday();
      setTodayOrders(res.data || []);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    }
  };

  const handleOpenDay = async () => {
    setLoading(true);
    try {
      const res = await daySessionAPI.open(parseFloat(openingCash) || 0);
      setCurrentSession(res.data);
      setIsDayOpen(true);
      setShowDayOpenModal(false);
      setOpeningCash('');
      toast.success('Day opened successfully!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to open day');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseDay = async () => {
    setLoading(true);
    try {
      const res = await daySessionAPI.close(parseFloat(closingCash) || 0);
      setCurrentSession(null);
      setIsDayOpen(false);
      setShowDayCloseModal(false);
      setClosingCash('');
      toast.success(`Day closed! Total sales: ₹${res.data.total_sales.toFixed(2)}`);
      setReportSessionId(currentSession?.id);
      setShowDayReport(true);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to close day');
    } finally {
      setLoading(false);
    }
  };

  // Count open/active orders for BottomNav badge
  const activeOrdersCount = todayOrders.filter(
    (o) => o.status === 'pending' || o.status === 'preparing' || o.status === 'ready'
  ).length;

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col" data-testid="pos-layout">
      {/* Top Bar */}
      <TopBar
        cartCount={activeOrdersCount}
        onSearch={setSearchQuery}
      />

      {/* Day Status Banner */}
      {!isDayOpen && (
        <div className="bg-[#FFFBEB] border-b border-[#FDE68A] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse" />
            <div>
              <p className="font-medium text-[#92400E] text-sm">Day Not Open</p>
              <p className="text-xs text-[#D97706]">Open the day to start taking orders</p>
            </div>
          </div>
          <button
            onClick={() => setShowDayOpenModal(true)}
            className="on-btn-primary text-sm py-2 px-4"
          >
            Open Day
          </button>
        </div>
      )}

      {/* Day Open Indicator */}
      {isDayOpen && (
        <div className="bg-[#F0FDF4] border-b border-[#BBF7D0] px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse-dot" />
            <span className="text-sm font-medium text-[#16A34A]">Open</span>
          </div>
          <button
            onClick={() => setShowDayCloseModal(true)}
            className="text-xs font-medium text-[#6B7280] hover:text-[#1A1A1A] transition-colors"
          >
            Close Day
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 md:p-6 pb-20 md:pb-6">
        <Outlet context={{ isDayOpen, currentSession, refreshSession: fetchDaySession }} />
      </main>

      {/* Bottom Navigation (Mobile) */}
      <BottomNav orderCount={activeOrdersCount} />

      {/* Day Open Modal */}
      <Dialog open={showDayOpenModal} onOpenChange={setShowDayOpenModal}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Open Day</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="opening-cash" className="text-[#6B7280]">Opening Cash (₹)</Label>
            <Input
              id="opening-cash"
              type="number"
              value={openingCash}
              onChange={(e) => setOpeningCash(e.target.value)}
              placeholder="Enter opening cash amount"
              className="mt-2 h-12 rounded-xl"
            />
          </div>
          <DialogFooter className="gap-2">
            <button
              onClick={() => setShowDayOpenModal(false)}
              className="on-btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleOpenDay}
              disabled={loading}
              className="on-btn-primary"
            >
              {loading ? 'Opening...' : 'Open Day'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Day Close Modal */}
      <Dialog open={showDayCloseModal} onOpenChange={setShowDayCloseModal}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Close Day</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {currentSession && (
              <div className="bg-[#F8F9FA] p-4 rounded-xl space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[#6B7280]">Opening Cash:</span>
                  <span className="font-semibold">₹{currentSession.opening_cash.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#6B7280]">Total Orders:</span>
                  <span className="font-semibold">{currentSession.total_orders}</span>
                </div>
              </div>
            )}
            <div>
              <Label htmlFor="closing-cash" className="text-[#6B7280]">Closing Cash (₹)</Label>
              <Input
                id="closing-cash"
                type="number"
                value={closingCash}
                onChange={(e) => setClosingCash(e.target.value)}
                placeholder="Enter closing cash amount"
                className="mt-2 h-12 rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <button
              onClick={() => setShowDayCloseModal(false)}
              className="on-btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleCloseDay}
              disabled={loading}
              className="bg-[#EF4444] text-white font-semibold rounded-xl px-5 py-2.5 hover:bg-[#DC2626] transition-all"
            >
              {loading ? 'Closing...' : 'Close Day'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DayCloseReport
        sessionId={reportSessionId}
        open={showDayReport}
        onClose={() => setShowDayReport(false)}
      />
    </div>
  );
}
