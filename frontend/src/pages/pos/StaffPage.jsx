import React, { useState, useEffect } from 'react';
import { staffAPI } from '../../lib/api';
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
import { Plus, Trash2, User, Shield, CreditCard } from 'lucide-react';

const roleConfig = {
  owner: { label: 'Owner', color: 'bg-purple-100 text-purple-700', icon: Shield },
  manager: { label: 'Manager', color: 'bg-blue-100 text-blue-700', icon: User },
  cashier: { label: 'Cashier', color: 'bg-green-100 text-green-700', icon: CreditCard },
};

export default function StaffPage() {
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

  const handleDeleteStaff = async (staffId) => {
    if (!window.confirm('Remove this staff member?')) return;

    try {
      await staffAPI.delete(staffId);
      toast.success('Staff member removed');
      fetchStaff();
    } catch (err) {
      toast.error('Failed to remove staff');
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
    <div className="space-y-6" data-testid="staff-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-slate-900">Staff Management</h1>
        <Button
          onClick={() => setShowModal(true)}
          className="bg-orange-500 hover:bg-orange-600"
          data-testid="add-staff-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Staff
        </Button>
      </div>

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
          <Button onClick={() => setShowModal(true)} className="bg-orange-500 hover:bg-orange-600">
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
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="cashier">Cashier</SelectItem>
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
              className="bg-orange-500 hover:bg-orange-600"
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
