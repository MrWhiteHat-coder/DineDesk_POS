import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { menuAPI, orderAPI } from '../../lib/api';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { ScrollArea } from '../../components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import {
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  CreditCard,
  Banknote,
  Smartphone,
  Search,
  Leaf,
  AlertCircle,
  X,
} from 'lucide-react';

export default function POSMain() {
  const { isDayOpen } = useOutletContext();
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [cart, setCart] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Checkout state
  const [showCheckout, setShowCheckout] = useState(false);
  const [orderType, setOrderType] = useState('dine_in');
  const [tableNumber, setTableNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [discount, setDiscount] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    fetchMenu();
  }, []);

  const fetchMenu = async () => {
    try {
      const [catRes, itemsRes] = await Promise.all([
        menuAPI.getCategories(),
        menuAPI.getItems(),
      ]);
      setCategories(catRes.data);
      setMenuItems(itemsRes.data);
      if (catRes.data.length > 0) {
        setSelectedCategory(catRes.data[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch menu:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter items by category and search
  const filteredItems = menuItems.filter((item) => {
    const matchesCategory = !selectedCategory || item.category_id === selectedCategory;
    const matchesSearch = !searchQuery || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Cart functions
  const addToCart = (item) => {
    if (!isDayOpen) {
      toast.error('Please open the day first to take orders');
      return;
    }
    
    if (!item.is_available) {
      toast.error('This item is not available');
      return;
    }

    setCart((prev) => {
      const existing = prev.find((c) => c.item.id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { item, quantity: 1, notes: '' }];
    });
    toast.success(`${item.name} added to cart`);
  };

  const updateQuantity = (itemId, delta) => {
    setCart((prev) =>
      prev
        .map((c) =>
          c.item.id === itemId
            ? { ...c, quantity: Math.max(0, c.quantity + delta) }
            : c
        )
        .filter((c) => c.quantity > 0)
    );
  };

  const updateNotes = (itemId, notes) => {
    setCart((prev) =>
      prev.map((c) => (c.item.id === itemId ? { ...c, notes } : c))
    );
  };

  const removeFromCart = (itemId) => {
    setCart((prev) => prev.filter((c) => c.item.id !== itemId));
  };

  const clearCart = () => {
    setCart([]);
  };

  // Calculate totals
  const subtotal = cart.reduce((sum, c) => sum + c.item.price * c.quantity, 0);
  const discountAmount = parseFloat(discount) || 0;
  const taxRate = 0.05;
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount - discountAmount;

  // Checkout
  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    if (orderType === 'dine_in' && !tableNumber) {
      toast.error('Please select a table for dine-in orders');
      return;
    }

    setCheckoutLoading(true);
    try {
      const orderData = {
        order_type: orderType,
        table_number: orderType === 'dine_in' ? parseInt(tableNumber) : null,
        items: cart.map((c) => ({
          menu_item_id: c.item.id,
          quantity: c.quantity,
          notes: c.notes || null,
        })),
        customer_name: customerName || null,
        customer_phone: customerPhone || null,
        payment_method: paymentMethod,
        discount_amount: discountAmount,
      };

      const response = await orderAPI.create(orderData);
      
      toast.success(`Order #${response.data.order_number} created successfully!`);
      
      // Reset
      setCart([]);
      setShowCheckout(false);
      setOrderType('dine_in');
      setTableNumber('');
      setCustomerName('');
      setCustomerPhone('');
      setPaymentMethod('cash');
      setDiscount('');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create order');
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-6" data-testid="pos-main">
      {/* Left: Menu */}
      <div className="flex-1 flex flex-col">
        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              placeholder="Search menu items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12"
              data-testid="menu-search-input"
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          <Button
            variant={!selectedCategory ? 'default' : 'outline'}
            onClick={() => setSelectedCategory(null)}
            className={`flex-shrink-0 ${!selectedCategory ? 'bg-orange-500 hover:bg-orange-600' : ''}`}
            data-testid="category-all"
          >
            All Items
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat.id}
              variant={selectedCategory === cat.id ? 'default' : 'outline'}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex-shrink-0 ${
                selectedCategory === cat.id ? 'bg-orange-500 hover:bg-orange-600' : ''
              }`}
              data-testid={`category-${cat.name.toLowerCase()}`}
            >
              {cat.name}
            </Button>
          ))}
        </div>

        {/* Menu Grid */}
        <ScrollArea className="flex-1">
          {filteredItems.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pr-4">
              {filteredItems.map((item) => (
                <Card
                  key={item.id}
                  className={`cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 ${
                    !item.is_available ? 'opacity-60' : ''
                  }`}
                  onClick={() => addToCart(item)}
                  data-testid={`menu-item-${item.id}`}
                >
                  <CardContent className="p-0">
                    <div className="relative">
                      <img
                        src={item.image_url || 'https://via.placeholder.com/200x150?text=Food'}
                        alt={item.name}
                        className="w-full h-32 object-cover rounded-t-lg"
                      />
                      {item.is_vegetarian && (
                        <Badge className="absolute top-2 left-2 bg-green-500">
                          <Leaf className="w-3 h-3 mr-1" />
                          Veg
                        </Badge>
                      )}
                      {!item.is_available && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-t-lg">
                          <span className="text-white font-medium">Not Available</span>
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="font-medium text-slate-900 truncate">{item.name}</h3>
                      <div className="flex items-center justify-between mt-2">
                        <span className="font-numbers text-lg font-bold text-orange-500">
                          ₹{item.price.toFixed(2)}
                        </span>
                        <Button
                          size="sm"
                          className="bg-orange-500 hover:bg-orange-600 h-8 w-8 p-0"
                          disabled={!item.is_available}
                          data-testid={`add-item-${item.id}`}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <AlertCircle className="w-12 h-12 mb-4" />
              <p>No menu items found</p>
              <p className="text-sm">Add items in Menu Management</p>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right: Cart */}
      <div className="w-96 flex flex-col bg-white rounded-lg border border-slate-200 shadow-sm">
        {/* Cart Header */}
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-semibold text-lg flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-orange-500" />
              Order Summary
            </h2>
            {cart.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearCart}
                className="text-slate-400 hover:text-red-500"
                data-testid="clear-cart-btn"
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Cart Items */}
        <ScrollArea className="flex-1 p-4">
          {cart.length > 0 ? (
            <div className="space-y-3">
              {cart.map((cartItem) => (
                <div
                  key={cartItem.item.id}
                  className="bg-slate-50 rounded-lg p-3"
                  data-testid={`cart-item-${cartItem.item.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-slate-900">{cartItem.item.name}</h4>
                      <p className="text-sm text-slate-500">
                        ₹{cartItem.item.price.toFixed(2)} each
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFromCart(cartItem.item.id)}
                      className="text-slate-400 hover:text-red-500 -mr-2"
                      data-testid={`remove-item-${cartItem.item.id}`}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateQuantity(cartItem.item.id, -1)}
                        className="h-8 w-8 p-0"
                        data-testid={`decrease-${cartItem.item.id}`}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="font-numbers font-semibold w-8 text-center">
                        {cartItem.quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateQuantity(cartItem.item.id, 1)}
                        className="h-8 w-8 p-0"
                        data-testid={`increase-${cartItem.item.id}`}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    <span className="font-numbers font-semibold text-slate-900">
                      ₹{(cartItem.item.price * cartItem.quantity).toFixed(2)}
                    </span>
                  </div>

                  <Input
                    placeholder="Add notes for kitchen..."
                    value={cartItem.notes}
                    onChange={(e) => updateNotes(cartItem.item.id, e.target.value)}
                    className="mt-2 h-8 text-sm"
                    data-testid={`notes-${cartItem.item.id}`}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <ShoppingCart className="w-12 h-12 mb-2" />
              <p>Cart is empty</p>
              <p className="text-sm">Add items to get started</p>
            </div>
          )}
        </ScrollArea>

        {/* Cart Footer */}
        {cart.length > 0 && (
          <div className="p-4 border-t border-slate-200 space-y-3">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-numbers">₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">GST (5%)</span>
                <span className="font-numbers">₹{taxAmount.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount</span>
                  <span className="font-numbers">-₹{discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-lg pt-2 border-t border-slate-200">
                <span>Total</span>
                <span className="font-numbers text-orange-500">₹{total.toFixed(2)}</span>
              </div>
            </div>

            <Button
              onClick={() => setShowCheckout(true)}
              className="w-full h-14 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-lg"
              disabled={!isDayOpen}
              data-testid="checkout-btn"
            >
              <CreditCard className="w-5 h-5 mr-2" />
              Proceed to Checkout
            </Button>
          </div>
        )}
      </div>

      {/* Checkout Modal */}
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Complete Order</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Order Type */}
            <div className="space-y-2">
              <Label>Order Type</Label>
              <Select value={orderType} onValueChange={setOrderType}>
                <SelectTrigger data-testid="order-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dine_in">Dine In</SelectItem>
                  <SelectItem value="takeaway">Takeaway</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Table Number (for dine-in) */}
            {orderType === 'dine_in' && (
              <div className="space-y-2">
                <Label>Table Number</Label>
                <Input
                  type="number"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  placeholder="Enter table number"
                  data-testid="table-number-input"
                />
              </div>
            )}

            {/* Customer Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Customer Name</Label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Optional"
                  data-testid="customer-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Optional"
                  data-testid="customer-phone-input"
                />
              </div>
            </div>

            {/* Discount */}
            <div className="space-y-2">
              <Label>Discount Amount (₹)</Label>
              <Input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="0"
                data-testid="discount-input"
              />
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod('cash')}
                  className={paymentMethod === 'cash' ? 'bg-orange-500 hover:bg-orange-600' : ''}
                  data-testid="payment-cash"
                >
                  <Banknote className="w-4 h-4 mr-1" />
                  Cash
                </Button>
                <Button
                  variant={paymentMethod === 'card' ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod('card')}
                  className={paymentMethod === 'card' ? 'bg-orange-500 hover:bg-orange-600' : ''}
                  data-testid="payment-card"
                >
                  <CreditCard className="w-4 h-4 mr-1" />
                  Card
                </Button>
                <Button
                  variant={paymentMethod === 'upi' ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod('upi')}
                  className={paymentMethod === 'upi' ? 'bg-orange-500 hover:bg-orange-600' : ''}
                  data-testid="payment-upi"
                >
                  <Smartphone className="w-4 h-4 mr-1" />
                  UPI
                </Button>
              </div>
            </div>

            {/* Order Summary */}
            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Items</span>
                <span>{cart.reduce((sum, c) => sum + c.quantity, 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-numbers">₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">GST (5%)</span>
                <span className="font-numbers">₹{taxAmount.toFixed(2)}</span>
              </div>
              {parseFloat(discount) > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount</span>
                  <span className="font-numbers">-₹{parseFloat(discount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-lg pt-2 border-t border-slate-200">
                <span>Total</span>
                <span className="font-numbers text-orange-500">
                  ₹{(subtotal + taxAmount - (parseFloat(discount) || 0)).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCheckout(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCheckout}
              disabled={checkoutLoading}
              className="bg-orange-500 hover:bg-orange-600"
              data-testid="confirm-order-btn"
            >
              {checkoutLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Confirm Order'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
