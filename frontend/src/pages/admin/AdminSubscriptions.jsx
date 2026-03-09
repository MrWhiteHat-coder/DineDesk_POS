import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { CreditCard, Calendar, DollarSign } from 'lucide-react';

export default function AdminSubscriptions() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      const res = await adminAPI.getSubscriptions();
      setSubscriptions(res.data);
    } catch (err) {
      console.error('Failed to fetch subscriptions:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalRevenue = subscriptions.reduce((sum, s) => sum + s.amount, 0);
  const activeCount = subscriptions.filter((s) => s.status === 'active').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="admin-subscriptions">
      <h1 className="font-heading text-2xl font-bold text-slate-900">Subscription Management</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">Total Subscriptions</p>
                <p className="font-numbers text-2xl font-bold">{subscriptions.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">Active Subscriptions</p>
                <p className="font-numbers text-2xl font-bold text-green-600">{activeCount}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">Total Revenue</p>
                <p className="font-numbers text-2xl font-bold text-orange-600">
                  ₹{totalRevenue.toFixed(0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subscriptions Table */}
      {subscriptions.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payment ID</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>Expiry Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.map((sub) => (
                <TableRow key={sub.id} data-testid={`subscription-row-${sub.id}`}>
                  <TableCell className="font-mono text-sm">{sub.payment_id || 'N/A'}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{sub.plan_name}</p>
                      <p className="text-xs text-slate-500">{sub.currency}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-numbers font-semibold">₹{sub.amount.toFixed(0)}</span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        sub.status === 'active'
                          ? 'bg-green-500 text-white'
                          : 'bg-slate-500 text-white'
                      }
                    >
                      {sub.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(sub.starts_at).toLocaleDateString('en-IN')}
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(sub.expires_at).toLocaleDateString('en-IN')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card className="p-12 text-center">
          <CreditCard className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-400">No subscriptions yet</p>
        </Card>
      )}
    </div>
  );
}
