import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { restaurantAPI } from '../../lib/api';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Separator } from '../../components/ui/separator';
import { Store, Phone, MapPin, Calendar, CreditCard, Save } from 'lucide-react';

export default function SettingsPage() {
  const { restaurant, updateRestaurant } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: restaurant?.name || '',
    contact_phone: restaurant?.contact_phone || '',
    address: restaurant?.address || '',
    num_tables: restaurant?.num_tables?.toString() || '',
  });

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await restaurantAPI.updateMy({
        name: formData.name,
        contact_phone: formData.contact_phone,
        address: formData.address,
        num_tables: parseInt(formData.num_tables),
      });
      updateRestaurant(res.data);
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl" data-testid="settings-page">
      <h1 className="font-heading text-2xl font-bold text-slate-900">Settings</h1>

      {/* Restaurant Info */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <Store className="w-5 h-5 text-orange-500" />
            Restaurant Information
          </CardTitle>
          <CardDescription>Update your restaurant details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Restaurant Name</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              data-testid="settings-name-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Contact Phone</Label>
              <Input
                value={formData.contact_phone}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, contact_phone: e.target.value }))
                }
                data-testid="settings-phone-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Number of Tables</Label>
              <Input
                type="number"
                value={formData.num_tables}
                onChange={(e) => setFormData((prev) => ({ ...prev, num_tables: e.target.value }))}
                data-testid="settings-tables-input"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Address</Label>
            <Input
              value={formData.address}
              onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
              data-testid="settings-address-input"
            />
          </div>

          <Button
            onClick={handleSave}
            disabled={loading}
            className="bg-orange-500 hover:bg-orange-600"
            data-testid="save-settings-btn"
          >
            <Save className="w-4 h-4 mr-2" />
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </CardContent>
      </Card>

      {/* Subscription Info */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-orange-500" />
            Subscription
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg">
            <div>
              <p className="font-semibold text-slate-900">Restaurant POS Plan</p>
              <p className="text-sm text-slate-500">Annual subscription</p>
            </div>
            <div className="text-right">
              <Badge className="bg-green-500 mb-1">Active</Badge>
              <p className="text-sm text-slate-500">
                {restaurant?.subscription_expires
                  ? `Expires: ${new Date(restaurant.subscription_expires).toLocaleDateString('en-IN')}`
                  : 'No expiry info'}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Plan Price</p>
              <p className="font-numbers font-semibold">₹2,999/year</p>
            </div>
            <div>
              <p className="text-slate-500">Restaurant Type</p>
              <p className="font-semibold capitalize">{restaurant?.restaurant_type || 'N/A'}</p>
            </div>
            <div>
              <p className="text-slate-500">City</p>
              <p className="font-semibold">{restaurant?.city || 'N/A'}</p>
            </div>
            <div>
              <p className="text-slate-500">Pincode</p>
              <p className="font-semibold">{restaurant?.pincode || 'N/A'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delivery Platforms */}
      {restaurant?.uses_delivery && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">Delivery Integrations</CardTitle>
            <CardDescription>Connected delivery platforms</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {restaurant.delivery_platforms?.includes('swiggy') && (
                <Badge className="bg-orange-500">Swiggy</Badge>
              )}
              {restaurant.delivery_platforms?.includes('zomato') && (
                <Badge className="bg-red-500">Zomato</Badge>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Webhook endpoints are ready for integration
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
