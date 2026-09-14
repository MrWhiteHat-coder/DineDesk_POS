import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { inventoryAPI } from '../../lib/api';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Skeleton } from '../../components/ui/skeleton';
import { ChefWorried } from '../../components/illustrations/ChefBot';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { guard } from '../../components/pos/GuardReasonDialog';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { Plus, Pencil, Trash2, AlertTriangle, Package, History } from 'lucide-react';

const units = ['kg', 'g', 'l', 'ml', 'pieces'];

export default function InventoryPage() {
  const navigate = useNavigate();
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  /* Stock ledger — full movement history for one item */
  const [historyItem, setHistoryItem] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const openHistory = async (item) => {
    setHistoryItem(item);
    setHistoryData(null);
    setHistoryLoading(true);
    try {
      const res = await inventoryAPI.movements(item.id, 30);
      setHistoryData(res.data);
    } catch {
      setHistoryData([]);
    } finally {
      setHistoryLoading(false);
    }
  };
  const [itemLoading, setItemLoading] = useState(false);
  const [showLowStock, setShowLowStock] = useState(false);

  /* 17.84999999999998 → "17.85" — hide float dust from stock deductions */
  const formatQty = (q) => {
    const n = Number(q) || 0;
    return Number.isInteger(n) ? n.toString() : parseFloat(n.toFixed(2)).toString();
  };

  const [formData, setFormData] = useState({
    name: '',
    unit: 'kg',
    quantity: '',
    min_quantity: '',
    cost_per_unit: '',
  });

  useEffect(() => {
    fetchInventory();
  }, [showLowStock]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchInventory = async () => {
    try {
      const res = await inventoryAPI.getAll(showLowStock);
      setInventory(res.data);
    } catch (err) {
      console.error('Failed to fetch inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (item = null) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        unit: item.unit,
        quantity: item.quantity.toString(),
        min_quantity: item.min_quantity.toString(),
        cost_per_unit: item.cost_per_unit.toString(),
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: '',
        unit: 'kg',
        quantity: '',
        min_quantity: '',
        cost_per_unit: '',
      });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.quantity || !formData.min_quantity) {
      toast.error('Please fill all required fields');
      return;
    }

    setItemLoading(true);
    try {
      const data = {
        name: formData.name,
        unit: formData.unit,
        quantity: parseFloat(formData.quantity),
        min_quantity: parseFloat(formData.min_quantity),
        cost_per_unit: parseFloat(formData.cost_per_unit) || 0,
      };

      if (editingItem) {
        await inventoryAPI.update(editingItem.id, data);
        toast.success('Inventory item updated');
      } else {
        await inventoryAPI.create(data);
        toast.success('Inventory item added');
      }

      setShowModal(false);
      fetchInventory();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save item');
    } finally {
      setItemLoading(false);
    }
  };

  const handleDelete = (itemId) => {
    guard.confirm({
      title: 'Delete inventory item?',
      description: 'This permanently removes the item and is recorded in the activity log.',
      confirmLabel: 'Delete item',
      action: async (reason) => {
        await inventoryAPI.delete(itemId, reason);
        toast.success('Item deleted');
        fetchInventory();
      },
    });
  };

  const lowStockCount = inventory.filter((i) => i.is_low_stock).length;

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex justify-between"><Skeleton className="h-8 w-32" /><div className="flex gap-2"><Skeleton className="h-9 w-28 rounded-lg" /><Skeleton className="h-9 w-24 rounded-lg" /></div></div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="inventory-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-900">Inventory</h1>
          {lowStockCount > 0 && (
            <p className="text-sm text-amber-600 flex items-center gap-1 mt-1">
              <AlertTriangle className="w-4 h-4" />
              {lowStockCount} items low on stock
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={showLowStock ? 'default' : 'outline'}
            onClick={() => setShowLowStock(!showLowStock)}
            className={showLowStock ? 'bg-amber-500 hover:bg-amber-600' : ''}
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Low Stock ({lowStockCount})
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/pos/wastage')}
            data-testid="wastage-link-btn"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Wastage
          </Button>
          <Button
            onClick={() => openModal()}
            className="bg-[#0F2417] hover:bg-[#1a3d28]"
            data-testid="add-inventory-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Inventory Table */}
      {inventory.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item Name</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Min. Quantity</TableHead>
                <TableHead>Cost/Unit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inventory.map((item) => (
                <TableRow key={item.id} data-testid={`inventory-row-${item.id}`}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>
                    <span className="font-numbers">
                      {formatQty(item.quantity)} {item.unit}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="font-numbers text-slate-500">
                      {formatQty(item.min_quantity)} {item.unit}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="font-numbers">₹{item.cost_per_unit.toFixed(2)}</span>
                  </TableCell>
                  <TableCell>
                    {item.is_low_stock ? (
                      <Badge className="bg-amber-100 text-amber-700">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Low Stock
                      </Badge>
                    ) : (
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300">In Stock</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openHistory(item)}
                      className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                      aria-label={`Stock history for ${item.name}`}
                      data-testid={`history-inventory-${item.id}`}
                    >
                      <History className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openModal(item)}
                      data-testid={`edit-inventory-${item.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(item.id)}
                      className="text-red-500 hover:text-red-600"
                      data-testid={`delete-inventory-${item.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card className="p-12 text-center animate-fade-in">
          <ChefWorried className="w-28 h-28 mx-auto mb-4" />
          <p className="text-lg font-heading font-bold text-slate-600 mb-1">No inventory items</p>
          <p className="text-sm text-slate-400 mb-4">Track raw materials and stock levels</p>
          <Button onClick={() => openModal()} className="bg-[#0F2417] hover:bg-[#1a3d28] rounded-xl">
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Item
          </Button>
        </Card>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">
              {editingItem ? 'Edit Inventory Item' : 'Add Inventory Item'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Item Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Rice, Oil, Onions"
                data-testid="inventory-name-input"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantity *</Label>
                <Input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData((prev) => ({ ...prev, quantity: e.target.value }))}
                  placeholder="0"
                  data-testid="inventory-quantity-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select
                  value={formData.unit}
                  onValueChange={(val) => setFormData((prev) => ({ ...prev, unit: val }))}
                >
                  <SelectTrigger data-testid="inventory-unit-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min. Quantity (Alert) *</Label>
                <Input
                  type="number"
                  value={formData.min_quantity}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, min_quantity: e.target.value }))
                  }
                  placeholder="0"
                  data-testid="inventory-min-quantity-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Cost per Unit (₹)</Label>
                <Input
                  type="number"
                  value={formData.cost_per_unit}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, cost_per_unit: e.target.value }))
                  }
                  placeholder="0.00"
                  data-testid="inventory-cost-input"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={itemLoading}
              className="bg-[#0F2417] hover:bg-[#1a3d28]"
              data-testid="save-inventory-btn"
            >
              {itemLoading ? 'Saving...' : editingItem ? 'Update Item' : 'Add Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock Ledger — every movement that shaped current stock */}
      <Dialog open={!!historyItem} onOpenChange={(v) => { if (!v) setHistoryItem(null); }}>
        <DialogContent className="max-w-md rounded-2xl" data-testid="stock-history-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">Stock History — {historyItem?.name}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[55vh] overflow-y-auto -mx-1 px-1">
            {historyLoading && (
              <div className="space-y-2 py-2">{[...Array(4)].map((_, i) => <div key={i} className="h-10 rounded-lg bg-slate-100 dark:bg-white/5 animate-pulse" />)}</div>
            )}
            {!historyLoading && historyData && historyData.length === 0 && (
              <p className="text-xs text-slate-400 dark:text-white/40 py-4 text-center">No stock movements in the last 30 days.</p>
            )}
            {!historyLoading && historyData && historyData.length > 0 && (
              <div className="divide-y divide-slate-50 dark:divide-white/[0.04]">
                {historyData.map((m) => (
                  <div key={m.id} className="py-2.5 flex items-start gap-2.5" data-testid="stock-movement-row">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5 ${m.delta >= 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300'}`}>
                      {m.delta >= 0 ? '+' : ''}{m.delta}{m.unit ? ` ${m.unit}` : ''}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-700 dark:text-white/70 capitalize">{String(m.movement_type).replace('_', ' ')}</p>
                      <p className="text-[10px] text-slate-400 dark:text-white/40">{m.note || ''}{m.user_name ? ` · ${m.user_name}` : ''} · {new Date(m.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    {m.balance_after != null && <span className="text-[10px] font-numbers text-slate-400 dark:text-white/40 mt-1">bal {m.balance_after}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
