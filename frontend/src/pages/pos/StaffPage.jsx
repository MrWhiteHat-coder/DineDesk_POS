import React, { useState, useEffect } from 'react';
import { staffAPI } from '../../lib/api';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import { guard } from '../../components/pos/GuardReasonDialog';
import ActivityLogCard from '../../components/pos/ActivityLogCard';
import { useAuth } from '../../contexts/AuthContext';
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
import { Plus, Trash2, User, Shield, CreditCard, ChefHat, UserCheck } from 'lucide-react';

const roleConfig = {
  owner: { label: 'Owner', color: 'bg-purple-100 text-purple-700', icon: Shield, desc: 'Full access' },
  manager: { label: 'Manager', color: 'bg-blue-100 text-blue-700', icon: User, desc: 'Complete access' },
  cashier: { label: 'Cashier', color: 'bg-green-100 text-green-700', icon: CreditCard, desc: 'Financial & billing' },
  captain: { label: 'Captain', color: 'bg-amber-100 text-amber-700', icon: UserCheck, desc: 'Order taking only' },
  chef: { label: 'Chef', color: 'bg-red-100 text-red-700', icon: ChefHat, desc: 'KDS access only' },
};

export default function StaffPage() {
  const { user } = useAuth();
  const canViewAudit = ['owner', 'manager', 'admin'].includes(user?.role);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [addLoading, setAddLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'cashier',
  });

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      const res = await staffAPI.getAll();
      setStaff(res.data);
    } catch (err) {
      console.error('Failed to fetch staff:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStaff = async () => {
    if (!formData.name || !formData.email || !formData.password) {
      toast.error('Please fill all required fields');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setAddLoading(true);
    try {
      await staffAPI.create(formData);
      toast.success('Staff member added');
      setShowModal(false);
      setFormData({ name: '', email: '', password: '', role: 'cashier' });
      fetchStaff();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add staff');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDeleteStaff = (staffId) => {
    guard.confirm({
      title: 'Remove this staff member?',
      description: 'Their login will be deactivated and the removal is recorded in the activity log.',
      confirmLabel: 'Remove staff',
      action: async (reason) => {
        await staffAPI.delete(staffId, reason);
        toast.success('Staff member removed');
        fetchStaff();
      },
    });
  };

  if (loading) {
    return (
      <div className="space-y-6" data-testid="staff-skeleton">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="h-10 w-28 rounded-xl" />
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-[#191F1B] border border-slate-100 dark:border-white/[0.06] rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="w-11 h-11 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-28 max-w-[70%] rounded-md" />
                  <Skeleton className="h-3 w-20 rounded-md" />
                </div>
              </div>
              <Skeleton className="h-3 w-full rounded-md" />
              <Skeleton className="h-9 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-[1400px] animate-fade-in" data-testid="staff-page">
      {/* Header — reference: eyebrow + title + script quote + Add Staff */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_minmax(240px,340px)_auto] gap-4 items-stretch">
        <div className="flex flex-col justify-center">
          <p className="text-[11px] font-bold tracking-[0.14em] text-[#268A4E] dark:text-[#3FCE85] uppercase">Staff Management</p>
          <h1 className="font-heading text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-1">Your Team, Our Strength 💚</h1>
          <p className="text-sm text-slate-500 dark:text-white/50 mt-1">Manage staff, track activity, and keep your restaurant running smoothly.</p>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-emerald-50/80 dark:bg-emerald-400/[0.06] border border-emerald-100 dark:border-emerald-400/15 p-4 flex flex-col justify-center">
          <p className="font-script text-lg text-[#1B5A38] dark:text-[#3FCE85] leading-snug">"Happy team serves happy food!"</p>
          <p className="text-[10px] text-slate-400 dark:text-white/40 mt-1 self-end">— DineDesk</p>
        </div>
        <div className="flex items-center justify-end">
          <Button
            onClick={() => setShowModal(true)}
            className="h-11 rounded-xl bg-[#0F2417] hover:bg-[#1a3d28] dark:bg-[#2E9E5B] dark:hover:bg-[#288A50] text-white font-bold"
            data-testid="add-staff-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Staff
          </Button>
        </div>
      </div>

      {/* DineDesk Guard — immutable activity trail (owner/manager only) */}
      <ActivityLogCard canView={canViewAudit} />

      {/* Staff Grid */}
      {staff.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {staff.map((member) => {
            const role = roleConfig[member.role] || roleConfig.cashier;
            const RoleIcon = role.icon;

            return (
              <Card key={member.id} data-testid={`staff-card-${member.id}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                        <span className="font-semibold text-slate-600 text-lg">
                          {member.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">{member.name}</h3>
                        <p className="text-sm text-slate-500">{member.email}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteStaff(member.id)}
                      className="text-slate-400 hover:text-red-500"
                      data-testid={`delete-staff-${member.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <Badge className={role.color}>
                      <RoleIcon className="w-3 h-3 mr-1" />
                      {role.label}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={member.is_active ? 'text-green-600' : 'text-red-600'}
                    >
                      {member.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <User className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-400 mb-4">No staff members yet</p>
          <Button onClick={() => setShowModal(true)} className="bg-black hover:bg-gray-800">
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Staff
          </Button>
        </Card>
      )}

      {/* Add Staff Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Add Staff Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="John Doe"
                data-testid="staff-name-input"
              />
            </div>

            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="staff@restaurant.com"
                data-testid="staff-email-input"
              />
            </div>

            <div className="space-y-2">
              <Label>Password *</Label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                placeholder="Min. 6 characters"
                data-testid="staff-password-input"
              />
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={formData.role}
                onValueChange={(val) => setFormData((prev) => ({ ...prev, role: val }))}
              >
                <SelectTrigger data-testid="staff-role-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner - Full access + Branch reports</SelectItem>
                  <SelectItem value="manager">Manager - Complete access</SelectItem>
                  <SelectItem value="cashier">Cashier - Financial & billing</SelectItem>
                  <SelectItem value="captain">Captain - Order taking only</SelectItem>
                  <SelectItem value="chef">Chef - KDS access only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddStaff}
              disabled={addLoading}
              className="bg-black hover:bg-gray-800"
              data-testid="save-staff-btn"
            >
              {addLoading ? 'Adding...' : 'Add Staff'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
