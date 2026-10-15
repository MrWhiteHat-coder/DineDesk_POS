import React, { useState, useEffect } from 'react';
import { tableAPI } from '../../lib/api';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Skeleton } from '../../components/ui/skeleton';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog';
import { Plus, Users, UtensilsCrossed, Clock, Armchair, Leaf, LayoutGrid, List, QrCode } from 'lucide-react';

/* Reference palette — calm green floor */
const statusColors = {
  available: 'bg-emerald-50/80 border-emerald-200 dark:bg-emerald-400/[0.07] dark:border-emerald-400/25',
  occupied: 'bg-red-50/80 border-red-200 dark:bg-red-400/[0.07] dark:border-red-400/25',
  reserved: 'bg-blue-50/80 border-blue-200 dark:bg-blue-400/[0.07] dark:border-blue-400/25',
};
const statusDot = {
  available: 'bg-emerald-500',
  occupied: 'bg-red-500',
  reserved: 'bg-blue-500',
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'available', label: 'Available' },
  { key: 'occupied', label: 'Occupied' },
  { key: 'reserved', label: 'Reserved' },
];

export default function TablesPage() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [tableNumber, setTableNumber] = useState('');
  const [capacity, setCapacity] = useState('4');
  const [addLoading, setAddLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState('floor');

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
    seats: tables.reduce((a, t) => a + (t.capacity || 0), 0),
  };

  const filtered = filter === 'all' ? tables : tables.filter(t => t.status === filter);

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
    <div className="space-y-5 max-w-[1400px] animate-fade-in" data-testid="tables-page">
      {/* ── Reference header: title + quote banner + Add Table ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_minmax(260px,360px)_auto] gap-4 items-stretch">
        <div className="flex flex-col justify-center">
          <p className="text-[11px] font-bold tracking-[0.14em] text-[#268A4E] dark:text-[#3FCE85] uppercase">Table Management</p>
          <h1 className="font-heading text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-1 flex items-center gap-2">
            Every table tells a story <Leaf className="w-6 h-6 text-emerald-500" aria-hidden="true" />
          </h1>
          <p className="text-sm text-slate-500 dark:text-white/50 mt-1">Great food brings people together. Let's make it memorable.</p>
        </div>
        {/* Quote card */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0F2417] to-[#1B5A38] text-white p-4 flex flex-col justify-center min-h-[104px]">
          <div className="absolute -right-6 -top-8 w-28 h-28 rounded-full bg-white/[0.07]" aria-hidden="true" />
          <p className="relative font-script text-lg text-emerald-200/90 leading-snug">&ldquo;Good food<br />brings people together.&rdquo;</p>
          <p className="relative text-[10px] text-white/50 mt-1.5 self-end">— DineDesk</p>
        </div>
        <div className="flex flex-col gap-2 justify-center">
          <Button onClick={() => setShowAddModal(true)} className="h-11 rounded-xl bg-[#0F2417] hover:bg-[#1a3d28] dark:bg-[#2E9E5B] dark:hover:bg-[#288A50] text-white font-bold" data-testid="add-table-btn">
            <Plus className="w-4 h-4 mr-2" /> Add Table
          </Button>
          <Button variant="outline" onClick={() => setView(v => (v === 'floor' ? 'list' : 'floor'))} className="h-11 rounded-xl border-slate-200 dark:border-white/10 font-bold" data-testid="view-toggle-btn">
            {view === 'floor' ? <List className="w-4 h-4 mr-2" /> : <LayoutGrid className="w-4 h-4 mr-2" />}
            {view === 'floor' ? 'List View' : 'Floor View'}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-emerald-50/70 border-emerald-200 dark:bg-emerald-400/[0.07] dark:border-emerald-400/20">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-white dark:bg-white/[0.08] rounded-xl flex items-center justify-center shadow-sm">
              <Armchair className="w-5 h-5 text-emerald-600 dark:text-emerald-300" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-white/50">Available</p>
              <p className="font-numbers text-2xl font-bold text-slate-900 dark:text-white">{stats.available}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-red-50/70 border-red-200 dark:bg-red-400/[0.07] dark:border-red-400/20">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-white dark:bg-white/[0.08] rounded-xl flex items-center justify-center shadow-sm">
              <Users className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-white/50">Occupied</p>
              <p className="font-numbers text-2xl font-bold text-slate-900 dark:text-white">{stats.occupied}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50/70 border-blue-200 dark:bg-blue-400/[0.07] dark:border-blue-400/20">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-white dark:bg-white/[0.08] rounded-xl flex items-center justify-center shadow-sm">
              <Clock className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-white/50">Reserved</p>
              <p className="font-numbers text-2xl font-bold text-slate-900 dark:text-white">{stats.reserved}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-50 border-slate-200 dark:bg-white/[0.04] dark:border-white/[0.08]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-white dark:bg-white/[0.08] rounded-xl flex items-center justify-center shadow-sm">
              <Users className="w-5 h-5 text-slate-500 dark:text-white/60" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-white/50">Total Seats</p>
              <p className="font-numbers text-2xl font-bold text-slate-900 dark:text-white">{stats.seats}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map(f => {
          const count = f.key === 'all' ? tables.length : stats[f.key];
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${filter === f.key ? 'bg-[#0F2417] dark:bg-[#2E9E5B] text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:border-emerald-300 dark:bg-white/[0.04] dark:text-white/60 dark:border-white/10'}`}
              data-testid={`table-filter-${f.key}`}
            >
              {f.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Tables Grid */}
      {tables.length > 0 ? (
        view === 'floor' ? (
          <div className="rounded-2xl border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-[#191F1B] p-4 md:p-6" data-testid="floor-canvas">
            {/* Entrance marker + kitchen strip like the reference floor */}
            <div className="flex items-center justify-between mb-4 px-1">
              <span className="text-[11px] font-bold text-slate-400 dark:text-white/35 uppercase tracking-wider flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Entrance</span>
              <span className="text-[11px] font-bold text-slate-400 dark:text-white/35 uppercase tracking-wider">Kitchen →</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {filtered.map((table) => (
                <div
                  key={table.id}
                  className={`rounded-2xl border-2 ${statusColors[table.status]} p-4 text-center transition-all hover:shadow-lg hover:-translate-y-1`}
                  data-testid={`table-${table.table_number}`}
                >
                  <div className="flex items-center justify-center gap-1.5 mb-1.5">
                    <span className={`w-2 h-2 rounded-full ${statusDot[table.status] || 'bg-slate-400'}`} />
                    <span className="font-numbers text-2xl font-extrabold text-slate-900 dark:text-white leading-none">T{table.table_number}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-white/45 mb-3">{table.capacity} seats</p>
                  <p className="text-[10px] font-bold capitalize text-slate-600 dark:text-white/60 mb-2.5">{table.status}</p>
                  <div className="flex gap-1 justify-center">
                    {table.status !== 'available' && (
                      <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(table.id, 'available')} className="text-xs h-7 rounded-lg" data-testid={`free-table-${table.table_number}`}>
                        Free
                      </Button>
                    )}
                    {table.status === 'available' && (
                      <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(table.id, 'reserved')} className="text-xs h-7 rounded-lg">
                        Reserve
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {/* Legend + totals */}
            <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100 dark:border-white/[0.06] flex-wrap gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                {[['Available', 'bg-emerald-500'], ['Occupied', 'bg-red-500'], ['Reserved', 'bg-blue-500']].map(([label, dot]) => (
                  <span key={label} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-white/50">
                    <span className={`w-2 h-2 rounded-full ${dot}`} /> {label}
                  </span>
                ))}
              </div>
              <p className="text-[11px] font-semibold text-slate-400 dark:text-white/35">Total Tables: {tables.length} · Total Seats: {stats.seats}</p>
            </div>
          </div>
        ) : (
          /* List view — compact rows */
          <Card className="bg-white dark:bg-[#191F1B] border-slate-200 dark:border-white/[0.07]">
            <CardContent className="p-2 md:p-3">
              <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                {filtered.map((table) => (
                  <div key={table.id} className="flex items-center gap-3 py-3 px-2" data-testid={`table-row-${table.table_number}`}>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${statusColors[table.status]} border`}>
                      <UtensilsCrossed className="w-4 h-4 text-slate-600 dark:text-white/60" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">Table {table.table_number}</p>
                      <p className="text-[11px] text-slate-400 dark:text-white/40">{table.capacity} seats</p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold capitalize px-2.5 py-1 rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-white/60`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusDot[table.status] || 'bg-slate-400'}`} /> {table.status}
                    </span>
                    <div className="flex gap-1.5">
                      {table.status !== 'available' && (
                        <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(table.id, 'available')} className="text-xs h-8 rounded-lg">Free</Button>
                      )}
                      {table.status === 'available' && (
                        <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(table.id, 'reserved')} className="text-xs h-8 rounded-lg">Reserve</Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )
      ) : (
        <Card className="p-12 text-center animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-400/10 flex items-center justify-center mx-auto mb-4">
            <QrCode className="w-8 h-8 text-emerald-500" />
          </div>
          <p className="text-lg font-heading font-bold text-slate-600 dark:text-white/80 mb-1">No tables yet</p>
          <p className="text-sm text-slate-400 dark:text-white/40 mb-4">Set up your tables to start taking dine-in orders</p>
          <Button onClick={() => setShowAddModal(true)} className="bg-[#0F2417] hover:bg-[#1a3d28] dark:bg-[#2E9E5B] rounded-xl">
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Table
          </Button>
        </Card>
      )}

      {/* Add Table Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="rounded-2xl">
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
              className="bg-[#0F2417] hover:bg-[#1a3d28] dark:bg-[#2E9E5B]"
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
