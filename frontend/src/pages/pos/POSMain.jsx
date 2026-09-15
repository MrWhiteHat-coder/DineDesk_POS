import Lottie from 'lottie-react';
import foodDeliveredAnimation from '../../assets/food-delivered.json';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { menuAPI, orderAPI, tableAPI, receiptAPI, customerAPI } from '../../lib/api';
import { createOrderResilient } from '../../lib/resilientOrder';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Skeleton } from '../../components/ui/skeleton';
import { ScrollArea } from '../../components/ui/scroll-area';
import { ChefShrugging, ChefWinking } from '../../components/illustrations/ChefBot';
import haptics from '../../lib/haptics';
import { moment } from '../../components/pos/RestaurantMoments';
import useDragToDismiss from '../../lib/useDragToDismiss';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { Label } from '../../components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import {
  Plus, Minus, Trash2, ShoppingCart, Search, AlertCircle, X, RefreshCw, Tag,
  Banknote, CreditCard, Smartphone, Utensils, Printer, Check, User, Wallet,
  StickyNote, ChevronRight, Sparkles,
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const getImageUrl = (url) => { if (!url) return null; if (url.startsWith('http')) return url; return `${API_URL}${url}`; };
const FALLBACK_IMG = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=400&fit=crop';
const round2 = (n) => Math.round(n * 100) / 100;

