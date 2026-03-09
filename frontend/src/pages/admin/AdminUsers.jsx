import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../lib/api';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { Users, User, Shield, CreditCard } from 'lucide-react';

const roleConfig = {
  admin: { label: 'Admin', color: 'bg-red-100 text-red-700', icon: Shield },
  owner: { label: 'Owner', color: 'bg-purple-100 text-purple-700', icon: User },
  manager: { label: 'Manager', color: 'bg-blue-100 text-blue-700', icon: User },
  cashier: { label: 'Cashier', color: 'bg-green-100 text-green-700', icon: CreditCard },
};

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await adminAPI.getUsers();
      setUsers(res.data);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  };

  const roleCounts = {
    admin: users.filter((u) => u.role === 'admin').length,
    owner: users.filter((u) => u.role === 'owner').length,
    manager: users.filter((u) => u.role === 'manager').length,
    cashier: users.filter((u) => u.role === 'cashier').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="admin-users">
      <h1 className="font-heading text-2xl font-bold text-slate-900">User Monitoring</h1>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">Total Users</p>
                <p className="font-numbers text-2xl font-bold">{users.length}</p>
              </div>
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-slate-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">Owners</p>
                <p className="font-numbers text-2xl font-bold text-purple-600">{roleCounts.owner}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <User className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">Managers</p>
                <p className="font-numbers text-2xl font-bold text-blue-600">{roleCounts.manager}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <User className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">Cashiers</p>
                <p className="font-numbers text-2xl font-bold text-green-600">{roleCounts.cashier}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      {users.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Restaurant ID</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const role = roleConfig[user.role] || roleConfig.owner;

                return (
                  <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                          <span className="font-semibold text-slate-600">
                            {user.name?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{user.name}</p>
                          <p className="text-sm text-slate-500">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={role.color}>{role.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500 font-mono">
                      {user.restaurant_id ? user.restaurant_id.slice(0, 8) + '...' : 'N/A'}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {new Date(user.created_at).toLocaleDateString('en-IN')}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card className="p-12 text-center">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-400">No users found</p>
        </Card>
      )}
    </div>
  );
}
