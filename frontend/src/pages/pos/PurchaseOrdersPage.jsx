import React, { useState, useEffect } from 'react';
import { purchaseOrderAPI, inventoryAPI } from '../../lib/api';
import { toast } from 'sonner';
import { Plus, Package, Truck, CheckCircle2, XCircle, Clock, X, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../components/ui/dialog';

const STATUS_CONFIG = {
  ordered: { label: 'Ordered', color: 'bg-blue-100 text-blue-700', icon: Clock },
  received: { label: 'Received', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700', icon: XCircle },
};

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [form, setForm] = useState({
    supplier_name: '', supplier_contact: '', notes: '', expected_delivery: '',
    items: [{ inventory_item_id: '', inventory_item_name: '', quantity: '', unit: '', unit_cost: '' }],
  });

  const fetchData = async () => {
    try {
      const [poRes, invRes] = await Promise.all([purchaseOrderAPI.getAll(statusFilter || undefined), inventoryAPI.getAll()]);
      setOrders(poRes.data);
      setInventory(invRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [statusFilter]);

  const addItem = () => setForm(prev => ({ ...prev, items: [...prev.items, { inventory_item_id: '', inventory_item_name: '', quantity: '', unit: '', unit_cost: '' }] }));
  const removeItem = (idx) => setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));

  const updateItem = (idx, field, value) => {
    const updated = [...form.items];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === 'inventory_item_id') {
      const inv = inventory.find(i => i.id === value);
      if (inv) { updated[idx].inventory_item_name = inv.name; updated[idx].unit = inv.unit; updated[idx].unit_cost = inv.cost_per_unit; }
    }
    setForm(prev => ({ ...prev, items: updated }));
  };

  const totalCost = form.items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_cost) || 0), 0);

  const handleCreate = async () => {
    if (!form.supplier_name) { toast.error('Supplier name required'); return; }
    if (form.items.some(i => !i.inventory_item_id || !i.quantity)) { toast.error('All items need ingredient & quantity'); return; }
    try {
      await purchaseOrderAPI.create({
        ...form,
        items: form.items.map(i => ({ ...i, quantity: parseFloat(i.quantity), unit_cost: parseFloat(i.unit_cost) })),
      });
      toast.success('Purchase order created');
      setShowModal(false);
      setForm({ supplier_name: '', supplier_contact: '', notes: '', expected_delivery: '', items: [{ inventory_item_id: '', inventory_item_name: '', quantity: '', unit: '', unit_cost: '' }] });
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleReceive = async (id) => {
    try {
      await purchaseOrderAPI.receive(id);
      toast.success('Order received! Inventory updated.');
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this purchase order?')) return;
    try {
      await purchaseOrderAPI.cancel(id);
      toast.success('Order cancelled');
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-slate-800 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div data-testid="purchase-orders-page">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-xl font-bold text-slate-900">Purchase Orders</h1>
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            {['', 'ordered', 'received', 'cancelled'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFilter === s ? 'bg-teal-700 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
                {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
              </button>
            ))}
          </div>
          <Button onClick={() => setShowModal(true)} className="h-9 px-3 rounded-lg bg-teal-700 hover:bg-teal-800 text-sm" data-testid="create-po-btn">
            <Plus className="w-4 h-4 mr-1.5" /> New Order
          </Button>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
          <Truck className="w-16 h-16 mb-4" />
          <p className="text-lg font-medium">No purchase orders</p>
          <p className="text-sm">Create one to order raw materials</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(po => {
            const sc = STATUS_CONFIG[po.status] || STATUS_CONFIG.ordered;
            const Icon = sc.icon;
            return (
              <div key={po.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-all" data-testid={`po-${po.id}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-slate-900">{po.po_number}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${sc.color}`}>
                        <Icon className="w-3 h-3" />{sc.label}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-0.5">{po.supplier_name} {po.supplier_contact && `· ${po.supplier_contact}`}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-slate-900">₹{po.total_cost?.toFixed(2)}</p>
                    <p className="text-[10px] text-slate-400">{new Date(po.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                  {(po.items || []).map((item, idx) => (
                    <div key={idx} className="bg-slate-50 rounded-lg px-2.5 py-1.5 text-xs">
                      <p className="font-semibold text-slate-800">{item.inventory_item_name || 'Item'}</p>
                      <p className="text-slate-500">{item.quantity} {item.unit} @ ₹{item.unit_cost}/{item.unit}</p>
                    </div>
                  ))}
                </div>
                {po.status === 'ordered' && (
                  <div className="flex gap-2">
                    <Button onClick={() => handleReceive(po.id)} className="h-8 rounded-lg bg-green-600 hover:bg-green-700 text-xs" data-testid={`receive-po-${po.id}`}>
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Mark Received
                    </Button>
                    <Button onClick={() => handleCancel(po.id)} variant="outline" className="h-8 rounded-lg text-red-600 border-red-200 hover:bg-red-50 text-xs" data-testid={`cancel-po-${po.id}`}>
                      <XCircle className="w-3.5 h-3.5 mr-1" /> Cancel
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create PO Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="rounded-2xl max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Purchase Order</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Supplier Name *</Label><Input value={form.supplier_name} onChange={e => setForm({ ...form, supplier_name: e.target.value })} className="mt-1 rounded-lg" data-testid="po-supplier-input" /></div>
              <div><Label>Contact</Label><Input value={form.supplier_contact} onChange={e => setForm({ ...form, supplier_contact: e.target.value })} className="mt-1 rounded-lg" /></div>
            </div>
            <div><Label>Notes</Label><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="mt-1 rounded-lg" placeholder="Optional notes" /></div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">Items</Label>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs rounded-lg" onClick={addItem} data-testid="po-add-item">
                  <Plus className="w-3 h-3 mr-1" /> Add Item
                </Button>
              </div>
              {form.items.map((item, idx) => (
                <div key={idx} className="flex items-end gap-2 bg-slate-50 p-2.5 rounded-lg">
                  <div className="flex-1">
                    <Label className="text-[10px]">Ingredient</Label>
                    <Select value={item.inventory_item_id} onValueChange={v => updateItem(idx, 'inventory_item_id', v)}>
                      <SelectTrigger className="h-8 rounded-lg text-xs mt-0.5"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{inventory.map(inv => <SelectItem key={inv.id} value={inv.id}>{inv.name} ({inv.unit})</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="w-20">
                    <Label className="text-[10px]">Qty</Label>
                    <Input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} className="h-8 rounded-lg text-xs mt-0.5" />
                  </div>
                  <div className="w-20">
                    <Label className="text-[10px]">Cost/Unit</Label>
                    <Input type="number" value={item.unit_cost} onChange={e => updateItem(idx, 'unit_cost', e.target.value)} className="h-8 rounded-lg text-xs mt-0.5" />
                  </div>
                  <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 pb-1"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              <div className="text-right text-sm font-bold text-slate-900">Total: ₹{totalCost.toFixed(2)}</div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowModal(false)} className="rounded-lg">Cancel</Button>
            <Button onClick={handleCreate} className="rounded-lg bg-teal-700 hover:bg-teal-800" data-testid="confirm-po-btn">Create Order</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