export default function POSMain() {
  const { isDayOpen } = useOutletContext();
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [tables, setTables] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [cart, setCart] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [orderType, setOrderType] = useState('dine_in');
  const [tableNumber, setTableNumber] = useState('');
  const [applyDiscount, setApplyDiscount] = useState(false);
  const [editingNotesId, setEditingNotesId] = useState(null);

  /* Mobile cart sheet: swipe down to close (native feel) */
  const { dragRef: cartDragRef, dragHandlers: cartDragHandlers } = useDragToDismiss({
    onDismiss: () => setMobileCartOpen(false),
  });
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [runningOrders, setRunningOrders] = useState([]);
  const [selectedRunningOrder, setSelectedRunningOrder] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const receiptRef = useRef(null);
  const [paymentSplits, setPaymentSplits] = useState([{ method: 'cash', amount: 0 }]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  /* Walk-in: customer declined to share details — skip name/phone requirement */
  const [isWalkIn, setIsWalkIn] = useState(true); // counters punch walk-ins by default — details are opt-in
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestTimeout = useRef(null);

  const lookupCustomer = useCallback((phone) => {
    if (suggestTimeout.current) clearTimeout(suggestTimeout.current);
    if (phone.length < 3) { setSuggestions([]); return; }
    suggestTimeout.current = setTimeout(async () => {
      try { const res = await customerAPI.lookup(phone); setSuggestions(res.data); setShowSuggestions(res.data.length > 0); } catch { setSuggestions([]); }
    }, 300);
  }, []);
  const selectCustomer = (c) => { setCustomerName(c.name || ''); setCustomerPhone(c.phone || ''); setCustomerEmail(c.email || ''); setShowSuggestions(false); };

  const fetchAndShowReceipt = async (orderId) => {
    try { const rcpt = await receiptAPI.get(orderId); setReceiptData(rcpt.data); setShowReceipt(true); } catch (err) { console.error(err); }
  };
  const handlePrintReceipt = () => {
    if (!receiptRef.current) return;
    const win = window.open('', '_blank', 'width=320,height=600');
    if (!win) return;
    const style = win.document.createElement('style');
    style.textContent = 'body{font-family:monospace;font-size:12px;width:280px;margin:0 auto;padding:10px}h2{text-align:center;margin:4px 0}hr{border:none;border-top:1px dashed #000;margin:6px 0}.row{display:flex;justify-content:space-between}.center{text-align:center}p{margin:2px 0}';
    win.document.head.appendChild(style);
    win.document.title = 'Receipt';
    win.document.body.innerHTML = receiptRef.current.innerHTML;
    win.print();
  };

  useEffect(() => { fetchMenu(); fetchTables(); fetchRunningOrders(); generateOrderNumber(); }, []); // eslint-disable-line react-hooks/exhaustive-deps -- mount-only init
  const generateOrderNumber = () => setOrderNumber(`B${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`);
  const fetchMenu = async () => {
    try { const [catRes, itemsRes] = await Promise.all([menuAPI.getCategories(), menuAPI.getItems()]); setCategories(catRes.data); setMenuItems(itemsRes.data); } catch (err) { console.error(err); } finally { setLoading(false); }
  };
  const fetchTables = async () => { try { const res = await tableAPI.getAll(); setTables(res.data); } catch {} };
  const fetchRunningOrders = async () => { try { const res = await orderAPI.getRunning(); setRunningOrders(res.data); /* Keep the selected bill's money in sync — a stale snapshot would charge the old total at settle time */ setSelectedRunningOrder(prev => prev ? (res.data.find(o => o.id === prev.id) || null) : null); } catch {} };

  const availableTables = tables.filter(t => t.status === 'available');
  const filteredItems = menuItems.filter((item) => {
    const matchCat = !selectedCategory || item.category_id === selectedCategory;
    const matchSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  const addToCart = (item) => {
    if (!isDayOpen) { toast.error('Please open the day first'); return; }
    if (!item.is_available) { toast.error('Item not available'); return; }
    haptics.tick();
    setCart((prev) => { const ex = prev.find(c => c.item.id === item.id); if (ex) return prev.map(c => c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c); return [...prev, { item, quantity: 1, notes: '' }]; });
  };
  const getCartQuantity = (id) => cart.find(c => c.item.id === id)?.quantity || 0;
  const updateQuantity = (id, d) => setCart(prev => prev.map(c => c.item.id === id ? { ...c, quantity: Math.max(0, c.quantity + d) } : c).filter(c => c.quantity > 0));
  const removeFromCart = (id) => setCart(prev => prev.filter(c => c.item.id !== id));
  const clearCart = () => { setCart([]); generateOrderNumber(); setSelectedRunningOrder(null); setCustomerName(''); setCustomerPhone(''); setCustomerEmail(''); setIsWalkIn(false); };
  const updateNotes = (id, notes) => setCart(prev => prev.map(c => c.item.id === id ? { ...c, notes } : c));

  const subtotal = cart.reduce((s, c) => s + c.item.price * c.quantity, 0);
  const discountAmount = applyDiscount && subtotal >= 50 ? subtotal * 0.1 : 0;
  const taxAmount = (subtotal - discountAmount) * 0.05;
  /* Running order: charge only the DELTA on top of the server's authoritative
     total — extra units of existing items AND brand-new items. The original
     order was already priced by the backend; re-computing from the merged
     cart double-counts existing items, and ignoring quantity increases on
     existing items silently undercharges. */
  const serverQtyMap = {};
  (selectedRunningOrder?.items || []).forEach(i => { serverQtyMap[i.menu_item_id] = (serverQtyMap[i.menu_item_id] || 0) + i.quantity; });
  const deltaSubtotal = selectedRunningOrder
    ? cart.reduce((s, c) => s + c.item.price * Math.max(0, c.quantity - (serverQtyMap[c.item.id] || 0)), 0)
    : 0;
  const deltaDiscount = applyDiscount && deltaSubtotal >= 50 ? deltaSubtotal * 0.1 : 0;
  const deltaTax = (deltaSubtotal - deltaDiscount) * 0.05;
  const total = selectedRunningOrder
    ? round2(selectedRunningOrder.total_amount + deltaSubtotal + deltaTax - deltaDiscount)
    : round2(subtotal + taxAmount - discountAmount);
  /* New items not yet sent to the kitchen — Update must run before Settle,
     otherwise the guest would pay for food the order doesn't contain yet. */
  const hasOrderChanges = selectedRunningOrder
    ? cart.some(c => {
        const base = (selectedRunningOrder.items || []).filter(i => i.menu_item_id === c.item.id).reduce((s, i) => s + i.quantity, 0);
        return c.quantity > base;
      })
    : false;

  /* "Complete your meal with" — top 6 available items not already in cart,
     sorted by price desc (chef's picks feel, like the reference app). */
  const availableUpsell = menuItems
    .filter(i => i.is_available && !cart.some(c => c.item.id === i.id))
    .sort((a, b) => b.price - a.price)
    .slice(0, 6);

  const handlePlaceOrder = async () => {
    if (cart.length === 0) { toast.error('Cart is empty'); return; }
    if (!isWalkIn) {
      if (!customerName.trim()) { toast.error('Customer name is required — or mark as Walk-in'); return; }
      if (!customerPhone.trim()) { toast.error('Customer phone is required — or mark as Walk-in'); return; }
    }
    if (orderType === 'dine_in') {
      if (selectedRunningOrder) {
        setCheckoutLoading(true);
        try {
          /* Compute the delta per item against the server's current quantities:
             - qty grew (2x → 4x)  → add the difference (2)
             - qty same            → nothing
             - qty shrank or item removed → blocked below (bills only grow) */
          const serverQty = {};
          (selectedRunningOrder.items || []).forEach(i => { serverQty[i.menu_item_id] = (serverQty[i.menu_item_id] || 0) + i.quantity; });
          const deltas = [];
          for (const c of cart) {
            const base = serverQty[c.item.id] || 0;
            if (c.quantity > base) deltas.push({ menu_item_id: c.item.id, quantity: c.quantity - base, notes: c.notes || null });
          }
          if (deltas.length === 0) { setCheckoutLoading(false); handleReleaseAndPay(selectedRunningOrder.id); return; }
          await orderAPI.addItems(selectedRunningOrder.id, { items: deltas });
          haptics.success();
          toast.success('Order updated!'); moment('order_placed');
          clearCart();
          await fetchRunningOrders(); fetchTables();
          // Reopen the bill so the fresh total is ready to settle — waiters
          // shouldn't have to re-find the running order chip after every update
          const updated = (await orderAPI.getRunning()).data.find(o => o.id === selectedRunningOrder.id);
          if (updated) { setSelectedRunningOrder(updated); setCart([]); setMobileCartOpen(true); }
        } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); } finally { setCheckoutLoading(false); }
        return;
      }
      if (!tableNumber) { toast.error('Please select a table'); return; }
      setCheckoutLoading(true);
      try {
        const result = await createOrderResilient({ order_type: 'dine_in', table_number: parseInt(tableNumber), items: cart.map(c => ({ menu_item_id: c.item.id, quantity: c.quantity, notes: c.notes || null })), payment_method: 'pending', discount_amount: discountAmount, customer_name: isWalkIn ? 'Walk-in Customer' : customerName.trim(), customer_phone: isWalkIn ? null : customerPhone.trim(), customer_email: (!isWalkIn && customerEmail.trim()) || null }, { total });
        haptics.success();
        if (!result.online) { toast.info('Saved offline — will sync automatically when back online'); moment('no_internet'); }
        else { toast.success(`Order #${result.data.order_number} placed!`); moment(isWalkIn ? 'new_customer' : 'sending_kitchen'); }
        clearCart(); setTableNumber(''); fetchRunningOrders(); fetchTables();
      } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); } finally { setCheckoutLoading(false); }
    } else { openPaymentModal(); }
  };

  const totalPaid = paymentSplits.reduce((sum, s) => sum + (s.amount || 0), 0);
  const remaining = Math.max(0, total - totalPaid);
  const change = Math.max(0, totalPaid - total);

  const updateSplitAmount = (index, amount) => {
    setPaymentSplits(prev => prev.map((s, i) => i === index ? { ...s, amount: parseFloat(amount) || 0 } : s));
  };
  const updateSplitMethod = (index, method) => {
    setPaymentSplits(prev => prev.map((s, i) => i === index ? { ...s, method } : s));
  };
  const addSplit = () => {
    if (paymentSplits.length < 3 && remaining > 0) {
      setPaymentSplits(prev => [...prev, { method: 'upi', amount: remaining }]);
    }
  };
  const removeSplit = (index) => {
    if (paymentSplits.length > 1) {
      setPaymentSplits(prev => prev.filter((_, i) => i !== index));
    }
  };
  const openPaymentModal = () => {
    // Base the ask on the authoritative server total (running order) or the
    // current cart total — never on a leftover split from a previous bill
    const billTotal = selectedRunningOrder ? selectedRunningOrder.total_amount : total;
    setPaymentSplits([{ method: 'cash', amount: billTotal }]);
    setShowPaymentModal(true);
  };

  const handleCheckoutWithPayment = async () => {
    if (totalPaid < total) { toast.error('Payment is less than total amount'); return; }
    setCheckoutLoading(true);
    try {
      const payload = {
        order_type: orderType, table_number: null,
        items: cart.map(c => ({ menu_item_id: c.item.id, quantity: c.quantity, notes: c.notes || null })),
        discount_amount: discountAmount,
        customer_name: isWalkIn ? 'Walk-in Customer' : customerName.trim(), customer_phone: isWalkIn ? null : customerPhone.trim(), customer_email: (!isWalkIn && customerEmail.trim()) || null,
        change_amount: change,
      };
      if (paymentSplits.length === 1) {
        payload.payment_method = paymentSplits[0].method;
      } else {
        payload.payment_method = 'split';
        payload.payment_splits = paymentSplits.map(s => ({ method: s.method, amount: s.amount }));
      }
      const result = await createOrderResilient(payload, { total });
      if (!result.online) {
        toast.info('Order saved offline with payment recorded — syncs automatically when back online');
        moment('no_internet');
      } else {
        toast.success(`Order #${result.data.order_number} completed!`);
        moment(orderType === 'dine_in' ? 'table_cleaned' : 'payment_success');
        await fetchAndShowReceipt(result.data.id);
      }
      clearCart(); setShowPaymentModal(false);
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); } finally { setCheckoutLoading(false); }
  };

  const handleReleaseAndPay = async (orderId) => {
    // Guard: new items must reach the order before money changes hands
    if (hasOrderChanges) {
      setCheckoutLoading(true);
      try {
        const serverQty = {};
        (selectedRunningOrder.items || []).forEach(i => { serverQty[i.menu_item_id] = (serverQty[i.menu_item_id] || 0) + i.quantity; });
        const deltas = [];
        for (const c of cart) {
          const base = serverQty[c.item.id] || 0;
          if (c.quantity > base) deltas.push({ menu_item_id: c.item.id, quantity: c.quantity - base, notes: c.notes || null });
        }
        if (deltas.length > 0) await orderAPI.addItems(selectedRunningOrder.id, { items: deltas });
        clearCart();
        const updated = (await orderAPI.getRunning()).data.find(o => o.id === orderId);
        if (updated) {
          setSelectedRunningOrder(updated);
          // Seed the ask from the FRESH server total — the closure's
          // selectedRunningOrder is still the stale snapshot here
          setPaymentSplits([{ method: 'cash', amount: round2(updated.total_amount) }]);
          setShowPaymentModal(true);
          toast.info('Items added — settle the fresh bill now');
          return;
        }
      } catch (err) { toast.error(err.response?.data?.detail || 'Failed to update order'); setCheckoutLoading(false); return; }
      setCheckoutLoading(false);
    }
    openPaymentModal();
  };

  /* Called from the payment modal's confirm button — money moment only. */
  const confirmRunningOrderPayment = async (orderId) => {
    if (totalPaid < total) { toast.error('Payment is less than total amount'); return; }
    try {
      const payload = { change_amount: change };
      if (paymentSplits.length === 1) {
        payload.payment_method = paymentSplits[0].method;
      } else {
        payload.payment_method = 'split';
        payload.payment_splits = paymentSplits.map(s => ({ method: s.method, amount: s.amount }));
      }
      await orderAPI.pay(orderId, payload);
      toast.success('Payment confirmed!'); moment('payment_success'); await fetchAndShowReceipt(orderId); fetchRunningOrders(); fetchTables(); clearCart(); setSelectedRunningOrder(null); setShowPaymentModal(false);
    } catch (err) { toast.error(err.response?.data?.detail || 'Payment failed'); }
  };

  const selectRunningOrder = (order) => {
    setSelectedRunningOrder(order); setOrderType('dine_in'); setTableNumber(order.table_number?.toString() || '');
    setCustomerName(order.customer_name || '');
    setCustomerPhone(order.customer_phone || '');
    setCustomerEmail(order.customer_email || '');
    // Walk-in orders come back from the server as "Walk-in Customer" with no
    // phone — restore the walk-in flag so payment isn't blocked by validation
    // that only applies to new orders (bug: "Customer phone is required").
    setIsWalkIn(!order.customer_phone && (!order.customer_name || order.customer_name === 'Walk-in Customer'));
    /* Merge server lines by menu_item_id so repeated lines of the same dish
       (e.g. two rounds of coffee added separately) become one cart row —
       otherwise delta math and the qty stepper desync from the server. */
    const merged = {};
    (order.items || []).forEach(item => {
      if (merged[item.menu_item_id]) { merged[item.menu_item_id].quantity += item.quantity; merged[item.menu_item_id].notes = [merged[item.menu_item_id].notes, item.notes].filter(Boolean).join(' · '); }
      else {
        const mi = menuItems.find(m => m.id === item.menu_item_id);
        merged[item.menu_item_id] = { item: mi || { id: item.menu_item_id, name: item.name, price: item.price, image_url: null, is_available: true }, quantity: item.quantity, notes: item.notes || '', isExisting: true };
      }
    });
    setCart(Object.values(merged));
  };

  const getCategoryCount = (catId) => menuItems.filter(i => i.category_id === catId).length;

  /* Mobile: the cart panel becomes a bottom sheet so checkout is always
     one tap away instead of buried below the menu. Desktop keeps the
     inline sidebar — same panel, two presentations. */
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  useEffect(() => { if (cart.length === 0) setMobileCartOpen(false); }, [cart.length]);

  if (loading) return (
    <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 lg:h-[calc(100vh_-_7rem)] animate-fade-in">
      <div className="flex-1">
        <div className="flex gap-2 mb-4"><Skeleton className="h-9 w-16 rounded-lg" /><Skeleton className="h-9 w-20 rounded-lg" /><Skeleton className="h-9 w-24 rounded-lg" /></div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2.5 md:gap-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="aspect-[4/3] rounded-xl" />)}
        </div>
      </div>
      <Skeleton className="w-full lg:w-[320px] h-96 rounded-xl flex-shrink-0" />
    </div>
  );

  /* "Complete your meal with" strip — renders in cart (with items) and empty state */
  const upsellStrip = availableUpsell.length > 0 && (
    <div className="pt-1" data-testid="cart-upsell">
      <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5 mb-2.5">
        <Sparkles className="w-3.5 h-3.5 text-emerald-500" /> Complete your meal with
      </p>
      <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-1 px-1">
        {availableUpsell.map(item => (
          <div key={item.id} className="relative w-24 flex-shrink-0 rounded-xl overflow-hidden bg-white border border-slate-100 shadow-sm">
            <div className="relative aspect-square bg-slate-100">
              <img src={getImageUrl(item.image_url) || FALLBACK_IMG} alt={item.name} className="w-full h-full object-cover" onError={e => { e.target.src = FALLBACK_IMG; }} />
              <button
                onClick={() => addToCart(item)}
                className="absolute bottom-1 right-1 w-7 h-7 rounded-lg bg-[#2E9E5B] text-white flex items-center justify-center shadow-md active:scale-90 transition-transform"
                aria-label={`Add ${item.name}`}
                data-testid={`upsell-add-${item.id}`}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="p-1.5">
              <p className="text-[10px] font-semibold text-slate-800 truncate leading-tight">{item.name}</p>
              <p className="text-[10px] font-bold text-slate-500 font-numbers">₹{item.price.toFixed(0)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 lg:h-[calc(100vh_-_7rem)] animate-fade-in" data-testid="pos-main">
      {/* Left: Menu Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:min-h-0">
        {/* Running Orders */}
        {runningOrders.length > 0 && (
          <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs text-slate-500 whitespace-nowrap font-medium">Running:</span>
            {runningOrders.map(ro => (
              <button key={ro.id} onClick={() => selectRunningOrder(ro)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap border transition-all ${selectedRunningOrder?.id === ro.id ? 'bg-[#0F2417] text-white border-[#0F2417]' : 'bg-slate-50 text-slate-600 hover:bg-slate-50'}`} data-testid={`running-order-${ro.id}`}>
                <Utensils className="w-3 h-3" /> T-{ro.table_number} #{ro.order_number?.slice(-4)}
              </button>
            ))}
            {selectedRunningOrder && <button onClick={() => { setSelectedRunningOrder(null); setCart([]); }} className="text-xs text-slate-400 hover:text-slate-600 ml-1"><X className="w-3.5 h-3.5" /></button>}
          </div>
        )}

        {/* Category Tabs + Search */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 md:gap-4 mb-3 md:mb-4">
          <div className="flex items-center gap-2 overflow-x-auto flex-1 pb-1 w-full md:w-auto">
            <button onClick={() => setSelectedCategory(null)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all min-h-[40px] ${!selectedCategory ? 'bg-[#0F2417] text-white shadow-md shadow-emerald-900/20' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:border-gray-300'}`} data-testid="category-all">
              All <span className={`text-xs px-1.5 py-0.5 rounded-md ${!selectedCategory ? 'bg-white/20' : 'bg-gray-100'}`}>{menuItems.length}</span>
            </button>
            {categories.map(cat => (
              <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all min-h-[40px] ${selectedCategory === cat.id ? 'bg-[#0F2417] text-white shadow-md shadow-emerald-900/20' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:border-gray-300'}`} data-testid={`category-${cat.name.toLowerCase().replace(/\s+/g, '-')}`}>
                {cat.name} <span className={`text-xs px-1.5 py-0.5 rounded-md ${selectedCategory === cat.id ? 'bg-white/20' : 'bg-gray-100'}`}>{getCategoryCount(cat.id)}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 w-full md:w-auto">
            <button onClick={fetchMenu} className="hidden md:flex items-center gap-1.5 px-3 py-2 text-sm text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-lg transition-colors" data-testid="refresh-menu-btn"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
            <div className="relative flex-1 md:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input placeholder="Search Menu" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-9 w-full md:w-48 bg-white border-slate-200 rounded-lg text-sm" data-testid="menu-search-input" />
            </div>
          </div>
        </div>

        {/* Menu Grid */}
        <div className="flex-1 lg:overflow-auto lg:-mr-2 lg:pr-2">
          {filteredItems.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2.5 md:gap-3">
              {filteredItems.map((item, idx) => {
                const qty = getCartQuantity(item.id);
                const imgSrc = getImageUrl(item.image_url) || FALLBACK_IMG;
                return (
                  <div key={item.id} style={{ animationDelay: `${Math.min(idx * 40, 400)}ms` }} className="group relative bg-white dark:bg-white/[0.035] rounded-2xl overflow-hidden border border-slate-100 dark:border-white/[0.06] hover:border-emerald-200/70 dark:hover:border-emerald-400/25 hover:shadow-[0_20px_50px_-20px_rgba(46,158,91,0.35)] dark:hover:shadow-[0_20px_50px_-20px_rgba(46,158,91,0.2)] hover:-translate-y-1.5 active:scale-[0.98] transition-all duration-300 cursor-pointer animate-fade-in-up" data-testid={`menu-item-${item.id}`}>
                    <div className="relative aspect-[4/3] bg-slate-100">
                      <img src={imgSrc} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onError={e => { e.target.src = FALLBACK_IMG; }} />
                      <span className={`absolute top-2 right-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold tracking-wide backdrop-blur-md ${item.is_available ? 'bg-white/85 text-emerald-700 shadow-sm ring-1 ring-black/[0.04]' : 'bg-white/85 text-red-600 shadow-sm ring-1 ring-black/[0.04]'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${item.is_available ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                        {item.is_available ? 'Available' : 'Sold out'}
                      </span>
                      {qty > 0 && <span className="absolute top-2.5 left-2.5 w-6 h-6 bg-[#2E9E5B] text-white rounded-full ring-2 ring-white text-[11px] font-bold flex items-center justify-center">{qty}</span>}
                    </div>
                    <div className="p-3">
                      <div className="mb-2.5">
                        <h3 className="text-[13px] font-semibold text-slate-900 dark:text-white/90 leading-snug line-clamp-2 group-hover:text-slate-700 dark:group-hover:text-white transition-colors">{item.name}</h3>
                        <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">₹{item.price.toFixed(2)}</p>
                      </div>
                      {!item.is_available ? (
                        <button disabled className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-50 text-red-400 text-xs font-semibold cursor-not-allowed"><X className="w-3.5 h-3.5" /> Not Available</button>
                      ) : qty > 0 ? (
                        <button onClick={() => addToCart(item)} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 active:scale-[0.97] transition-all duration-150" data-testid={`add-more-${item.id}`}>Add More ({qty})</button>
                      ) : (
                        <button onClick={() => addToCart(item)} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-full bg-[#0F2417] dark:bg-[#2E9E5B] text-white text-xs font-bold hover:bg-[#1a3d28] dark:hover:bg-[#2ba765] active:scale-[0.97] transition-all duration-150 shadow-sm hover:shadow-lg hover:shadow-emerald-900/20" data-testid={`add-item-${item.id}`}><Plus className="w-3.5 h-3.5" /> Add to Cart</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 animate-fade-in"><ChefShrugging className="w-28 h-28 mb-3" /><p className="text-base font-heading font-bold text-slate-600">No menu items found</p><p className="text-sm text-slate-400 mt-1">Add dishes to the menu first</p></div>
          )}
        </div>
      </div>

      {/* Right: Order Summary */}
      <div ref={mobileCartOpen ? cartDragRef : undefined} {...(mobileCartOpen ? cartDragHandlers : {})} className={`${mobileCartOpen ? 'fixed inset-x-0 bottom-0 z-50 h-[calc(85dvh_-_1rem)] rounded-t-2xl flex flex-col pb-[calc(3.5rem_+_env(safe-area-inset-bottom,0px))] transition-transform' : 'hidden'} lg:static lg:flex lg:flex-col lg:w-[340px] lg:max-h-none lg:h-full lg:flex-shrink-0 lg:pb-0 bg-white dark:bg-[#161A20] rounded-2xl border border-slate-200 dark:border-white/[0.06] overflow-hidden shadow-md`} data-testid="cart-panel">
        {/* Grab handle — drag anywhere on it to dismiss (mobile) */}
        {mobileCartOpen && (
          <div className="lg:hidden flex justify-center pt-2 pb-1 flex-shrink-0" aria-hidden="true">
            <div className="w-10 h-1 rounded-full bg-slate-200" />
          </div>
        )}
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-bold text-base text-slate-900">{selectedRunningOrder ? `Table ${selectedRunningOrder.table_number}` : 'Order Summary'}</h2>
            <span className="text-xs text-slate-400 font-numbers">{selectedRunningOrder ? `#${selectedRunningOrder.order_number}` : `#${orderNumber}`}</span>
            {mobileCartOpen && (
              <button onClick={() => setMobileCartOpen(false)} aria-label="Close cart" className="lg:hidden ml-3 p-1.5 -mr-1 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0 px-4 py-3">
          {/* ── Context first (reference layout): order type + table, one tap each ── */}
          {!selectedRunningOrder && (
            <div className="space-y-2 pb-3 mb-2 border-b border-slate-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-1.5">
                {[['dine_in', 'Dine-in', '🪑'], ['takeaway', 'Takeaway', '🥡']].map(([val, label, ico]) => (
                  <button key={val} type="button" onClick={() => { setOrderType(val); if (val !== 'dine_in') setTableNumber(''); }} aria-pressed={orderType === val}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold transition-all active:scale-95 min-h-[36px] ${orderType === val ? 'bg-[#0F2417] text-white shadow-md shadow-emerald-900/20' : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100 dark:bg-white/[0.04] dark:text-white/60 dark:border-white/10'}`}
                    data-testid={`otype-${val}`}>
                    <span aria-hidden="true">{ico}</span> {label}
                  </button>
                ))}
                {orderType === 'dine_in' && tableNumber && (
                  <span className="ml-auto text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">Table {tableNumber} ✓</span>
                )}
              </div>
              {orderType === 'dine_in' && (
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Select table</p>
                  {availableTables.length === 0 ? (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">No free tables — settle a running bill or add tables.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {availableTables.map(t => (
                        <button key={t.id} type="button" onClick={() => setTableNumber(t.table_number.toString())} aria-pressed={tableNumber === t.table_number.toString()}
                          aria-label={`Select table ${t.table_number}`}
                          className={`w-11 h-11 rounded-xl text-sm font-bold font-numbers transition-all active:scale-90 ${tableNumber === t.table_number.toString() ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30' : 'bg-slate-50 text-slate-600 border border-slate-200 hover:border-emerald-300 hover:text-emerald-700 dark:bg-white/[0.04] dark:text-white/60 dark:border-white/10 dark:hover:text-emerald-400'}`}
                          data-testid={`table-chip-${t.table_number}`}>
                          {t.table_number}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {cart.length > 0 ? (
            <div className="space-y-3">
              {cart.map(cartItem => {
                const imgSrc = getImageUrl(cartItem.item.image_url) || FALLBACK_IMG;
                return (
                  <div key={cartItem.item.id} className="flex gap-3" data-testid={`cart-item-${cartItem.item.id}`}>
                    <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100"><img src={imgSrc} alt={cartItem.item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onError={e => { e.target.src = FALLBACK_IMG; }} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-slate-900 leading-tight truncate">{cartItem.item.name}</h4>
                          <p className="text-[11px] text-slate-400 mt-0.5">₹{cartItem.item.price.toFixed(2)} each</p>
                        </div>
                        {/* Quantity stepper — green, like the reference */}
                        <div className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-1 py-0.5 flex-shrink-0" data-testid={`qty-stepper-${cartItem.item.id}`}>
                          <button
                            onClick={() => (cartItem.quantity === 1 ? removeFromCart(cartItem.item.id) : updateQuantity(cartItem.item.id, -1))}
                            className="w-7 h-7 rounded-md flex items-center justify-center text-emerald-700 hover:bg-emerald-100 active:scale-90 transition-all"
                            aria-label={`Decrease ${cartItem.item.name}`}
                            data-testid={`qty-minus-${cartItem.item.id}`}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-6 text-center text-sm font-bold font-numbers text-emerald-800">{cartItem.quantity}</span>
                          <button
                            onClick={() => updateQuantity(cartItem.item.id, 1)}
                            className="w-7 h-7 rounded-md flex items-center justify-center text-emerald-700 hover:bg-emerald-100 active:scale-90 transition-all"
                            aria-label={`Increase ${cartItem.item.name}`}
                            data-testid={`qty-plus-${cartItem.item.id}`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <button
                          onClick={() => setEditingNotesId(editingNotesId === cartItem.item.id ? null : cartItem.item.id)}
                          className={`text-[11px] font-semibold flex items-center gap-0.5 transition-colors ${cartItem.notes ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
                          data-testid={`edit-notes-${cartItem.item.id}`}
                        >
                          {cartItem.notes ? `Note: ${cartItem.notes}` : 'Edit'} {!cartItem.notes && <ChevronRight className="w-3 h-3" />}
                        </button>
                        <p className="text-sm font-bold font-numbers text-slate-900">₹{(cartItem.item.price * cartItem.quantity).toFixed(2)}</p>
                      </div>
                      {editingNotesId === cartItem.item.id && (
                        <input
                          type="text"
                          autoFocus
                          placeholder="Add a note for the kitchen..."
                          value={cartItem.notes}
                          onChange={e => updateNotes(cartItem.item.id, e.target.value)}
                          onBlur={() => setEditingNotesId(null)}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingNotesId(null); }}
                          className="mt-1.5 w-full text-[11px] text-slate-700 bg-emerald-50/60 border border-emerald-100 rounded-lg px-2.5 py-1.5 outline-none focus:border-emerald-300 transition-colors"
                          data-testid={`notes-input-${cartItem.item.id}`}
                        />
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Reference-style action pills row */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => { setSearchQuery(''); setSelectedCategory(null); }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-emerald-200 text-emerald-700 text-xs font-semibold hover:bg-emerald-50 active:scale-95 transition-all"
                  data-testid="add-more-items-btn"
                >
                  <Plus className="w-3.5 h-3.5" /> Add more items
                </button>
                <button
                  onClick={() => setEditingNotesId(cart[0]?.item?.id || null)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 active:scale-95 transition-all"
                >
                  <StickyNote className="w-3.5 h-3.5" /> Add a note
                </button>
              </div>
            </div>
          ) : !selectedRunningOrder ? (
            <>
              <div className="flex flex-col items-center text-center py-3">
                <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-2">
                  <ShoppingCart className="w-6 h-6 text-emerald-500" />
                </div>
                <p className="text-sm font-semibold text-slate-700">Cart is empty</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Tap items on the menu — suggestions below</p>
              </div>
              {upsellStrip}
            </>
          ) : null}
          {/* ── Bill summary — right after the items, before the extras ── */}
          {cart.length > 0 && (
            <div className="space-y-1.5 text-sm pt-4 mt-1 border-t border-slate-100 dark:border-white/[0.06]">
              <div className="flex justify-between"><span className="text-slate-500 dark:text-white/50">Subtotal</span><span className="font-semibold text-slate-900 dark:text-white">₹{subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 dark:text-white/50">Taxes (5%)</span><span className="font-semibold text-slate-900 dark:text-white">₹{taxAmount.toFixed(2)}</span></div>
              {discountAmount > 0 && <div className="flex justify-between text-green-600 dark:text-emerald-400"><span>Discount</span><span className="font-semibold">-₹{discountAmount.toFixed(2)}</span></div>}
              <div className="flex justify-between pt-2 border-t border-slate-100 dark:border-white/[0.08] text-base font-bold"><span className="text-slate-900 dark:text-white">Total</span><span className="text-slate-900 dark:text-white font-numbers text-lg">₹{total.toFixed(2)}</span></div>
            </div>
          )}

          {cart.length > 0 && (
            <button onClick={() => { const next = !applyDiscount; setApplyDiscount(next); if (next) moment('discount_applied'); }} className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg border text-xs transition-colors ${applyDiscount ? 'bg-green-50 border-green-200 text-green-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`} data-testid="discount-toggle">
              <Tag className="w-4 h-4" /><div className="text-left"><p className="font-semibold">{applyDiscount ? 'Applied: 10% off' : 'Save 10% on this bill'}</p><p className="text-[10px] opacity-70">Minimum buy ₹50.00 · tap to {applyDiscount ? 'remove' : 'apply'}</p></div>
              <span className={`ml-auto text-[10px] font-bold px-2.5 py-1 rounded-full ${applyDiscount ? 'bg-green-500 text-white' : 'bg-emerald-600 text-white'}`}>{applyDiscount ? '✓ APPLIED' : 'APPLY'}</span>
            </button>
          )}

          {cart.length > 0 && (
            <div className="space-y-2 pt-2 pb-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1"><User className="w-3.5 h-3.5" /> Customer Details</p>
                <button
                  type="button"
                  onClick={() => setIsWalkIn(v => !v)}
                  aria-pressed={isWalkIn}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[10px] font-bold transition-all active:scale-95 min-h-[32px] ${isWalkIn ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-white/10 dark:text-white/50 dark:hover:bg-white/5'}`}
                  data-testid="walkin-toggle"
                >
                  {isWalkIn ? '✓ Walk-in' : 'Walk-in?'}
                </button>
              </div>
              {isWalkIn && (
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Order will be punched without customer details</p>
              )}
              {!isWalkIn && (<>
              <div className="relative">
                <Input placeholder="Phone *" value={customerPhone} onChange={e => { setCustomerPhone(e.target.value); lookupCustomer(e.target.value); }} className="h-8 text-xs rounded-lg bg-slate-50 border-slate-200" data-testid="customer-phone" />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                    {suggestions.map((s, i) => (
                      <button key={s.phone || `suggestion-${i}`} onClick={() => selectCustomer(s)} className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 border-b border-slate-50 last:border-0" data-testid={`customer-suggestion-${i}`}>
                        <span className="font-semibold text-slate-800">{s.name}</span> <span className="text-slate-400">{s.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Input placeholder="Name *" value={customerName} onChange={e => setCustomerName(e.target.value)} className="h-8 text-xs rounded-lg bg-slate-50 border-slate-200" data-testid="customer-name" />
              <Input placeholder="Email (optional)" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} className="h-8 text-xs rounded-lg bg-slate-50 border-slate-200" data-testid="customer-email" />
              </>
              )}
            </div>
          )}

          {selectedRunningOrder && (
            <p className="text-[11px] font-medium text-slate-500 text-center py-3">{hasOrderChanges ? 'New items pending — Update to send them to the kitchen first' : 'Bill settled below releases the table'}</p>
          )}
        </ScrollArea>

        {/* ── STICKY PAY BAR (always visible, exact reference placement) ── */}
        {(cart.length > 0 || selectedRunningOrder) && (
          <div className="flex items-center gap-3 px-4 py-3 border-t border-slate-100 bg-white flex-shrink-0" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }} data-testid="place-order-bar">
            {/* Left: context — like "PAY USING / Google Pay UPI" slot */}
            <div className="flex flex-col min-w-0 flex-shrink-0">
              <p className="text-[9px] font-bold tracking-wider text-slate-400 uppercase leading-none">{orderType === 'dine_in' ? 'Dine-in' : 'Takeaway'}</p>
              <p className="text-[11px] font-semibold text-slate-700 truncate mt-1">
                {orderType === 'dine_in' ? (selectedRunningOrder ? `Table ${selectedRunningOrder.table_number}` : tableNumber ? `Table ${tableNumber}` : 'Select table ↑') : 'Billing counter'}
              </p>
            </div>
            {/* Right: total + CTA block — like the ₹230.69 / Place Order pill */}
            <Button
              onClick={handlePlaceOrder}
              className="flex-1 h-12 rounded-xl bg-[#2E9E5B] hover:bg-[#288A50] text-white font-bold text-sm flex items-center justify-between px-4 active:scale-[0.98] transition-all"
              disabled={!isDayOpen || checkoutLoading}
              data-testid="place-order-btn"
            >
              {checkoutLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
              ) : (
                <>
                  <span className="flex flex-col items-start leading-none">
                    <span className="font-numbers text-base">₹{total.toFixed(2)}</span>
                    <span className="text-[9px] font-semibold opacity-80 mt-0.5">TOTAL</span>
                  </span>
                  <span className="flex items-center gap-1 text-sm">
                    {selectedRunningOrder ? (hasOrderChanges ? 'Update' : 'Pay & Release') : orderType === 'dine_in' ? 'Place Order' : 'Pay Now'}
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </>
              )}
            </Button>
          </div>
        )}

        {selectedRunningOrder && cart.length === 0 && (
          <div className="px-4 py-3 border-t border-slate-100 flex-shrink-0">
            <button onClick={() => { openPaymentModal(); }} className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-[#2E9E5B] hover:bg-[#288A50] text-white text-sm font-bold transition-all" data-testid="pay-split-btn">
              <Wallet className="w-4 h-4" /> Pay ₹{total.toFixed(2)}
            </button>
          </div>
        )}
      </div>

      {/* Mobile: floating cart bar — the Zomato/Swiggy checkout anchor.
          Deep-brand glass slab, glossy CTA, spring pop-in. */}
      {cart.length > 0 && !mobileCartOpen && (
        <div
          className="lg:hidden fixed bottom-[4.75rem] inset-x-3 z-40 animate-cart-pop"
          data-testid="mobile-cart-bar"
        >
          <div
            className="flex items-center gap-3 rounded-2xl bg-[#0F2417]/95 dark:bg-[#161A20]/95 backdrop-blur-xl text-white p-2.5 pr-2.5 ring-1 ring-white/10 shadow-[0_12px_40px_-8px_rgba(15,36,23,0.55)]"
            style={{ paddingBottom: 'calc(0.625rem + env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="flex -space-x-2.5 flex-shrink-0 pl-0.5">
              {cart.slice(0, 3).map(c => (
                <img key={c.item.id} src={getImageUrl(c.item.image_url) || FALLBACK_IMG} alt="" className="w-9 h-9 rounded-xl border-2 border-white/15 object-cover ring-1 ring-black/20" onError={e => { e.target.src = FALLBACK_IMG; }} />
              ))}
            </div>
            <div className="flex-1 min-w-0 pl-0.5">
              <p className="text-[11px] font-semibold text-white/65 leading-tight">{cart.reduce((s, c) => s + c.quantity, 0)} item{cart.reduce((s, c) => s + c.quantity, 0) > 1 ? 's' : ''} added</p>
              <p className="text-[15px] font-bold font-numbers leading-tight">₹{total.toFixed(2)}</p>
            </div>
            <button
              onClick={() => { haptics.press(); setMobileCartOpen(true); }}
              className="px-5 h-11 rounded-full bg-[#2E9E5B] text-white text-[13px] font-bold hover:brightness-110 active:scale-[0.96] transition-all flex-shrink-0 flex items-center gap-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_4px_14px_-4px_rgba(46,158,91,0.6)]"
              data-testid="view-cart-btn"
            >
              View Cart <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Payment Modal - Split Payment */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="rounded-2xl max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-center font-heading">Payment</DialogTitle></DialogHeader>
          <div className="py-4 space-y-4">
            {/* Bill Total */}
            <div className="text-center">
              <p className="text-3xl font-bold text-slate-900">₹{total.toFixed(2)}</p>
              <p className="text-xs text-slate-500">Bill Amount</p>
            </div>

            {/* Payment Splits */}
            <div className="space-y-2">
              {paymentSplits.map((split, idx) => {
                const SplitIcon = split.method === 'cash' ? Banknote : split.method === 'card' ? CreditCard : Smartphone;
                const methodLabel = split.method === 'cash' ? 'Cash' : split.method === 'card' ? 'Card' : 'UPI';
                return (
                  <div key={idx} className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                    <select
                      value={split.method}
                      onChange={(e) => updateSplitMethod(idx, e.target.value)}
                      className="text-xs font-semibold bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 outline-none"
                    >
                      <option value="cash">💵 Cash</option>
                      <option value="card">💳 Card</option>
                      <option value="upi">📱 UPI</option>
                    </select>
                    <input
                      type="number"
                      value={split.amount || ''}
                      onChange={(e) => updateSplitAmount(idx, e.target.value)}
                      placeholder="0.00"
                      className="flex-1 text-sm font-bold text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-right outline-none focus:border-black"
                    />
                    {paymentSplits.length > 1 && (
                      <button onClick={() => removeSplit(idx)} className="text-red-400 hover:text-red-600 p-1">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add payment method */}
            {paymentSplits.length < 3 && remaining > 0 && (
              <button onClick={addSplit} className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-slate-300 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-all">
                <Plus className="w-3.5 h-3.5" /> Add Payment Method
              </button>
            )}

            {/* Summary */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <div className="flex justify-between text-xs"><span className="text-slate-500">Total Paid</span><span className="font-semibold text-slate-900">₹{totalPaid.toFixed(2)}</span></div>
              {remaining > 0 && (
                <div className="flex justify-between text-xs"><span className="text-slate-500">Remaining</span><span className="font-semibold text-orange-600">₹{remaining.toFixed(2)}</span></div>
              )}
              {change > 0 && (
                <div className="flex justify-between text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <span className="text-amber-700 font-medium">💰 Change to return</span>
                  <span className="font-bold text-amber-800">₹{change.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Pay Button */}
            <button
              onClick={() => {
                if (selectedRunningOrder) {
                  confirmRunningOrderPayment(selectedRunningOrder.id);
                  return;
                } else {
                  handleCheckoutWithPayment();
                }
              }}
              disabled={checkoutLoading || totalPaid < total}
              className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                totalPaid >= total
                  ? 'bg-[#0F2417] hover:bg-[#1a3d28] text-white'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
              data-testid="confirm-payment-btn"
            >
              {checkoutLoading ? 'Processing...' : `Pay ₹${total.toFixed(2)}`}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt Modal */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="rounded-2xl max-w-xs bg-white" data-testid="receipt-modal">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Check className="w-5 h-5 text-green-500" /> Order Complete</DialogTitle></DialogHeader>
          {receiptData && (
            <div ref={receiptRef}>
              <div className="text-center border-b border-dashed border-slate-300 pb-2 mb-2">
                <h2 className="font-bold text-base">{receiptData.restaurant.name}</h2>
                <p className="text-[10px] text-slate-500">{receiptData.restaurant.address}, {receiptData.restaurant.city}</p>
                <p className="text-[10px] text-slate-500">{receiptData.restaurant.phone}</p>
              </div>
              <div className="text-[11px] mb-2">
                <div className="flex justify-between"><span>Order #</span><span className="font-mono">{receiptData.order.order_number}</span></div>
                <div className="flex justify-between"><span>Type</span><span className="capitalize">{receiptData.order.order_type?.replace('_', ' ')}</span></div>
                <div className="flex justify-between"><span>Payment</span><span className="capitalize">{receiptData.order.payment_method}</span></div>
                <div className="flex justify-between"><span>Date</span><span>{new Date(receiptData.order.created_at).toLocaleString()}</span></div>
                {receiptData.order.customer_name && <div className="flex justify-between"><span>Customer</span><span>{receiptData.order.customer_name}</span></div>}
                {receiptData.order.customer_phone && <div className="flex justify-between"><span>Phone</span><span>{receiptData.order.customer_phone}</span></div>}
              </div>
              <hr className="border-dashed border-slate-300 my-1" />
              <div className="space-y-1 text-[11px]">
                {(receiptData.order.items || []).map((item, i) => <div key={`${item.name}-${item.quantity}-${i}`} className="flex justify-between"><span>{item.quantity}x {item.name}</span><span>₹{item.total?.toFixed(2)}</span></div>)}
              </div>
              <hr className="border-dashed border-slate-300 my-1" />
              <div className="text-[11px] space-y-0.5">
                <div className="flex justify-between"><span>Subtotal</span><span>₹{receiptData.order.subtotal?.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Tax</span><span>₹{receiptData.order.tax_amount?.toFixed(2)}</span></div>
                {receiptData.order.discount_amount > 0 && <div className="flex justify-between"><span>Discount</span><span>-₹{receiptData.order.discount_amount?.toFixed(2)}</span></div>}
                <div className="flex justify-between font-bold text-sm pt-1 border-t border-dashed border-slate-300"><span>Total</span><span className="font-numbers">₹{receiptData.order.total_amount?.toFixed(2)}</span></div>
              </div>

              {/* Payment Breakup */}
              {/* Payment Breakup */}
              {receiptData.order.payment_splits && receiptData.order.payment_splits.length > 0 && (
                <>
                  <hr className="border-dashed border-slate-300 my-1" />
                  <div className="text-[11px] space-y-0.5">
                    <p className="font-semibold text-slate-600 mb-1">Payment Breakup:</p>
                    {receiptData.order.payment_splits.map((s, i) => (
                      <div key={i} className="flex justify-between">
                        <span className="capitalize">{s.method === 'cash' ? '💵 Cash' : s.method === 'card' ? '💳 Card' : '📱 UPI'}</span>
                        <span>₹{s.amount?.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {receiptData.order.change_amount > 0 && (
                <>
                  <div className="flex justify-between text-[11px] mt-1"><span className="font-semibold text-slate-700">Amount Paid</span><span className="font-semibold text-slate-900">₹{(receiptData.order.total_amount + receiptData.order.change_amount).toFixed(2)}</span></div>
                  <div className="mt-1 p-1.5 bg-amber-50 border border-amber-200 rounded text-[11px] text-center">
                    <span className="font-semibold text-amber-700">💰 Change: ₹{receiptData.order.change_amount?.toFixed(2)}</span>
                  </div>
                </>
              )}

              <p className="text-center text-[9px] text-slate-400 mt-3">Thank you for dining with us!</p>
            </div>
          )}
          <button onClick={handlePrintReceipt} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white border border-gray-200 text-gray-800 text-sm font-semibold hover:bg-gray-50 transition-colors mt-2" data-testid="print-receipt-btn"><Printer className="w-4 h-4" /> Print Receipt</button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
