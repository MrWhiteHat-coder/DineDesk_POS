import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { menuAPI, orderAPI, tableAPI, receiptAPI, customerAPI } from '../../lib/api';
import { toast } from 'sonner';
import { Zap, Search, X, Banknote, CreditCard, Smartphone, Printer, Check, User } from 'lucide-react';
import { Input } from '../../components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const getImageUrl = (u) => { if (!u) return null; return u.startsWith('http') ? u : `${API_URL}${u}`; };
const FALLBACK = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&h=200&fit=crop';

export default function QuickPOSPage() {
  const { isDayOpen } = useOutletContext();
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [tables, setTables] = useState([]);
  const [selectedCat, setSelectedCat] = useState(null);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [orderType, setOrderType] = useState('takeaway');
  const [tableNum, setTableNum] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [processing, setProcessing] = useState(false);
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
  }, [suggestTimeout]);

  const selectCustomer = (c) => {
    setCustomerName(c.name || '');
    setCustomerPhone(c.phone || '');
    setCustomerEmail(c.email || '');
    setShowSuggestions(false);
  };

  useEffect(() => {
    Promise.all([menuAPI.getCategories(), menuAPI.getItems(), tableAPI.getAll()])
      .then(([c, i, t]) => {
        setCategories(c.data);
        setMenuItems(i.data.filter(item => item.is_available));
        setTables(t.data.filter(tb => tb.status === 'available'));
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = menuItems.filter(i => {
    if (selectedCat && i.category_id !== selectedCat) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const addItem = (item) => {
    if (!isDayOpen) { toast.error('Open the day first'); return; }
    setCart(prev => {
      const ex = prev.find(c => c.id === item.id);
      if (ex) return prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { id: item.id, name: item.name, price: item.price, image_url: item.image_url, qty: 1 }];
    });
  };

  const removeItem = (id) => setCart(prev => prev.filter(c => c.id !== id));
  const updateQty = (id, delta) => setCart(prev => prev.map(c => c.id === id ? { ...c, qty: Math.max(1, c.qty + delta) } : c));

  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const tax = subtotal * 0.05;
  const total = subtotal + tax;

  const quickPay = async (method) => {
    if (cart.length === 0) return;
    if (!customerName.trim()) { toast.error('Customer name is required'); return; }
    if (!customerPhone.trim()) { toast.error('Customer phone is required'); return; }
    setProcessing(true);
    try {
      const res = await orderAPI.create({
        order_type: orderType,
        table_number: orderType === 'dine_in' && tableNum ? parseInt(tableNum) : null,
        items: cart.map(c => ({ menu_item_id: c.id, quantity: c.qty, notes: null })),
        payment_method: method,
        discount_amount: 0,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_email: customerEmail.trim() || null,
      });
      toast.success(`Order #${res.data.order_number} done!`);
      try {
        const rcpt = await receiptAPI.get(res.data.id);
        setReceiptData(rcpt.data);
        setShowReceipt(true);
      } catch {}
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    } finally {
      setProcessing(false);
    }
  };

  const handlePrint = () => {
    if (receiptRef.current) {
      const win = window.open('', '_blank', 'width=320,height=600');
      if (!win) return;
      const doc = win.document;
      doc.open();
      const style = doc.createElement('style');
      style.textContent = 'body{font-family:monospace;font-size:12px;width:280px;margin:0 auto;padding:10px}h2{text-align:center;margin:4px 0}hr{border:none;border-top:1px dashed #000;margin:6px 0}.row{display:flex;justify-content:space-between}.center{text-align:center}p{margin:2px 0}';
      doc.head.appendChild(style);
      doc.title = 'Receipt';
      doc.body.innerHTML = receiptRef.current.innerHTML;
      doc.close();
      win.print();
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-gray-800 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="flex flex-col lg:flex-row gap-3 lg:h-[calc(100vh-7rem)]" data-testid="quick-pos-page">
      {/* Left: Items Grid */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
          <div className="flex items-center gap-1.5 text-gray-900 flex-shrink-0">
            <Zap className="w-5 h-5" />
            <h1 className="font-bold text-lg">Quick POS</h1>
          </div>
          <div className="flex gap-1.5 overflow-x-auto flex-1 pb-1 sm:pb-0">
            <button onClick={() => setSelectedCat(null)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${!selectedCat ? 'bg-black text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>All</button>
            {categories.map(c => (
              <button key={c.id} onClick={() => setSelectedCat(c.id)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${selectedCat === c.id ? 'bg-black text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>{c.name}</button>
            ))}
          </div>
          <div className="relative flex-shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input placeholder="Search" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 w-full sm:w-36 text-xs rounded-lg" />
          </div>
        </div>

        <div className="lg:flex-1 lg:overflow-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 content-start">
          {filtered.map(item => {
            const inCart = cart.find(c => c.id === item.id);
            return (
              <button key={item.id} onClick={() => addItem(item)} className={`relative bg-white rounded-lg border p-2 text-left hover:shadow-md transition-all hover:-translate-y-0.5 ${inCart ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-100'}`} data-testid={`quick-item-${item.id}`}>
                <div className="aspect-square rounded-md overflow-hidden bg-gray-100 mb-1.5">
                  <img src={getImageUrl(item.image_url) || FALLBACK} alt={item.name} className="w-full h-full object-cover" onError={e => { e.target.src = FALLBACK; }} />
                </div>
                <p className="text-[11px] font-semibold text-gray-900 leading-tight truncate">{item.name}</p>
                <p className="text-[11px] font-bold text-gray-700">{'\u20B9'}{item.price.toFixed(0)}</p>
                {inCart && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-black text-white rounded-full text-[10px] font-bold flex items-center justify-center">{inCart.qty}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Cart + Payment */}
      <div className="w-full lg:w-[260px] flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden lg:flex-shrink-0 lg:max-h-none">
        {/* Order Type Toggle */}
        <div className="p-2.5 border-b border-gray-100 flex gap-1.5">
          {['takeaway', 'dine_in'].map(t => (
            <button key={t} onClick={() => setOrderType(t)} className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${orderType === t ? 'bg-black text-white' : 'bg-gray-50 text-gray-600'}`}>
              {t === 'takeaway' ? 'Takeaway' : 'Dine-in'}
            </button>
          ))}
        </div>

        {orderType === 'dine_in' && (
          <div className="px-2.5 py-1.5 border-b border-gray-100">
            <select value={tableNum} onChange={e => setTableNum(e.target.value)} className="w-full h-7 text-xs rounded-lg border border-gray-200 px-2 bg-gray-50">
              <option value="">Select Table</option>
              {tables.map(t => <option key={t.id} value={t.table_number}>Table {t.table_number}</option>)}
            </select>
          </div>
        )}

        {/* Cart Items */}
        <div className="flex-1 overflow-auto p-2.5 max-h-[40vh] lg:max-h-none">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-300 min-h-[80px]">
              <Zap className="w-8 h-8 mb-1" />
              <p className="text-xs">Tap items to add</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {cart.map(c => (
                <div key={c.id} className="flex items-center gap-2 bg-gray-50 rounded-lg p-1.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-gray-800 truncate">{c.name}</p>
                    <p className="text-[10px] text-gray-500">{'\u20B9'}{c.price.toFixed(0)} x {c.qty}</p>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => updateQty(c.id, -1)} className="w-5 h-5 rounded bg-white border border-gray-200 text-gray-600 text-xs flex items-center justify-center hover:bg-gray-100">-</button>
                    <span className="text-[11px] font-bold w-4 text-center">{c.qty}</span>
                    <button onClick={() => updateQty(c.id, 1)} className="w-5 h-5 rounded bg-white border border-gray-200 text-gray-600 text-xs flex items-center justify-center hover:bg-gray-100">+</button>
                    <button onClick={() => removeItem(c.id)} className="w-5 h-5 rounded text-red-400 hover:text-red-600 text-xs flex items-center justify-center ml-0.5"><X className="w-3 h-3" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals + Customer + Pay Buttons */}
        {cart.length > 0 && (
          <div className="p-2.5 border-t border-gray-100 space-y-2">
            <div className="space-y-0.5 text-[11px]">
              <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span className="font-semibold">{'\u20B9'}{subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Tax</span><span className="font-semibold">{'\u20B9'}{tax.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm font-bold pt-1 border-t border-gray-100"><span>Total</span><span>{'\u20B9'}{total.toFixed(2)}</span></div>
            </div>
            {/* Customer Details */}
            <div className="space-y-1.5 pt-1 border-t border-gray-100">
              <p className="text-[10px] font-semibold text-gray-500 flex items-center gap-1"><User className="w-3 h-3" /> Customer Details</p>
              <div className="relative">
                <Input placeholder="Phone *" value={customerPhone} onChange={e => { setCustomerPhone(e.target.value); lookupCustomer(e.target.value); }} className="h-7 text-xs rounded-lg" data-testid="quick-customer-phone" />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                    {suggestions.map((s, i) => (
                      <button key={i} onClick={() => selectCustomer(s)} className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-gray-50 border-b border-gray-50 last:border-0" data-testid={`suggestion-${i}`}>
                        <span className="font-semibold text-gray-800">{s.name}</span> <span className="text-gray-400">{s.phone}</span>
                        <span className="text-[9px] text-gray-400 ml-1">({s.order_count} orders)</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Input placeholder="Name *" value={customerName} onChange={e => setCustomerName(e.target.value)} className="h-7 text-xs rounded-lg" data-testid="quick-customer-name" />
              <Input placeholder="Email (optional)" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} className="h-7 text-xs rounded-lg" data-testid="quick-customer-email" />
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button onClick={() => quickPay('cash')} disabled={processing} className="flex flex-col items-center gap-0.5 py-2.5 rounded-lg bg-black text-white text-[10px] font-bold hover:bg-gray-800 transition-colors disabled:opacity-50" data-testid="quick-pay-cash">
                <Banknote className="w-4 h-4" />Cash
              </button>
              <button onClick={() => quickPay('card')} disabled={processing} className="flex flex-col items-center gap-0.5 py-2.5 rounded-lg bg-black text-white text-[10px] font-bold hover:bg-gray-800 transition-colors disabled:opacity-50" data-testid="quick-pay-card">
                <CreditCard className="w-4 h-4" />Card
              </button>
              <button onClick={() => quickPay('upi')} disabled={processing} className="flex flex-col items-center gap-0.5 py-2.5 rounded-lg bg-black text-white text-[10px] font-bold hover:bg-gray-800 transition-colors disabled:opacity-50" data-testid="quick-pay-upi">
                <Smartphone className="w-4 h-4" />UPI
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Receipt Modal */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="rounded-2xl max-w-xs bg-white">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Check className="w-5 h-5 text-green-500" /> Order Complete</DialogTitle></DialogHeader>
          {receiptData && (
            <div ref={receiptRef}>
              <div className="text-center border-b border-dashed border-gray-300 pb-2 mb-2">
                <h2 className="font-bold text-base">{receiptData.restaurant.name}</h2>
                <p className="text-[10px] text-gray-500">{receiptData.restaurant.address}, {receiptData.restaurant.city}</p>
                <p className="text-[10px] text-gray-500">{receiptData.restaurant.phone}</p>
              </div>
              <div className="text-[11px] mb-2">
                <div className="flex justify-between"><span>Order #</span><span className="font-mono">{receiptData.order.order_number}</span></div>
                <div className="flex justify-between"><span>Type</span><span className="capitalize">{receiptData.order.order_type?.replace('_', ' ')}</span></div>
                <div className="flex justify-between"><span>Payment</span><span className="capitalize">{receiptData.order.payment_method}</span></div>
                <div className="flex justify-between"><span>Date</span><span>{new Date(receiptData.order.created_at).toLocaleString()}</span></div>
                {receiptData.order.customer_name && <div className="flex justify-between"><span>Customer</span><span>{receiptData.order.customer_name}</span></div>}
                {receiptData.order.customer_phone && <div className="flex justify-between"><span>Phone</span><span>{receiptData.order.customer_phone}</span></div>}
              </div>
              <hr className="border-dashed border-gray-300 my-1" />
              <div className="space-y-1 text-[11px]">
                {(receiptData.order.items || []).map((item, i) => (
                  <div key={`${item.name}-${item.quantity}-${i}`} className="flex justify-between">
                    <span>{item.quantity}x {item.name}</span>
                    <span>{'\u20B9'}{item.total?.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <hr className="border-dashed border-gray-300 my-1" />
              <div className="text-[11px] space-y-0.5">
                <div className="flex justify-between"><span>Subtotal</span><span>{'\u20B9'}{receiptData.order.subtotal?.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Tax</span><span>{'\u20B9'}{receiptData.order.tax_amount?.toFixed(2)}</span></div>
                {receiptData.order.discount_amount > 0 && <div className="flex justify-between"><span>Discount</span><span>-{'\u20B9'}{receiptData.order.discount_amount?.toFixed(2)}</span></div>}
                <div className="flex justify-between font-bold text-sm pt-1 border-t border-dashed border-gray-300"><span>Total</span><span>{'\u20B9'}{receiptData.order.total_amount?.toFixed(2)}</span></div>
              </div>
              <p className="text-center text-[9px] text-gray-400 mt-3">Thank you for dining with us!</p>
            </div>
          )}
          <button onClick={handlePrint} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white border border-gray-200 text-gray-800 text-sm font-semibold hover:bg-gray-50 transition-colors mt-2" data-testid="print-receipt-btn">
            <Printer className="w-4 h-4" /> Print Receipt
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
