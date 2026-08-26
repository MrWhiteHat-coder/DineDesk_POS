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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { FileText, LogIn, Store, CreditCard, Settings } from 'lucide-react';

const logTypeConfig = {
  auth: { label: 'Authentication', color: 'bg-blue-100 text-blue-700', icon: LogIn },
  restaurant: { label: 'Restaurant', color: 'bg-green-100 text-green-700', icon: Store },
  subscription: { label: 'Subscription', color: 'bg-purple-100 text-purple-700', icon: CreditCard },
  day_session: { label: 'Day Session', color: 'bg-amber-100 text-amber-700', icon: Settings },
  admin: { label: 'Admin', color: 'bg-red-100 text-red-700', icon: Settings },
};

export default function AdminLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logTypeFilter, setLogTypeFilter] = useState('all');

  useEffect(() => {
    fetchLogs();
  }, [logTypeFilter]);

  const fetchLogs = async () => {
    try {
      const logType = logTypeFilter !== 'all' ? logTypeFilter : undefined;
      const res = await adminAPI.getLogs(logType);
      setLogs(res.data);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-navy border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="admin-logs">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink">System Logs</h1>
        <Select value={logTypeFilter} onValueChange={setLogTypeFilter}>
          <SelectTrigger className="w-48" data-testid="log-type-filter">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Logs</SelectItem>
            <SelectItem value="auth">Authentication</SelectItem>
            <SelectItem value="restaurant">Restaurant</SelectItem>
            <SelectItem value="subscription">Subscription</SelectItem>
            <SelectItem value="day_session">Day Session</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Logs Table */}
      {logs.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>User ID</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => {
                const logType = logTypeConfig[log.log_type] || {
                  label: log.log_type,
                  color: 'bg-slate-100 text-slate-700',
                  icon: FileText,
                };
                const LogIcon = logType.icon;

                return (
                  <TableRow key={log.id} data-testid={`log-row-${log.id}`}>
                    <TableCell>
                      <Badge className={logType.color}>
                        <LogIcon className="w-3 h-3 mr-1" />
                        {logType.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{log.action}</TableCell>
                    <TableCell className="text-sm text-slate-500 font-mono">
                      {log.user_id ? log.user_id.slice(0, 8) + '...' : 'System'}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500 max-w-xs truncate">
                      {log.details || '-'}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {new Date(log.created_at).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card className="p-12 text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-400">No logs found</p>
        </Card>
      )}
    </div>
  );
}
