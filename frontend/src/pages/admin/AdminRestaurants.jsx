import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../lib/api';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
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
import { Search, Store, MapPin, Check, X } from 'lucide-react';

export default function AdminRestaurants() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchRestaurants();
  }, [searchQuery, statusFilter]);

  const fetchRestaurants = async () => {
    try {
      const params = {};
      if (searchQuery) params.search = searchQuery;
      if (statusFilter !== 'all') params.status = statusFilter;

      const res = await adminAPI.getRestaurants(params);
      setRestaurants(res.data);
    } catch (err) {
      console.error('Failed to fetch restaurants:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (restaurantId, currentStatus) => {
    try {
      await adminAPI.updateRestaurantStatus(restaurantId, !currentStatus);
      toast.success(`Restaurant ${!currentStatus ? 'activated' : 'suspended'}`);
      fetchRestaurants();
    } catch (err) {
      toast.error('Failed to update status');
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
    <div className="space-y-6" data-testid="admin-restaurants">
      <h1 className="font-display text-2xl font-semibold text-ink">Restaurant Management</h1>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            placeholder="Search restaurants..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="search-restaurants-input"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40" data-testid="status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Restaurants Table */}
      {restaurants.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Restaurant</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Subscription</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {restaurants.map((restaurant) => (
                <TableRow key={restaurant.id} data-testid={`restaurant-row-${restaurant.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                        <Store className="w-5 h-5 text-slate-800" />
                      </div>
                      <div>
                        <p className="font-medium">{restaurant.name}</p>
                        <p className="text-sm text-slate-500">{restaurant.contact_email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {restaurant.restaurant_type?.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-slate-500">
                      <MapPin className="w-4 h-4" />
                      {restaurant.city}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        restaurant.subscription_status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }
                    >
                      {restaurant.subscription_status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        restaurant.is_active
                          ? 'bg-green-500 text-white'
                          : 'bg-red-500 text-white'
                      }
                    >
                      {restaurant.is_active ? 'Active' : 'Suspended'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant={restaurant.is_active ? 'destructive' : 'default'}
                      size="sm"
                      onClick={() => handleToggleStatus(restaurant.id, restaurant.is_active)}
                      className={!restaurant.is_active ? 'bg-green-500 hover:bg-green-600' : ''}
                      data-testid={`toggle-restaurant-${restaurant.id}`}
                    >
                      {restaurant.is_active ? (
                        <>
                          <X className="w-4 h-4 mr-1" />
                          Suspend
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-1" />
                          Activate
                        </>
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card className="p-12 text-center">
          <Store className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-400">No restaurants found</p>
        </Card>
      )}
    </div>
  );
}
