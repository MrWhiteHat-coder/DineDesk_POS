import React, { useState, useEffect } from 'react';
import { branchAPI } from '../../lib/api';
import { toast } from 'sonner';
import { Plus, MapPin, Phone, Pencil, Trash2, Building2, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../components/ui/dialog';

export default function BranchesPage() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editBranch, setEditBranch] = useState(null);
  const [form, setForm] = useState({ name: '', address: '', city: '', pincode: '', contact_phone: '', share_menu: true });

  const fetchBranches = async () => {
    try {
      const res = await branchAPI.getAll();
      setBranches(res.data);
    } catch (err) {
      console.error('Branch fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBranches(); }, []);

  const openModal = (branch = null) => {
    if (branch) {
      setEditBranch(branch);
      setForm({ name: branch.name, address: branch.address, city: branch.city, pincode: branch.pincode, contact_phone: branch.contact_phone, share_menu: branch.share_menu });
    } else {
      setEditBranch(null);
      setForm({ name: '', address: '', city: '', pincode: '', contact_phone: '', share_menu: true });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.address) {
      toast.error('Name and address are required');
      return;
    }
    try {
      if (editBranch) {
        await branchAPI.update(editBranch.id, form);
        toast.success('Branch updated');
      } else {
        await branchAPI.create(form);
        toast.success('Branch created');
      }
      setShowModal(false);
      fetchBranches();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save branch');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this branch?')) return;
    try {
      await branchAPI.delete(id);
      toast.success('Branch deleted');
      fetchBranches();
    } catch (err) {
      toast.error('Failed to delete branch');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-800 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div data-testid="branches-page">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-xl font-bold text-slate-900">Multi-Branch Management</h1>
        <Button onClick={() => openModal()} className="h-9 px-3 rounded-lg bg-slate-800 hover:bg-slate-900 text-sm" data-testid="add-branch-btn">
          <Plus className="w-4 h-4 mr-1.5" /> Add Branch
        </Button>
      </div>

      {branches.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
          <Building2 className="w-16 h-16 mb-4" />
          <p className="text-lg font-medium">No branches yet</p>
          <p className="text-sm">Add your first branch to expand</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map((branch) => (
            <div key={branch.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow" data-testid={`branch-${branch.id}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-slate-900">{branch.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{branch.share_menu ? 'Shared Menu' : 'Independent Menu'}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openModal(branch)} className="h-7 w-7 p-0 rounded-md">
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(branch.id)} className="h-7 w-7 p-0 rounded-md text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5 text-sm text-slate-600">
                <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-slate-400" />{branch.address}, {branch.city} - {branch.pincode}</div>
                <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-slate-400" />{branch.contact_phone}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editBranch ? 'Edit Branch' : 'Add New Branch'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Branch Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 rounded-lg" placeholder="e.g., Downtown Branch" data-testid="branch-name-input" />
            </div>
            <div>
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="mt-1 rounded-lg" placeholder="Full address" data-testid="branch-address-input" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>City</Label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="mt-1 rounded-lg" />
              </div>
              <div>
                <Label>Pincode</Label>
                <Input value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} className="mt-1 rounded-lg" />
              </div>
            </div>
            <div>
              <Label>Contact Phone</Label>
              <Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} className="mt-1 rounded-lg" />
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-slate-800">Share Menu with Main Branch</p>
                <p className="text-xs text-slate-500">Use the same menu items as your main restaurant</p>
              </div>
              <Switch checked={form.share_menu} onCheckedChange={(v) => setForm({ ...form, share_menu: v })} data-testid="share-menu-toggle" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowModal(false)} className="rounded-lg">Cancel</Button>
            <Button onClick={handleSave} className="rounded-lg bg-slate-800 hover:bg-slate-900" data-testid="save-branch-btn">
              {editBranch ? 'Update' : 'Create'} Branch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
