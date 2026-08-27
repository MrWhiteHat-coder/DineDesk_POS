import React, { useState, useEffect } from 'react';
import { branchAPI } from '../../lib/api';
import { toast } from 'sonner';
import { Plus, MapPin, Phone, Pencil, Trash2, Building2, Mail, Key, Copy, Check } from 'lucide-react';
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
  const [form, setForm] = useState({ name: '', address: '', city: '', pincode: '', contact_phone: '', share_menu: true, login_email: '', login_password: '' });
  const [showCredentials, setShowCredentials] = useState(false);
  const [createdCreds, setCreatedCreds] = useState(null);
  const [copied, setCopied] = useState('');

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
      setForm({ name: branch.name, address: branch.address, city: branch.city, pincode: branch.pincode, contact_phone: branch.contact_phone, share_menu: branch.share_menu, login_email: '', login_password: '' });
    } else {
      setEditBranch(null);
      setForm({ name: '', address: '', city: '', pincode: '', contact_phone: '', share_menu: true, login_email: '', login_password: '' });
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
        if (!form.login_email || !form.login_password) {
          toast.error('Login email and password are required for new branch');
          return;
        }
        if (form.login_password.length < 6) {
          toast.error('Password must be at least 6 characters');
          return;
        }
        await branchAPI.create(form);
        setCreatedCreds({ email: form.login_email, password: form.login_password, branch: form.name });
        setShowCredentials(true);
        toast.success('Branch created with login credentials');
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

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(''), 2000);
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
        <Button onClick={() => openModal()} className="h-9 px-3 rounded-lg bg-black hover:bg-gray-800 text-sm" data-testid="add-branch-btn">
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

      {/* Create/Edit Branch Modal */}
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
            {/* Login Credentials - only for new branches */}
            {!editBranch && (
              <div className="space-y-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm font-semibold text-blue-800 flex items-center gap-1.5"><Key className="w-4 h-4" /> Branch Login Credentials</p>
                <p className="text-xs text-blue-600">Create login credentials for the branch manager</p>
                <div>
                  <Label className="text-xs text-blue-700">Login Email *</Label>
                  <Input value={form.login_email} onChange={(e) => setForm({ ...form, login_email: e.target.value })} className="mt-1 rounded-lg bg-white" placeholder="branch@restaurant.com" data-testid="branch-login-email" type="email" />
                </div>
                <div>
                  <Label className="text-xs text-blue-700">Password *</Label>
                  <Input value={form.login_password} onChange={(e) => setForm({ ...form, login_password: e.target.value })} className="mt-1 rounded-lg bg-white" placeholder="Min. 6 characters" data-testid="branch-login-password" type="password" />
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowModal(false)} className="rounded-lg">Cancel</Button>
            <Button onClick={handleSave} className="rounded-lg bg-black hover:bg-gray-800" data-testid="save-branch-btn">
              {editBranch ? 'Update' : 'Create'} Branch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credentials Success Modal */}
      <Dialog open={showCredentials} onOpenChange={setShowCredentials}>
        <DialogContent className="rounded-2xl max-w-sm" data-testid="credentials-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700"><Check className="w-5 h-5" /> Branch Created!</DialogTitle>
          </DialogHeader>
          {createdCreds && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-slate-600">Branch <span className="font-semibold text-slate-800">{createdCreds.branch}</span> has been created. Share these credentials with the branch manager:</p>
              <div className="space-y-2 bg-slate-50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-semibold">Email</p>
                    <p className="text-sm font-mono font-semibold text-slate-800">{createdCreds.email}</p>
                  </div>
                  <button onClick={() => copyToClipboard(createdCreds.email, 'email')} className="p-1.5 rounded-md hover:bg-slate-200" data-testid="copy-email">
                    {copied === 'email' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-slate-400" />}
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-semibold">Password</p>
                    <p className="text-sm font-mono font-semibold text-slate-800">{createdCreds.password}</p>
                  </div>
                  <button onClick={() => copyToClipboard(createdCreds.password, 'password')} className="p-1.5 rounded-md hover:bg-slate-200" data-testid="copy-password">
                    {copied === 'password' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-slate-400" />}
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-amber-600 bg-amber-50 p-2 rounded-lg">Save these credentials securely. The password cannot be recovered later.</p>
            </div>
          )}
          <Button onClick={() => setShowCredentials(false)} className="w-full rounded-lg bg-black hover:bg-gray-800" data-testid="close-credentials-btn">
            Done
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
