import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { menuAPI, orderAPI, tableAPI, receiptAPI } from '../../lib/api';
import { toast } from 'sonner';
import { Zap, Search, X, Banknote, CreditCard, Smartphone, Printer, Check } from 'lucide-react';
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
    setProcessing(true);
    try {
      const res = await orderAPI.create({
        order_type: orderType,
        table_number: orderType === 'dine_in' && tableNum ? parseInt(tableNum) : null,
        items: cart.map(c => ({ menu_item_id: c.id, quantity: c.qty, notes: null })),
        payment_method: method,
        discount_amount: 0,
      });
      toast.success(`Order #${res.data.order_number} done!`);
      // Fetch receipt
      try {
        const rcpt = await receiptAPI.get(res.data.id);
        setReceiptData(rcpt.data);
        setShowReceipt(true);
      } catch {}
      setCart([]);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    } finally {
      setProcessing(false);
    }
  };

  const handlePrint = () => {
    if (receiptRef.current) {
      const win = window.open('', '_blank', 'width=320,height=600');
      win.document.write(`<html><head><title>Receipt</title><style>body{font-family:monospace;font-size:12px;width:280px;margin:0 auto;padding:10px}h2{text-align:center;margin:4px 0}hr{border:none;border-top:1px dashed #000;margin:6px 0}.row{display:flex;justify-content:space-between}.center{text-align:center}p{margin:2px 0}</style></head><body>`);
      win.document.write(receiptRef.current.innerHTML);
      win.document.write('</body></html>');
      win.document.close();
      win.print();
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-slate-800 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="h-[calc(100vh-7rem)] flex gap-3" data-testid="quick-pos-page">
      {/* Left: Items Grid */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-1.5 text-slate-800">
            <Zap className="w-5 h-5" />
            <h1 className="font-bold text-lg">Quick POS</h1>
          </div>
          <div className="flex gap-1.5 ml-4 overflow-x-auto flex-1">
            <button onClick={() => setSelectedCat(null)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${!selectedCat ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>All</button>
            {categories.map(c => (
              <button key={c.id} onClick={() => setSelectedCat(c.id)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${selectedCat === c.id ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>{c.name}</button>
            ))}
          </div>
          <div className="relative flex-shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input placeholder="Search" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 w-36 text-xs rounded-lg" />
          </div>
        </div>

        <div className="flex-1 overflow-auto grid grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2 content-start">
          {filtered.map(item => {
            const inCart = cart.find(c => c.id === item.id);
            return (
              <button key={item.id} onClick={() => addItem(item)} className={`relative bg-white rounded-lg border p-2 text-left hover:shadow-md transition-all hover:-translate-y-0.5 ${inCart ? 'border-slate-800 ring-1 ring-slate-800' : 'border-slate-100'}`} data-testid={`quick-item-${item.id}`}>
                <div className="aspect-square rounded-md overflow-hidden bg-slate-100 mb-1.5">
                  <img src={getImageUrl(item.image_url) || FALLBACK} alt={item.name} className="w-full h-full object-cover" onError={e => { e.target.src = FALLBACK; }} />
                </div>
                <p className="text-[11px] font-semibold text-slate-900 leading-tight truncate">{item.name}</p>
                <p className="text-[11px] font-bold text-slate-700">₹{item.price.toFixed(0)}</p>
                {inCart && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-slate-800 text-white rounded-full text-[10px] font-bold flex items-center justify-center">{inCart.qty}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Cart + Payment */}
      <div className="w-[260px] flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden flex-shrink-0">
        {/* Order Type Toggle */}
        <div className="p-2.5 border-b border-slate-100 flex gap-1.5">
          {['takeaway', 'dine_in'].map(t => (
            <button key={t} onClick={() => setOrderType(t)} className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${orderType === t ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-600'}`}>
              {t === 'takeaway' ? 'Takeaway' : 'Dine-in'}
            </button>
          ))}
        </div>

        {orderType === 'dine_in' && (
          <div className="px-2.5 py-1.5 border-b border-slate-100">
            <select value={tableNum} onChange={e => setTableNum(e.target.value)} className="w-full h-7 text-xs rounded-lg border border-slate-200 px-2 bg-slate-50">
              <option value="">Select Table</option>
              {tables.map(t => <option key={t.id} value={t.table_number}>Table {t.table_number}</option>)}
            </select>
          </div>
        )}

        {/* Cart Items */}
        <div className="flex-1 overflow-auto p-2.5">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-300">
              <Zap className="w-8 h-8 mb-1" />
              <p className="text-xs">Tap items to add</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {cart.map(c => (
                <div key={c.id} className="flex items-center gap-2 bg-slate-50 rounded-lg p-1.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-slate-800 truncate">{c.name}</p>
                    <p className="text-[10px] text-slate-500">₹{c.price.toFixed(0)} x {c.qty}</p>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => updateQty(c.id, -1)} className="w-5 h-5 rounded bg-white border border-slate-200 text-slate-600 text-xs flex items-center justify-center hover:bg-slate-100">-</button>
                    <span className="text-[11px] font-bold w-4 text-center">{c.qty}</span>
                    <button onClick={() => updateQty(c.id, 1)} className="w-5 h-5 rounded bg-white border border-slate-200 text-slate-600 text-xs flex items-center justify-center hover:bg-slate-100">+</button>
                    <button onClick={() => removeItem(c.id)} className="w-5 h-5 rounded text-red-400 hover:text-red-600 text-xs flex items-center justify-center ml-0.5"><X className="w-3 h-3" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals + Pay Buttons */}
        {cart.length > 0 && (
          <div className="p-2.5 border-t border-slate-100 space-y-2">
            <div className="space-y-0.5 text-[11px]">
              <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="font-semibold">₹{subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Tax</span><span className="font-semibold">₹{tax.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm font-bold pt-1 border-t border-slate-100"><span>Total</span><span>₹{total.toFixed(2)}</span></div>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button onClick={() => quickPay('cash')} disabled={processing} className="flex flex-col items-center gap-0.5 py-2.5 rounded-lg bg-green-600 text-white text-[10px] font-bold hover:bg-green-700 transition-colors disabled:opacity-50" data-testid="quick-pay-cash">
                <Banknote className="w-4 h-4" />Cash
              </button>
              <button onClick={() => quickPay('card')} disabled={processing} className="flex flex-col items-center gap-0.5 py-2.5 rounded-lg bg-blue-600 text-white text-[10px] font-bold hover:bg-blue-700 transition-colors disabled:opacity-50" data-testid="quick-pay-card">
                <CreditCard className="w-4 h-4" />Card
              </button>
              <button onClick={() => quickPay('upi')} disabled={processing} className="flex flex-col items-center gap-0.5 py-2.5 rounded-lg bg-purple-600 text-white text-[10px] font-bold hover:bg-purple-700 transition-colors disabled:opacity-50" data-testid="quick-pay-upi">
                <Smartphone className="w-4 h-4" />UPI
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Receipt Modal */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="rounded-2xl max-w-xs">
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
              </div>
              <hr className="border-dashed border-slate-300 my-1" />
              <div className="space-y-1 text-[11px]">
                {(receiptData.order.items || []).map((item, i) => (
                  <div key={i} className="flex justify-between">
                    <span>{item.quantity}x {item.name}</span>
                    <span>₹{item.total?.toFixed(2)}</span>
                  </div>
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
          <button onClick={handlePrint} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-slate-800 text-white text-sm font-semibold hover:bg-slate-900 transition-colors mt-2" data-testid="print-receipt-btn">
            <Printer className="w-4 h-4" /> Print Receipt
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
