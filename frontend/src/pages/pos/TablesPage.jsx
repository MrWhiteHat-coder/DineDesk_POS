import React, { useState, useEffect } from 'react';
import { tableAPI } from '../../lib/api';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Skeleton } from '../../components/ui/skeleton';
import { ChefPresenting } from '../../components/illustrations/ChefBot';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog';
import { Plus, Users, UtensilsCrossed, Clock } from 'lucide-react';

const statusColors = {
  available: 'bg-green-100 border-green-300 text-green-700',
  occupied: 'bg-slate-100 border-slate-300 text-slate-700',
  reserved: 'bg-blue-100 border-blue-300 text-blue-700',
};

export default function TablesPage() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [tableNumber, setTableNumber] = useState('');
  const [capacity, setCapacity] = useState('4');
  const [addLoading, setAddLoading] = useState(false);

  useEffect(() => {
    fetchTables();
  }, []);

  const fetchTables = async () => {
    try {
      const res = await tableAPI.getAll();
      setTables(res.data);
    } catch (err) {
      console.error('Failed to fetch tables:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTable = async () => {
    if (!tableNumber) {
      toast.error('Table number is required');
      return;
    }

    setAddLoading(true);
    try {
      await tableAPI.create({
        table_number: parseInt(tableNumber),
        capacity: parseInt(capacity),
      });
      toast.success('Table added');
      setShowAddModal(false);
      setTableNumber('');
      setCapacity('4');
      fetchTables();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add table');
    } finally {
      setAddLoading(false);
    }
  };

  const handleUpdateStatus = async (tableId, newStatus) => {
    try {
      await tableAPI.updateStatus(tableId, newStatus);
      toast.success('Table status updated');
      fetchTables();
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const stats = {
    available: tables.filter((t) => t.status === 'available').length,
    occupied: tables.filter((t) => t.status === 'occupied').length,
    reserved: tables.filter((t) => t.status === 'reserved').length,
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex justify-between"><Skeleton className="h-8 w-32" /><Skeleton className="h-9 w-28 rounded-lg" /></div>
        <div className="grid grid-cols-3 gap-4"><Skeleton className="h-20 rounded-xl" /><Skeleton className="h-20 rounded-xl" /><Skeleton className="h-20 rounded-xl" /></div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="tables-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-slate-900">Tables</h1>
        <Button
          onClick={() => setShowAddModal(true)}
          className="bg-black hover:bg-gray-800"
          data-testid="add-table-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Table
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <UtensilsCrossed className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-green-600">Available</p>
              <p className="font-numbers text-2xl font-bold text-green-700">{stats.available}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-slate-800" />
            </div>
            <div>
              <p className="text-sm text-slate-800">Occupied</p>
              <p className="font-numbers text-2xl font-bold text-slate-700">{stats.occupied}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-blue-600">Reserved</p>
              <p className="font-numbers text-2xl font-bold text-blue-700">{stats.reserved}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tables Grid */}
      {tables.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {tables.map((table) => (
            <Card
              key={table.id}
              className={`cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-1 border-2 ${statusColors[table.status]}`}
              data-testid={`table-${table.table_number}`}
            >
              <CardContent className="p-4 text-center">
                <div className="font-numbers text-3xl font-bold mb-2">
                  T{table.table_number}
                </div>
                <p className="text-sm mb-3 capitalize">{table.status}</p>
                <p className="text-xs mb-3">
                  <Users className="w-3 h-3 inline mr-1" />
                  {table.capacity} seats
                </p>
                
                {/* Quick Actions */}
                <div className="flex gap-1 justify-center">
                  {table.status !== 'available' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateStatus(table.id, 'available')}
                      className="text-xs h-7"
                    >
                      Free
                    </Button>
                  )}
                  {table.status === 'available' && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateStatus(table.id, 'reserved')}
                        className="text-xs h-7"
                      >
                        Reserve
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center animate-fade-in">
          <ChefPresenting className="w-28 h-28 mx-auto mb-4" />
          <p className="text-lg font-heading font-bold text-slate-600 mb-1">No tables yet</p>
          <p className="text-sm text-slate-400 mb-4">Set up your tables to start taking dine-in orders</p>
          <Button onClick={() => setShowAddModal(true)} className="bg-black hover:bg-gray-800 rounded-xl">
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Table
          </Button>
        </Card>
      )}

      {/* Add Table Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Add Table</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Table Number</Label>
              <Input
                type="number"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="e.g., 1"
                data-testid="table-number-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Capacity (seats)</Label>
              <Input
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="4"
                data-testid="table-capacity-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddTable}
              disabled={addLoading}
              className="bg-black hover:bg-gray-800"
              data-testid="save-table-btn"
            >
              {addLoading ? 'Adding...' : 'Add Table'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
