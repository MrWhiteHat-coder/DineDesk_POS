import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { menuAPI, orderAPI, tableAPI, receiptAPI, customerAPI } from '../../lib/api';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ScrollArea } from '../../components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { Label } from '../../components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import {
  Plus, Minus, Trash2, ShoppingCart, Search, AlertCircle, X, Pencil, RefreshCw, Tag,
  Banknote, CreditCard, Smartphone, CheckCircle2, Utensils, Printer, Check, User,
  Pause, ChevronDown,
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const getImageUrl = (imageUrl) => {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http')) return imageUrl;
  return `${API_URL}${imageUrl}`;
};
const FALLBACK_IMG = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=400&fit=crop';

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
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [runningOrders, setRunningOrders] = useState([]);
  const [selectedRunningOrder, setSelectedRunningOrder] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [pendingOrderId, setPendingOrderId] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const receiptRef = useRef(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestTimeout = useRef(null);

  const lookupCustomer = useCallback((phone) => {
    if (suggestTimeout.current) clearTimeout(suggestTimeout.current);
    if (phone.length < 3) { setSuggestions([]); return; }
    suggestTimeout.current = setTimeout(async () => {
      try {
        const res = await customerAPI.lookup(phone);
        setSuggestions(res.data);
        setShowSuggestions(res.data.length > 0);
      } catch { setSuggestions([]); }
    }, 300);
  }, []);

  const selectCustomer = (c) => {
    setCustomerName(c.name || '');
    setCustomerPhone(c.phone || '');
    setCustomerEmail(c.email || '');
    setShowSuggestions(false);
  };

  const fetchAndShowReceipt = async (orderId) => {
    try {
      const rcpt = await receiptAPI.get(orderId);
      setReceiptData(rcpt.data);
      setShowReceipt(true);
    } catch (err) { console.error('Receipt fetch failed:', err); }
  };

  const handlePrintReceipt = () => {
    if (!receiptRef.current) return;
    const win = window.open('', '_blank', 'width=320,height=600');
    win.document.write(`<html><head><title>Receipt</title><style>body{font-family:monospace;font-size:12px;width:280px;margin:0 auto;padding:10px}h2{text-align:center;margin:4px 0}hr{border:none;border-top:1px dashed #000;margin:6px 0}.row{display:flex;justify-content:space-between}.center{text-align:center}p{margin:2px 0}</style></head><body>`);
    win.document.write(receiptRef.current.innerHTML);
    win.document.write('</body></html>');
    win.document.close();
    win.print();
  };

  useEffect(() => {
    fetchMenu(); fetchTables(); fetchRunningOrders(); generateOrderNumber();
  }, []);

  const generateOrderNumber = () => setOrderNumber(`B${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`);

  const fetchMenu = async () => {
    try {
      const [catRes, itemsRes] = await Promise.all([menuAPI.getCategories(), menuAPI.getItems()]);
      setCategories(catRes.data);
      setMenuItems(itemsRes.data);
    } catch (err) { console.error('Failed to fetch menu:', err); } finally { setLoading(false); }
  };

  const fetchTables = async () => {
    try { const res = await tableAPI.getAll(); setTables(res.data); } catch (err) { console.error(err); }
  };

  const fetchRunningOrders = async () => {
    try { const res = await orderAPI.getRunning(); setRunningOrders(res.data); } catch (err) { console.error(err); }
  };

  const availableTables = tables.filter(t => t.status === 'available');
  const filteredItems = menuItems.filter((item) => {
    const matchesCategory = !selectedCategory || item.category_id === selectedCategory;
    const matchesSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const addToCart = (item) => {
    if (!isDayOpen) { toast.error('Please open the day first'); return; }
    if (!item.is_available) { toast.error('Item not available'); return; }
    setCart((prev) => {
      const existing = prev.find((c) => c.item.id === item.id);
      if (existing) return prev.map((c) => c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { item, quantity: 1, notes: '' }];
    });
  };

  const getCartQuantity = (itemId) => cart.find((c) => c.item.id === itemId)?.quantity || 0;
  const updateQuantity = (itemId, delta) => {
    setCart((prev) => prev.map((c) => c.item.id === itemId ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c).filter((c) => c.quantity > 0));
  };
  const removeFromCart = (itemId) => setCart((prev) => prev.filter((c) => c.item.id !== itemId));
  const clearCart = () => { setCart([]); generateOrderNumber(); setSelectedRunningOrder(null); setCustomerName(''); setCustomerPhone(''); setCustomerEmail(''); };

  const subtotal = cart.reduce((sum, c) => sum + c.item.price * c.quantity, 0);
  const discountAmount = applyDiscount && subtotal >= 50 ? subtotal * 0.1 : 0;
  const taxRate = 0.05;
  const taxAmount = (subtotal - discountAmount) * taxRate;
  const roundOff = Math.round(subtotal + taxAmount - discountAmount) - (subtotal + taxAmount - discountAmount);
  const total = subtotal + taxAmount - discountAmount + roundOff;
  const totalQty = cart.reduce((sum, c) => sum + c.quantity, 0);

  const handlePlaceOrder = async () => {
    if (cart.length === 0) { toast.error('Cart is empty'); return; }
    if (!customerName.trim()) { toast.error('Customer name is required'); return; }
    if (!customerPhone.trim()) { toast.error('Customer phone is required'); return; }
    if (orderType === 'dine_in') {
      if (selectedRunningOrder) {
        setCheckoutLoading(true);
        try {
          const newItems = cart.filter(c => !c.isExisting);
          if (newItems.length > 0) {
            await orderAPI.addItems(selectedRunningOrder.id, { items: newItems.map((c) => ({ menu_item_id: c.item.id, quantity: c.quantity, notes: c.notes || null })) });
          }
          toast.success('Order updated!');
          clearCart(); fetchRunningOrders(); fetchTables();
        } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); } finally { setCheckoutLoading(false); }
        return;
      }
      if (!tableNumber) { toast.error('Please select a table'); return; }
      setCheckoutLoading(true);
      try {
        const res = await orderAPI.create({ order_type: 'dine_in', table_number: parseInt(tableNumber), items: cart.map((c) => ({ menu_item_id: c.item.id, quantity: c.quantity, notes: c.notes || null })), payment_method: 'pending', discount_amount: discountAmount, customer_name: customerName.trim(), customer_phone: customerPhone.trim(), customer_email: customerEmail.trim() || null });
        toast.success(`Order #${res.data.order_number} placed!`);
        clearCart(); setTableNumber(''); fetchRunningOrders(); fetchTables();
      } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); } finally { setCheckoutLoading(false); }
    } else {
      setShowPaymentModal(true);
    }
  };

  const handleCheckoutWithPayment = async (method) => {
    setCheckoutLoading(true);
    try {
      const res = await orderAPI.create({ order_type: orderType, table_number: null, items: cart.map((c) => ({ menu_item_id: c.item.id, quantity: c.quantity, notes: c.notes || null })), payment_method: method, discount_amount: discountAmount, customer_name: customerName.trim(), customer_phone: customerPhone.trim(), customer_email: customerEmail.trim() || null });
      toast.success(`Order #${res.data.order_number} completed!`);
      await fetchAndShowReceipt(res.data.id);
      clearCart(); setShowPaymentModal(false); setPaymentMethod('');
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); } finally { setCheckoutLoading(false); }
  };

  const handleReleaseAndPay = async (orderId, method) => {
    try {
      await orderAPI.pay(orderId, { payment_method: method });
      toast.success('Payment confirmed!');
      await fetchAndShowReceipt(orderId);
      fetchRunningOrders(); fetchTables(); setSelectedRunningOrder(null);
    } catch (err) { toast.error(err.response?.data?.detail || 'Payment failed'); }
  };

  const selectRunningOrder = (order) => {
    setSelectedRunningOrder(order);
    setOrderType('dine_in');
    setTableNumber(order.table_number?.toString() || '');
    setCart((order.items || []).map((item) => {
      const menuItem = menuItems.find(mi => mi.id === item.menu_item_id);
      return { item: menuItem || { id: item.menu_item_id, name: item.name, price: item.price, image_url: null, is_available: true }, quantity: item.quantity, notes: item.notes || '', isExisting: true };
    }));
  };

  const getCategoryCount = (catId) => menuItems.filter(i => i.category_id === catId).length;

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-teal-700 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="h-[calc(100vh-7rem)] flex flex-col" data-testid="pos-main">
      {/* Running Orders Bar */}
      {runningOrders.length > 0 && (
        <div className="mb-2 flex items-center gap-2 overflow-x-auto pb-1 flex-shrink-0">
          <span className="text-xs text-slate-500 whitespace-nowrap font-medium">Running:</span>
          {runningOrders.map((ro) => (
            <button key={ro.id} onClick={() => selectRunningOrder(ro)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap border transition-all ${selectedRunningOrder?.id === ro.id ? 'bg-teal-700 text-white border-teal-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`} data-testid={`running-order-${ro.id}`}>
              <Utensils className="w-3 h-3" /> T-{ro.table_number} #{ro.order_number?.slice(-4)}
            </button>
          ))}
          {selectedRunningOrder && <button onClick={() => { setSelectedRunningOrder(null); setCart([]); }} className="text-xs text-slate-400 hover:text-slate-600 ml-1"><X className="w-3.5 h-3.5" /></button>}
        </div>
      )}

      {/* 3-Column Layout */}
      <div className="flex-1 flex flex-col lg:flex-row gap-3 min-h-0">
        {/* LEFT: Category Sidebar */}
        <div className="hidden lg:flex w-[160px] flex-col bg-white rounded-xl border border-slate-200/60 flex-shrink-0 overflow-hidden" data-testid="category-sidebar">
          <div className="px-3 py-3 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-900 uppercase tracking-wider">Categories</p>
          </div>
          <ScrollArea className="flex-1 px-2 py-2">
            <button onClick={() => setSelectedCategory(null)} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all mb-1 ${!selectedCategory ? 'bg-teal-700 text-white' : 'text-slate-600 hover:bg-slate-50'}`} data-testid="category-all">
              <span>All Items</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${!selectedCategory ? 'bg-white/20' : 'bg-slate-100'}`}>{menuItems.length}</span>
            </button>
            {categories.map((cat) => (
              <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all mb-1 ${selectedCategory === cat.id ? 'bg-teal-700 text-white' : 'text-slate-600 hover:bg-slate-50'}`} data-testid={`category-${cat.name.toLowerCase().replace(/\s+/g, '-')}`}>
                <span className="truncate">{cat.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ml-1 ${selectedCategory === cat.id ? 'bg-white/20' : 'bg-slate-100'}`}>{getCategoryCount(cat.id)}</span>
              </button>
            ))}
          </ScrollArea>
        </div>

        {/* Mobile Category Tabs (visible only on mobile) */}
        <div className="lg:hidden flex items-center gap-2 overflow-x-auto pb-1 flex-shrink-0">
          <button onClick={() => setSelectedCategory(null)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${!selectedCategory ? 'bg-teal-700 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>All</button>
          {categories.map((cat) => (
            <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${selectedCategory === cat.id ? 'bg-teal-700 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>{cat.name}</button>
          ))}
        </div>

        {/* CENTER: Product Grid */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Search Bar */}
          <div className="flex items-center gap-2 mb-3 flex-shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input placeholder="Search Items, Category, SKU, Barcode..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-10 bg-white border-slate-200 rounded-xl text-sm" data-testid="menu-search-input" />
            </div>
            <button onClick={fetchMenu} className="h-10 px-3 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-slate-700 transition-colors flex items-center gap-1.5" data-testid="refresh-menu-btn">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Product Grid */}
          <ScrollArea className="flex-1 -mr-1 pr-1">
            {filteredItems.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                {filteredItems.map((item) => {
                  const qty = getCartQuantity(item.id);
                  const imgSrc = getImageUrl(item.image_url) || FALLBACK_IMG;
                  return (
                    <div key={item.id} onClick={() => addToCart(item)} className={`bg-white rounded-xl overflow-hidden border border-slate-100 hover:shadow-md transition-all cursor-pointer hover:-translate-y-0.5 ${qty > 0 ? 'ring-2 ring-teal-500/40' : ''}`} data-testid={`menu-item-${item.id}`}>
                      <div className="relative aspect-[4/3] bg-slate-100">
                        <img src={imgSrc} alt={item.name} className="w-full h-full object-cover" onError={(e) => { e.target.src = FALLBACK_IMG; }} />
                        {qty > 0 && <span className="absolute top-2 right-2 w-6 h-6 bg-amber-400 text-slate-900 rounded-full text-[11px] font-bold flex items-center justify-center">{qty}</span>}
                        {!item.is_available && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><span className="text-white text-xs font-bold bg-red-500 px-2 py-0.5 rounded">Unavailable</span></div>}
                      </div>
                      <div className="p-2.5">
                        <h3 className="text-[13px] font-semibold text-slate-900 leading-tight line-clamp-1">{item.name}</h3>
                        <p className="text-sm font-bold text-teal-700 mt-0.5">₹{item.price.toFixed(0)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <AlertCircle className="w-12 h-12 mb-4" />
                <p className="text-lg font-medium">No items found</p>
              </div>
            )}
          </ScrollArea>
        </div>

        {/* RIGHT: Order Summary Panel */}
        <div className="w-full lg:w-[320px] flex flex-col bg-white rounded-xl border border-slate-200/60 overflow-hidden lg:flex-shrink-0 max-h-[50vh] lg:max-h-none" data-testid="order-summary-panel">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
            <h2 className="font-heading font-bold text-sm text-slate-900">
              {selectedRunningOrder ? `Table ${selectedRunningOrder.table_number}` : 'Items'}
            </h2>
            <span className="text-[10px] text-slate-400 font-mono">{selectedRunningOrder ? `#${selectedRunningOrder.order_number}` : `#${orderNumber}`}</span>
          </div>

          {/* Cart Items - Table Style */}
          <ScrollArea className="flex-1">
            {cart.length > 0 ? (
              <div className="divide-y divide-slate-50">
                {cart.map((cartItem) => (
                  <div key={cartItem.item.id} className="px-3 py-2.5 flex items-center gap-2" data-testid={`cart-item-${cartItem.item.id}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-slate-900 truncate">{cartItem.item.name}</p>
                      <p className="text-[10px] text-slate-400">₹{cartItem.item.price.toFixed(0)} each</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); updateQuantity(cartItem.item.id, -1); }} className="w-6 h-6 rounded-md border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100"><Minus className="w-3 h-3" /></button>
                      <span className="w-6 text-center text-xs font-bold text-slate-900">{cartItem.quantity}</span>
                      <button onClick={(e) => { e.stopPropagation(); updateQuantity(cartItem.item.id, 1); }} className="w-6 h-6 rounded-md border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100"><Plus className="w-3 h-3" /></button>
                    </div>
                    <div className="w-14 text-right flex-shrink-0">
                      <p className="text-[10px] text-slate-400">5%</p>
                    </div>
                    <div className="w-16 text-right flex-shrink-0">
                      <p className="text-[13px] font-bold text-slate-900">₹{(cartItem.item.price * cartItem.quantity).toFixed(0)}</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); removeFromCart(cartItem.item.id); }} className="text-slate-300 hover:text-red-500 flex-shrink-0" data-testid={`remove-item-${cartItem.item.id}`}><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-slate-300">
                <ShoppingCart className="w-8 h-8 mb-2" />
                <p className="text-xs font-medium text-slate-400">Add items to order</p>
              </div>
            )}
          </ScrollArea>

          {/* Billing Summary & Actions */}
          <div className="border-t border-slate-100 flex-shrink-0">
            {cart.length > 0 && (
              <>
                {/* Billing Summary */}
                <div className="px-4 py-3 space-y-1.5 text-[13px] border-b border-slate-100">
                  <div className="flex justify-between"><span className="text-slate-500">Sub total</span><span className="font-semibold text-slate-900">₹{subtotal.toFixed(0)}</span></div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Discount</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setApplyDiscount(!applyDiscount)} className={`text-[10px] px-2 py-0.5 rounded font-semibold ${applyDiscount ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-500'}`}>
                        {applyDiscount ? '10%' : 'Off'}
                      </button>
                      <span className={`font-semibold ${discountAmount > 0 ? 'text-green-600' : 'text-slate-900'}`}>{discountAmount > 0 ? `-₹${discountAmount.toFixed(0)}` : '₹0'}</span>
                    </div>
                  </div>
                  <div className="flex justify-between"><span className="text-slate-500">Tax (5%)</span><span className="font-semibold text-slate-900">₹{taxAmount.toFixed(0)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Round off</span><span className="font-semibold text-slate-900">{roundOff >= 0 ? '' : '-'} ₹{Math.abs(roundOff).toFixed(2)}</span></div>
                </div>

                {/* Customer & Order Config */}
                <div className="px-4 py-2.5 space-y-2 border-b border-slate-100">
                  <div className="relative">
                    <Input placeholder="Phone *" value={customerPhone} onChange={e => { setCustomerPhone(e.target.value); lookupCustomer(e.target.value); }} className="h-8 text-xs rounded-lg bg-slate-50 border-slate-200" data-testid="customer-phone" />
                    {showSuggestions && suggestions.length > 0 && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                        {suggestions.map((s, i) => (
                          <button key={i} onClick={() => selectCustomer(s)} className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 border-b border-slate-50 last:border-0" data-testid={`customer-suggestion-${i}`}>
                            <span className="font-semibold text-slate-800">{s.name}</span> <span className="text-slate-400">{s.phone}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Input placeholder="Name *" value={customerName} onChange={e => setCustomerName(e.target.value)} className="h-8 text-xs rounded-lg bg-slate-50 border-slate-200" data-testid="customer-name" />
                  {!selectedRunningOrder && (
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={orderType} onValueChange={setOrderType}>
                        <SelectTrigger className="h-8 rounded-lg bg-slate-50 border-slate-200 text-xs" data-testid="order-type-select"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dine_in">Dine-in</SelectItem>
                          <SelectItem value="takeaway">Takeaway</SelectItem>
                        </SelectContent>
                      </Select>
                      {orderType === 'dine_in' && (
                        <Select value={tableNumber} onValueChange={setTableNumber}>
                          <SelectTrigger className="h-8 rounded-lg bg-slate-50 border-slate-200 text-xs" data-testid="table-select"><SelectValue placeholder="Table" /></SelectTrigger>
                          <SelectContent>
                            {availableTables.map((table) => <SelectItem key={table.id} value={table.table_number.toString()}>T-{table.table_number}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}
                </div>

                {/* Total & Action Buttons */}
                <div className="px-4 py-3 space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Total Qty: <b className="text-slate-900">{totalQty}</b></span>
                    <span>Items: <b className="text-slate-900">{cart.length}</b></span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900">Payable Amount</span>
                    <span className="text-lg font-bold text-slate-900">₹{total.toFixed(0)}</span>
                  </div>

                  {/* Action Button Row */}
                  <div className="flex gap-2">
                    {selectedRunningOrder ? (
                      <>
                        <button onClick={() => handleReleaseAndPay(selectedRunningOrder.id, 'cash')} className="flex-1 h-10 rounded-lg bg-slate-700 text-white text-xs font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5" data-testid="pay-cash"><Banknote className="w-4 h-4" /> Cash</button>
                        <button onClick={() => handleReleaseAndPay(selectedRunningOrder.id, 'card')} className="flex-1 h-10 rounded-lg bg-sky-600 text-white text-xs font-bold hover:bg-sky-700 transition-colors flex items-center justify-center gap-1.5" data-testid="pay-card"><CreditCard className="w-4 h-4" /> Card</button>
                        <button onClick={() => handleReleaseAndPay(selectedRunningOrder.id, 'upi')} className="flex-1 h-10 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5" data-testid="pay-upi"><Smartphone className="w-4 h-4" /> UPI</button>
                      </>
                    ) : (
                      <>
                        <button onClick={clearCart} className="h-10 px-3 rounded-lg bg-slate-700 text-white text-xs font-bold hover:bg-slate-800 transition-colors flex items-center gap-1.5" data-testid="hold-btn"><Pause className="w-3.5 h-3.5" /> Hold</button>
                        <button onClick={() => setApplyDiscount(!applyDiscount)} className="h-10 px-3 rounded-lg bg-sky-600 text-white text-xs font-bold hover:bg-sky-700 transition-colors flex items-center gap-1.5" data-testid="discount-toggle"><Tag className="w-3.5 h-3.5" /> Discount</button>
                        <Button onClick={handlePlaceOrder} className="flex-1 h-10 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold" disabled={!isDayOpen || checkoutLoading} data-testid="place-order-btn">
                          {checkoutLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : orderType === 'dine_in' ? 'Confirm Order' : 'Confirm Payment'}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader><DialogTitle className="text-center">Select Payment Method</DialogTitle></DialogHeader>
          <div className="py-4 space-y-3">
            <div className="text-center mb-4">
              <p className="text-2xl font-bold text-slate-900">₹{total.toFixed(2)}</p>
              <p className="text-xs text-slate-500">Total Amount</p>
            </div>
            {[
              { method: 'cash', icon: Banknote, label: 'Cash', color: 'hover:bg-green-50 hover:border-green-300' },
              { method: 'card', icon: CreditCard, label: 'Card', color: 'hover:bg-blue-50 hover:border-blue-300' },
              { method: 'upi', icon: Smartphone, label: 'UPI', color: 'hover:bg-purple-50 hover:border-purple-300' },
            ].map(({ method, icon: Icon, label, color }) => (
              <button key={method} onClick={() => handleCheckoutWithPayment(method)} disabled={checkoutLoading} className={`w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 transition-all ${color}`} data-testid={`checkout-${method}`}>
                <Icon className="w-6 h-6" /><span className="text-sm font-semibold">{label}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt Modal */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="rounded-2xl max-w-xs" data-testid="receipt-modal">
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
                {(receiptData.order.items || []).map((item, i) => (
                  <div key={i} className="flex justify-between"><span>{item.quantity}x {item.name}</span><span>₹{item.total?.toFixed(2)}</span></div>
                ))}
              </div>
              <hr className="border-dashed border-slate-300 my-1" />
              <div className="text-[11px] space-y-0.5">
                <div className="flex justify-between"><span>Subtotal</span><span>₹{receiptData.order.subtotal?.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Tax</span><span>₹{receiptData.order.tax_amount?.toFixed(2)}</span></div>
                {receiptData.order.discount_amount > 0 && <div className="flex justify-between"><span>Discount</span><span>-₹{receiptData.order.discount_amount?.toFixed(2)}</span></div>}
                <div className="flex justify-between font-bold text-sm pt-1 border-t border-dashed border-slate-300"><span>Total</span><span>₹{receiptData.order.total_amount?.toFixed(2)}</span></div>
              </div>
              <p className="text-center text-[9px] text-slate-400 mt-3">Thank you for dining with us!</p>
            </div>
          )}
          <button onClick={handlePrintReceipt} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-400 text-slate-900 text-sm font-semibold hover:bg-amber-500 transition-colors mt-2" data-testid="print-receipt-btn"><Printer className="w-4 h-4" /> Print Receipt</button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
