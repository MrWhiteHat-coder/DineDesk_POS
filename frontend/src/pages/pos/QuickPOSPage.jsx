import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { menuAPI, orderAPI, tableAPI, receiptAPI, customerAPI } from '../../lib/api';
import { toast } from 'sonner';
import { Search, X, Minus, Plus, Trash2, Filter } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const getImageUrl = (u) => { if (!u) return null; return u.startsWith('http') ? u : `${API_URL}${u}`; };
const FALLBACK = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop';

export default function QuickPOSPage() {
  const { isDayOpen } = useOutletContext();
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [selectedCat, setSelectedCat] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [orderType, setOrderType] = useState('takeaway');
  const [tableNum, setTableNum] = useState('');
  const [processing, setProcessing] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
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
    setShowSuggestions(false);
  };

  useEffect(() => {
    Promise.all([menuAPI.getCategories(), menuAPI.getItems(), tableAPI.getAll()])
      .then(([c, i]) => {
        setCategories(c.data);
        setMenuItems(i.data.filter(item => item.is_available));
        if (c.data.length > 0) setSelectedCat(c.data[0].id);
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

  const handleCheckout = async (method) => {
    if (cart.length === 0) { toast.error('Cart is empty'); return; }
    if (!customerName.trim()) { toast.error('Customer name is required'); return; }
    setProcessing(true);
    try {
      const res = await orderAPI.create({
        order_type: orderType,
        table_number: orderType === 'dine_in' && tableNum ? parseInt(tableNum) : null,
        items: cart.map(c => ({ menu_item_id: c.id, quantity: c.qty, notes: null })),
        payment_method: method,
        discount_amount: 0,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim() || '0000000000',
      });
      toast.success(`Order #${res.data.order_number} created!`);
      setCart([]);
      setSelectedItem(null);
      setCustomerName('');
      setCustomerPhone('');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create order');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#E53935] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-10rem)]" data-testid="quick-pos-page">
      {/* Left: Menu Items */}
      <div className="flex-1 flex flex-col min-w-0">
        <h1 className="text-xl font-bold text-[#1A1A1A] mb-4">Meal Category</h1>

        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          {categories.map(c => (
            <button
              key={c.id}
              onClick={() => { setSelectedCat(c.id); setSelectedItem(null); }}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                selectedCat === c.id
                  ? 'bg-[#E53935] text-white shadow-md'
                  : 'bg-white text-[#6B7280] border border-[#E8E8E8] hover:bg-[#F8F9FA]'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Search & Filter */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
            <input
              type="text"
              placeholder="Search menu items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="on-input pl-10 w-full"
            />
          </div>
          <button className="on-btn-secondary flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filter
          </button>
        </div>

        {/* Menu Grid */}
        <div className="flex-1 overflow-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 content-start">
          {filtered.map(item => {
            const inCart = cart.find(c => c.id === item.id);
            const isSelected = selectedItem?.id === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setSelectedItem(item); addItem(item); }}
                className={`relative bg-white rounded-2xl border overflow-hidden text-left transition-all hover:shadow-md hover:-translate-y-0.5 ${
                  isSelected ? 'border-[#E53935] ring-2 ring-[#E53935]/20' : 'border-[#E8E8E8]'
                }`}
              >
                <div className="aspect-[4/3] overflow-hidden bg-[#F8F9FA]">
                  <img
                    src={getImageUrl(item.image_url) || FALLBACK}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.src = FALLBACK; }}
                  />
                </div>
                <div className="p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-[#1A1A1A] text-sm truncate">{item.name}</p>
                    {item.is_bestseller && (
                      <span className="on-badge-success text-[9px] ml-1">Best</span>
                    )}
                  </div>
                  <p className="text-xs text-[#9CA3AF] mt-0.5">{item.category_name || 'Food'}</p>
                  <p className="text-sm font-bold text-[#1A1A1A] mt-1">₹{item.price.toFixed(0)}</p>
                </div>
                {inCart && (
                  <span className="absolute top-2 right-2 w-6 h-6 bg-[#E53935] text-white rounded-full text-xs font-bold flex items-center justify-center shadow-md">
                    {inCart.qty}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: My Order (Cart) */}
      <div className="w-full lg:w-[320px] bg-white rounded-2xl border border-[#E8E8E8] flex flex-col overflow-hidden flex-shrink-0">
        {/* Cart Header */}
        <div className="p-4 border-b border-[#E8E8E8]">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-[#1A1A1A]">My Order</h2>
            <span className="text-sm text-[#9CA3AF]">{cart.reduce((s, c) => s + c.qty, 0)} positions</span>
          </div>
        </div>

        {/* Customer Info */}
        <div className="p-4 border-b border-[#E8E8E8] space-y-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Customer name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="on-input text-sm w-full"
            />
          </div>
          <div className="relative">
            <input
              type="tel"
              placeholder="Phone number"
              value={customerPhone}
              onChange={(e) => {
                setCustomerPhone(e.target.value);
                lookupCustomer(e.target.value);
              }}
              className="on-input text-sm w-full"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#E8E8E8] rounded-xl shadow-lg z-10 max-h-32 overflow-auto">
                {suggestions.map(c => (
                  <button
                    key={c.id}
                    onClick={() => selectCustomer(c)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[#F8F9FA] transition-colors"
                  >
                    <span className="font-medium">{c.name}</span>
                    <span className="text-[#9CA3AF] ml-2">{c.phone}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Order Type */}
          <div className="flex gap-2">
            {['takeaway', 'dine_in'].map(type => (
              <button
                key={type}
                onClick={() => setOrderType(type)}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                  orderType === type
                    ? 'bg-[#1A1A1A] text-white'
                    : 'bg-[#F8F9FA] text-[#6B7280] hover:bg-[#E8E8E8]'
                }`}
              >
                {type === 'takeaway' ? 'Takeaway' : 'Dine In'}
              </button>
            ))}
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[#9CA3AF]">Your order is empty</p>
              <p className="text-xs text-[#D1D5DB] mt-1">Click items to add them</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex items-center gap-3 p-3 bg-[#F8F9FA] rounded-xl">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#E8E8E8] flex-shrink-0">
                  <img
                    src={getImageUrl(item.image_url) || FALLBACK}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.src = FALLBACK; }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#1A1A1A] text-sm truncate">{item.name}</p>
                  <p className="text-xs text-[#9CA3AF]">{item.qty} × ₹{item.price.toFixed(0)}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => updateQty(item.id, -1)}
                    className="w-6 h-6 rounded-lg bg-white border border-[#E8E8E8] flex items-center justify-center hover:bg-[#F8F9FA] transition-colors"
                  >
                    <Minus className="w-3 h-3 text-[#6B7280]" />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold">{item.qty}</span>
                  <button
                    onClick={() => updateQty(item.id, 1)}
                    className="w-6 h-6 rounded-lg bg-white border border-[#E8E8E8] flex items-center justify-center hover:bg-[#F8F9FA] transition-colors"
                  >
                    <Plus className="w-3 h-3 text-[#6B7280]" />
                  </button>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="w-6 h-6 rounded-lg bg-[#FEF2F2] flex items-center justify-center hover:bg-[#FECACA] transition-colors ml-1"
                  >
                    <Trash2 className="w-3 h-3 text-[#EF4444]" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart Footer */}
        <div className="p-4 border-t border-[#E8E8E8] space-y-3">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-[#6B7280]">
              <span>Subtotal</span>
              <span>₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[#6B7280]">
              <span>Tax (5%)</span>
              <span>₹{tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-[#1A1A1A] text-base pt-1.5 border-t border-[#E8E8E8]">
              <span>Total</span>
              <span>₹{total.toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={() => handleCheckout('cash')}
            disabled={processing || cart.length === 0}
            className="on-btn-primary w-full py-3 text-base"
          >
            {processing ? 'Processing...' : 'Pay ₹' + total.toFixed(0)}
          </button>
        </div>
      </div>
    </div>
  );
}
