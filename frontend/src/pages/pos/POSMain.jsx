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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../components/ui/dialog';
import {
  Plus, Minus, Trash2, ShoppingCart, Search, AlertCircle, X, Pencil, RefreshCw, Tag,
  Banknote, CreditCard, Smartphone, CheckCircle2, Utensils, Printer, Check, User,
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
  // Running orders for table hold
  const [runningOrders, setRunningOrders] = useState([]);
  const [selectedRunningOrder, setSelectedRunningOrder] = useState(null);
  // Payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [pendingOrderId, setPendingOrderId] = useState(null);
  // Receipt modal
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const receiptRef = useRef(null);
  // Customer details
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
    } catch (err) {
      console.error('Receipt fetch failed:', err);
    }
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
    fetchMenu();
    fetchTables();
    fetchRunningOrders();
    generateOrderNumber();
  }, []);

  const generateOrderNumber = () => {
    setOrderNumber(`B${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`);
  };

  const fetchMenu = async () => {
    try {
      const [catRes, itemsRes] = await Promise.all([menuAPI.getCategories(), menuAPI.getItems()]);
      setCategories(catRes.data);
      setMenuItems(itemsRes.data);
    } catch (err) {
      console.error('Failed to fetch menu:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTables = async () => {
    try {
      const res = await tableAPI.getAll();
      setTables(res.data);
    } catch (err) {
      console.error('Failed to fetch tables:', err);
    }
  };

  const fetchRunningOrders = async () => {
    try {
      const res = await orderAPI.getRunning();
      setRunningOrders(res.data);
    } catch (err) {
      console.error('Failed to fetch running orders:', err);
    }
  };

  const availableTables = tables.filter(t => t.status === 'available');
  const occupiedTables = tables.filter(t => t.status === 'occupied');

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

  const updateNotes = (itemId, notes) => {
    setCart((prev) => prev.map((c) => (c.item.id === itemId ? { ...c, notes } : c)));
  };

  const removeFromCart = (itemId) => setCart((prev) => prev.filter((c) => c.item.id !== itemId));
  const clearCart = () => { setCart([]); generateOrderNumber(); setSelectedRunningOrder(null); setCustomerName(''); setCustomerPhone(''); setCustomerEmail(''); };

  const subtotal = cart.reduce((sum, c) => sum + c.item.price * c.quantity, 0);
  const discountAmount = applyDiscount && subtotal >= 50 ? subtotal * 0.1 : 0;
  const taxRate = 0.05;
  const taxAmount = (subtotal - discountAmount) * taxRate;
  const total = subtotal + taxAmount - discountAmount;

  // Place order for dine-in (hold table, pending payment)
  const handlePlaceOrder = async () => {
    if (cart.length === 0) { toast.error('Cart is empty'); return; }
    if (!customerName.trim()) { toast.error('Customer name is required'); return; }
    if (!customerPhone.trim()) { toast.error('Customer phone is required'); return; }

    if (orderType === 'dine_in') {
      // If updating an existing running order
      if (selectedRunningOrder) {
        setCheckoutLoading(true);
        try {
          const originalItems = selectedRunningOrder.items || [];
          const newItems = cart.filter(c => !c.isExisting);
          const hasChanges = newItems.length > 0 || cart.length !== originalItems.length ||
            cart.some(c => {
              const orig = originalItems.find(o => o.menu_item_id === c.item.id);
              return !orig || orig.quantity !== c.quantity;
            });

          if (newItems.length > 0) {
            await orderAPI.addItems(selectedRunningOrder.id, {
              items: newItems.map((c) => ({ menu_item_id: c.item.id, quantity: c.quantity, notes: c.notes || null })),
            });
          }

          toast.success(hasChanges ? 'Order updated!' : 'No changes made');
          clearCart();
          fetchRunningOrders();
          fetchTables();
        } catch (err) {
          toast.error(err.response?.data?.detail || 'Failed to update order');
        } finally {
          setCheckoutLoading(false);
        }
        return;
      }

      // New dine-in order - hold table with pending payment
      if (!tableNumber) { toast.error('Please select a table'); return; }
      setCheckoutLoading(true);
      try {
        const orderData = {
          order_type: 'dine_in',
          table_number: parseInt(tableNumber),
          items: cart.map((c) => ({ menu_item_id: c.item.id, quantity: c.quantity, notes: c.notes || null })),
          payment_method: 'pending',
          discount_amount: discountAmount,
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          customer_email: customerEmail.trim() || null,
        };
        const res = await orderAPI.create(orderData);
        toast.success(`Order #${res.data.order_number} placed! Table held.`);
        clearCart();
        setTableNumber('');
        fetchRunningOrders();
        fetchTables();
      } catch (err) {
        toast.error(err.response?.data?.detail || 'Failed to create order');
      } finally {
        setCheckoutLoading(false);
      }
    } else {
      // Takeaway - show payment modal
      setShowPaymentModal(true);
    }
  };

  // Direct checkout with payment method
  const handleCheckoutWithPayment = async (method) => {
    setCheckoutLoading(true);
    try {
      const orderData = {
        order_type: orderType,
        table_number: null,
        items: cart.map((c) => ({ menu_item_id: c.item.id, quantity: c.quantity, notes: c.notes || null })),
        payment_method: method,
        discount_amount: discountAmount,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_email: customerEmail.trim() || null,
      };
      const res = await orderAPI.create(orderData);
      toast.success(`Order #${res.data.order_number} completed!`);
      await fetchAndShowReceipt(res.data.id);
      clearCart();
      setShowPaymentModal(false);
      setPaymentMethod('');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Release table and collect payment for running order
  const handleReleaseAndPay = async (orderId, method) => {
    try {
      await orderAPI.pay(orderId, { payment_method: method });
      toast.success('Payment confirmed! Table released.');
      await fetchAndShowReceipt(orderId);
      fetchRunningOrders();
      fetchTables();
      setSelectedRunningOrder(null);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Payment failed');
    }
  };

  const selectRunningOrder = (order) => {
    setSelectedRunningOrder(order);
    setOrderType('dine_in');
    setTableNumber(order.table_number?.toString() || '');
    // Load existing order items into the cart as editable
    const existingItems = (order.items || []).map((item) => {
      const menuItem = menuItems.find(mi => mi.id === item.menu_item_id);
      return {
        item: menuItem || { id: item.menu_item_id, name: item.name, price: item.price, image_url: null, is_available: true },
        quantity: item.quantity,
        notes: item.notes || '',
        isExisting: true,
      };
    });
    setCart(existingItems);
  };

  const getCategoryCount = (catId) => menuItems.filter(i => i.category_id === catId).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-800 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-7rem)] flex flex-col lg:flex-row gap-3 lg:gap-4" data-testid="pos-main">
      {/* Left: Menu Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Running Orders Bar */}
        {runningOrders.length > 0 && (
          <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs text-slate-500 whitespace-nowrap font-medium">Running:</span>
            {runningOrders.map((ro) => (
              <button
                key={ro.id}
                onClick={() => selectRunningOrder(ro)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap border transition-all ${
                  selectedRunningOrder?.id === ro.id
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
                data-testid={`running-order-${ro.id}`}
              >
                <Utensils className="w-3 h-3" />
                T-{ro.table_number} #{ro.order_number?.slice(-4)}
              </button>
            ))}
            {selectedRunningOrder && (
              <button onClick={() => { setSelectedRunningOrder(null); setCart([]); }} className="text-xs text-slate-400 hover:text-slate-600 ml-1">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Category Tabs + Search */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 md:gap-4 mb-3 md:mb-4">
          <div className="flex items-center gap-2 overflow-x-auto flex-1 pb-1 w-full md:w-auto">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                !selectedCategory ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
              data-testid="category-all"
            >
              All <span className={`text-xs px-1.5 py-0.5 rounded-md ${!selectedCategory ? 'bg-white/20' : 'bg-slate-100'}`}>{menuItems.length}</span>
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat.id ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
                data-testid={`category-${cat.name.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {cat.name} <span className={`text-xs px-1.5 py-0.5 rounded-md ${selectedCategory === cat.id ? 'bg-white/20' : 'bg-slate-100'}`}>{getCategoryCount(cat.id)}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 w-full md:w-auto">
            <button onClick={fetchMenu} className="hidden md:flex items-center gap-1.5 px-3 py-2 text-sm text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-lg transition-colors" data-testid="refresh-menu-btn">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            <div className="relative flex-1 md:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input placeholder="Search Menu" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-9 w-full md:w-48 bg-white border-slate-200 rounded-lg text-sm" data-testid="menu-search-input" />
            </div>
          </div>
        </div>

        {/* Menu Grid */}
        <ScrollArea className="flex-1 -mr-2 pr-2">
          {filteredItems.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 md:gap-3">
              {filteredItems.map((item) => {
                const qty = getCartQuantity(item.id);
                const imgSrc = getImageUrl(item.image_url) || FALLBACK_IMG;
                return (
                  <div key={item.id} className="bg-white rounded-xl overflow-hidden border border-slate-100 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5" data-testid={`menu-item-${item.id}`}>
                    <div className="relative aspect-[4/3] bg-slate-100">
                      <img src={imgSrc} alt={item.name} className="w-full h-full object-cover" onError={(e) => { e.target.src = FALLBACK_IMG; }} />
                      <span className={`absolute top-2.5 right-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${item.is_available ? 'bg-white text-green-700' : 'bg-white text-red-600'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${item.is_available ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        {item.is_available ? 'Available' : 'Not Available'}
                      </span>
                    </div>
                    <div className="p-3">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-sm font-semibold text-slate-900 leading-tight line-clamp-1 flex-1">{item.name}</h3>
                        <span className="text-sm font-bold text-slate-900 ml-2 whitespace-nowrap">₹{item.price.toFixed(2)}</span>
                      </div>
                      {!item.is_available ? (
                        <button disabled className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-50 text-red-400 text-xs font-semibold cursor-not-allowed" data-testid={`unavailable-${item.id}`}>
                          <X className="w-3.5 h-3.5" /> Not Available
                        </button>
                      ) : qty > 0 ? (
                        <button onClick={() => addToCart(item)} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition-colors" data-testid={`add-more-${item.id}`}>
                          Add More ({qty})
                        </button>
                      ) : (
                        <button onClick={() => addToCart(item)} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-800 text-white text-xs font-semibold hover:bg-slate-900 transition-colors" data-testid={`add-item-${item.id}`}>
                          <Plus className="w-3.5 h-3.5" /> Add to Cart
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <AlertCircle className="w-12 h-12 mb-4" />
              <p className="text-lg font-medium">No menu items found</p>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right: Order Summary Panel */}
      <div className="w-full lg:w-[320px] flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden lg:flex-shrink-0 max-h-[45vh] lg:max-h-none">
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-bold text-base text-slate-900">
              {selectedRunningOrder ? `Table ${selectedRunningOrder.table_number}` : 'Order Summary'}
            </h2>
            <span className="text-xs text-slate-400 font-mono">
              {selectedRunningOrder ? `#${selectedRunningOrder.order_number}` : `#${orderNumber}`}
            </span>
          </div>
        </div>

        {/* Existing items for running order - removed since items are now in editable cart */}

        {/* Cart Items */}
        <ScrollArea className="flex-1 px-4 py-3">
          {cart.length > 0 ? (
            <div className="space-y-3">
              {cart.map((cartItem) => {
                const imgSrc = getImageUrl(cartItem.item.image_url) || FALLBACK_IMG;
                return (
                  <div key={cartItem.item.id} className="flex gap-3" data-testid={`cart-item-${cartItem.item.id}`}>
                    <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100">
                      <img src={imgSrc} alt={cartItem.item.name} className="w-full h-full object-cover" onError={(e) => { e.target.src = FALLBACK_IMG; }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0 pr-1">
                          <h4 className="text-sm font-semibold text-slate-900 leading-tight truncate">{cartItem.item.name} ({cartItem.quantity})</h4>
                          <input type="text" placeholder="Notes..." value={cartItem.notes} onChange={(e) => updateNotes(cartItem.item.id, e.target.value)} className="text-[11px] text-slate-400 bg-transparent border-none outline-none w-full mt-0.5" />
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => updateQuantity(cartItem.item.id, -1)} className="text-slate-400 hover:text-slate-600 p-0.5"><Minus className="w-3.5 h-3.5" /></button>
                          <button onClick={() => updateQuantity(cartItem.item.id, 1)} className="text-slate-400 hover:text-slate-600 p-0.5"><Plus className="w-3.5 h-3.5" /></button>
                          <button onClick={() => removeFromCart(cartItem.item.id)} className="text-slate-400 hover:text-red-500 p-0.5" data-testid={`remove-item-${cartItem.item.id}`}><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                      <p className="text-sm font-bold text-slate-900 mt-1">₹{(cartItem.item.price * cartItem.quantity).toFixed(2)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : !selectedRunningOrder ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-300">
              <ShoppingCart className="w-10 h-10 mb-2" />
              <p className="text-sm font-medium text-slate-400">Cart is empty</p>
            </div>
          ) : null}
        </ScrollArea>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-100 space-y-3">
          {/* Totals */}
          {cart.length > 0 && (
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="font-semibold text-slate-900">₹{subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Taxes (5%)</span><span className="font-semibold text-slate-900">₹{taxAmount.toFixed(2)}</span></div>
              {discountAmount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span className="font-semibold">-₹{discountAmount.toFixed(2)}</span></div>}
              <div className="flex justify-between pt-2 border-t border-slate-100 text-base font-bold">
                <span className="text-slate-900">Total</span><span className="text-slate-900">₹{total.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Order Type & Table (only for new orders) */}
          {!selectedRunningOrder && cart.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] text-slate-400 mb-1 block">Order Type</Label>
                <Select value={orderType} onValueChange={setOrderType}>
                  <SelectTrigger className="h-8 rounded-lg bg-slate-50 border-slate-200 text-xs" data-testid="order-type-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dine_in">Dine-in</SelectItem>
                    <SelectItem value="takeaway">Takeaway</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {orderType === 'dine_in' && (
                <div>
                  <Label className="text-[11px] text-slate-400 mb-1 block">Select Table</Label>
                  <Select value={tableNumber} onValueChange={setTableNumber}>
                    <SelectTrigger className="h-8 rounded-lg bg-slate-50 border-slate-200 text-xs" data-testid="table-select"><SelectValue placeholder="Table" /></SelectTrigger>
                    <SelectContent>
                      {availableTables.map((table) => (
                        <SelectItem key={table.id} value={table.table_number.toString()}>T-{table.table_number}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {/* Discount */}
          {cart.length > 0 && (
            <button
              onClick={() => setApplyDiscount(!applyDiscount)}
              className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg border text-xs transition-colors ${
                applyDiscount ? 'bg-green-50 border-green-200 text-green-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
              data-testid="discount-toggle"
            >
              <Tag className="w-4 h-4" />
              <div className="text-left"><p className="font-semibold">10% Discount</p><p className="text-[10px] opacity-70">Minimum Buy ₹50.00</p></div>
              {applyDiscount && <div className="ml-auto w-2 h-2 rounded-full bg-green-500"></div>}
            </button>
          )}

          {/* Customer Details */}
          {cart.length > 0 && (
            <div className="space-y-2 pt-1 border-t border-slate-100">
              <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1"><User className="w-3.5 h-3.5" /> Customer Details</p>
              <div className="relative">
                <Input placeholder="Phone *" value={customerPhone} onChange={e => { setCustomerPhone(e.target.value); lookupCustomer(e.target.value); }} className="h-8 text-xs rounded-lg bg-slate-50 border-slate-200" data-testid="customer-phone" />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                    {suggestions.map((s, i) => (
                      <button key={i} onClick={() => selectCustomer(s)} className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 border-b border-slate-50 last:border-0" data-testid={`customer-suggestion-${i}`}>
                        <span className="font-semibold text-slate-800">{s.name}</span> <span className="text-slate-400">{s.phone}</span>
                        <span className="text-[9px] text-slate-400 ml-1">({s.order_count} orders)</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Input placeholder="Name *" value={customerName} onChange={e => setCustomerName(e.target.value)} className="h-8 text-xs rounded-lg bg-slate-50 border-slate-200" data-testid="customer-name" />
              <Input placeholder="Email (optional)" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} className="h-8 text-xs rounded-lg bg-slate-50 border-slate-200" data-testid="customer-email" />
            </div>
          )}

          {/* Action Buttons */}
          {cart.length > 0 && (
            <Button
              onClick={handlePlaceOrder}
              className="w-full h-11 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-semibold text-sm"
              disabled={!isDayOpen || checkoutLoading}
              data-testid="place-order-btn"
            >
              {checkoutLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : selectedRunningOrder ? 'Update Order' : orderType === 'dine_in' ? 'Place Order & Hold Table' : 'Proceed to Payment'}
            </Button>
          )}

          {/* Release & Pay for running orders */}
          {selectedRunningOrder && (
            <div className="space-y-2">
              <p className="text-[11px] font-medium text-slate-500 text-center">Release Table & Collect Payment</p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => handleReleaseAndPay(selectedRunningOrder.id, 'cash')}
                  className="flex flex-col items-center gap-1 p-2.5 rounded-lg border border-slate-200 hover:bg-green-50 hover:border-green-300 transition-all text-slate-600 hover:text-green-700"
                  data-testid="pay-cash"
                >
                  <Banknote className="w-5 h-5" />
                  <span className="text-[10px] font-semibold">Cash</span>
                </button>
                <button
                  onClick={() => handleReleaseAndPay(selectedRunningOrder.id, 'card')}
                  className="flex flex-col items-center gap-1 p-2.5 rounded-lg border border-slate-200 hover:bg-blue-50 hover:border-blue-300 transition-all text-slate-600 hover:text-blue-700"
                  data-testid="pay-card"
                >
                  <CreditCard className="w-5 h-5" />
                  <span className="text-[10px] font-semibold">Card</span>
                </button>
                <button
                  onClick={() => handleReleaseAndPay(selectedRunningOrder.id, 'upi')}
                  className="flex flex-col items-center gap-1 p-2.5 rounded-lg border border-slate-200 hover:bg-purple-50 hover:border-purple-300 transition-all text-slate-600 hover:text-purple-700"
                  data-testid="pay-upi"
                >
                  <Smartphone className="w-5 h-5" />
                  <span className="text-[10px] font-semibold">UPI</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment Method Modal (for takeaway) */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">Select Payment Method</DialogTitle>
          </DialogHeader>
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
              <button
                key={method}
                onClick={() => handleCheckoutWithPayment(method)}
                disabled={checkoutLoading}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 transition-all ${color}`}
                data-testid={`checkout-${method}`}
              >
                <Icon className="w-6 h-6" />
                <span className="text-sm font-semibold">{label}</span>
                <CheckCircle2 className="w-5 h-5 ml-auto opacity-0 group-hover:opacity-100" />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt Modal */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="rounded-2xl max-w-xs" data-testid="receipt-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-500" /> Order Complete
            </DialogTitle>
          </DialogHeader>
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
                {receiptData.order.discount_amount > 0 && (
                  <div className="flex justify-between"><span>Discount</span><span>-₹{receiptData.order.discount_amount?.toFixed(2)}</span></div>
                )}
                <div className="flex justify-between font-bold text-sm pt-1 border-t border-dashed border-slate-300">
                  <span>Total</span><span>₹{receiptData.order.total_amount?.toFixed(2)}</span>
                </div>
              </div>
              <p className="text-center text-[9px] text-slate-400 mt-3">Thank you for dining with us!</p>
            </div>
          )}
          <button
            onClick={handlePrintReceipt}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-slate-800 text-white text-sm font-semibold hover:bg-slate-900 transition-colors mt-2"
            data-testid="print-receipt-btn"
          >
            <Printer className="w-4 h-4" /> Print Receipt
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
