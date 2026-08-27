import React, { useState, useEffect } from 'react';
import { inventoryAPI } from '../../lib/api';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
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
import { Plus, Pencil, Trash2, AlertTriangle, Package } from 'lucide-react';

const units = ['kg', 'g', 'l', 'ml', 'pieces'];

export default function InventoryPage() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemLoading, setItemLoading] = useState(false);
  const [showLowStock, setShowLowStock] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    unit: 'kg',
    quantity: '',
    min_quantity: '',
    cost_per_unit: '',
  });

  useEffect(() => {
    fetchInventory();
  }, [showLowStock]);

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

  const handleDelete = async (itemId) => {
    if (!window.confirm('Delete this inventory item?')) return;

    try {
      await inventoryAPI.delete(itemId);
      toast.success('Item deleted');
      fetchInventory();
    } catch (err) {
      toast.error('Failed to delete item');
    }
  };

  const lowStockCount = inventory.filter((i) => i.is_low_stock).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-800 border-t-transparent rounded-full animate-spin" />
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
        <div className="flex gap-2">
          <Button
            variant={showLowStock ? 'default' : 'outline'}
            onClick={() => setShowLowStock(!showLowStock)}
            className={showLowStock ? 'bg-amber-500 hover:bg-amber-600' : ''}
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Low Stock ({lowStockCount})
          </Button>
          <Button
            onClick={() => openModal()}
            className="bg-yellow-400 hover:bg-yellow-300"
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
                      {item.quantity} {item.unit}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="font-numbers text-slate-500">
                      {item.min_quantity} {item.unit}
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
                      <Badge className="bg-green-100 text-green-700">In Stock</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
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
        <Card className="p-12 text-center">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-400 mb-4">No inventory items yet</p>
          <Button onClick={() => openModal()} className="bg-yellow-400 hover:bg-yellow-300">
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
              className="bg-yellow-400 hover:bg-yellow-300"
              data-testid="save-inventory-btn"
            >
              {itemLoading ? 'Saving...' : editingItem ? 'Update Item' : 'Add Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
