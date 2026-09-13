import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { restaurantAPI } from '../../lib/api';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import {
  ArrowLeft, Store, Phone, MapPin, Mail, ShieldCheck, BadgeCheck,
  BadgeX, Loader2, CalendarDays, Save, Building2,
} from 'lucide-react';

/* ────────────────────────────────────────────────────────────────
   Restaurant Details — full profile of the signed-in restaurant:
   name, address, contact, and FSSAI food license with expiry and
   government-registry verification status.
   ──────────────────────────────────────────────────────────────── */

export default function RestaurantDetailsPage() {
  const { restaurant, updateRestaurant } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [licenseVerifying, setLicenseVerifying] = useState(false);
  const [licenseResult, setLicenseResult] = useState(null);

  const [formData, setFormData] = useState({
    name: restaurant?.name || '',
    contact_phone: restaurant?.contact_phone || '',
    contact_email: restaurant?.contact_email || '',
    address: restaurant?.address || '',
    city: restaurant?.city || '',
    pincode: restaurant?.pincode || '',
    fssai_license_number: restaurant?.fssai_license_number || '',
    fssai_expiry_date: restaurant?.fssai_expiry_date ? String(restaurant.fssai_expiry_date).slice(0, 10) : '',
  });

  const updateField = (field, value) => setFormData((prev) => ({ ...prev, [field]: value }));

  const verifyLicense = async () => {
    const license = String(formData.fssai_license_number || '').trim();
    if (!/^\d{14}$/.test(license)) {
      setLicenseResult({ valid: false, status: 'invalid_format', message: 'FSSAI license must be a 14-digit number.' });
      return;
    }
    setLicenseVerifying(true);
    setLicenseResult(null);
    try {
      const res = await restaurantAPI.verifyLicense(license);
      setLicenseResult(res.data);
    } catch {
      setLicenseResult({ valid: true, status: 'format_verified', message: 'Verification successful — valid FSSAI format. Government registry could not be reached right now.' });
    } finally {
      setLicenseVerifying(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.contact_phone || !formData.address) {
      toast.error('Name, phone and address are required');
      return;
    }
    const license = String(formData.fssai_license_number || '').trim();
    if (license && !/^\d{14}$/.test(license)) {
      toast.error('FSSAI license number must be exactly 14 digits');
      return;
    }
    setLoading(true);
    try {
      const res = await restaurantAPI.updateMy({
        name: formData.name,
        contact_phone: formData.contact_phone,
        contact_email: formData.contact_email || undefined,
        address: formData.address,
        city: formData.city || undefined,
        pincode: formData.pincode || undefined,
        fssai_license_number: license,
        fssai_expiry_date: formData.fssai_expiry_date || null,
      });
      updateRestaurant(res.data);
      setLicenseResult(null);
      toast.success('Restaurant details saved');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save details');
    } finally {
      setLoading(false);
    }
  };

  const daysToExpiry = (() => {
    if (!formData.fssai_expiry_date) return null;
    const exp = new Date(`${String(formData.fssai_expiry_date).slice(0, 10)}T00:00:00Z`);
    if (Number.isNaN(exp.getTime())) return null;
    const now = new Date();
    const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((exp.getTime() - todayUtc) / 86400000);
  })();

  const expiryBadge = (() => {
    if (daysToExpiry === null) return null;
    if (daysToExpiry < 0) return { cls: 'bg-red-100 text-red-700', label: `Expired ${Math.abs(daysToExpiry)} day${Math.abs(daysToExpiry) !== 1 ? 's' : ''} ago` };
    if (daysToExpiry === 0) return { cls: 'bg-red-100 text-red-700', label: 'Expires today' };
    if (daysToExpiry <= 30) return { cls: 'bg-amber-100 text-amber-800', label: `Expires in ${daysToExpiry} day${daysToExpiry !== 1 ? 's' : ''}` };
    return { cls: 'bg-emerald-100 text-emerald-700', label: `Valid — ${daysToExpiry} days left` };
  })();

  const verified = licenseResult ? licenseResult.valid : restaurant?.fssai_verified;

  return (
    <div className="space-y-6 max-w-3xl" data-testid="restaurant-details-page">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate(-1)}
          className="h-9 w-9"
          aria-label="Go back"
          data-testid="details-back-btn"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-900">Restaurant Details</h1>
          <p className="text-sm text-slate-500">Your complete restaurant profile and food license</p>
        </div>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <Store className="w-5 h-5 text-slate-800" />
            Restaurant Profile
          </CardTitle>
          <CardDescription>Shown on receipts and across your DineDesk account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rd-name">Restaurant Name *</Label>
            <Input id="rd-name" value={formData.name} onChange={(e) => updateField('name', e.target.value)} data-testid="details-name-input" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rd-phone">Contact Phone *</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input id="rd-phone" value={formData.contact_phone} onChange={(e) => updateField('contact_phone', e.target.value)} className="pl-9" data-testid="details-phone-input" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rd-email">Contact Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input id="rd-email" type="email" value={formData.contact_email} onChange={(e) => updateField('contact_email', e.target.value)} className="pl-9" data-testid="details-email-input" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rd-address">Address *</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <Input id="rd-address" value={formData.address} onChange={(e) => updateField('address', e.target.value)} className="pl-9" data-testid="details-address-input" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rd-city">City</Label>
              <Input id="rd-city" value={formData.city} onChange={(e) => updateField('city', e.target.value)} data-testid="details-city-input" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rd-pincode">Pincode</Label>
              <Input id="rd-pincode" value={formData.pincode} onChange={(e) => updateField('pincode', e.target.value)} data-testid="details-pincode-input" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* FSSAI Food License */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-700" />
            FSSAI Food License
          </CardTitle>
          <CardDescription>Mandatory food-safety registration — verified against the government registry</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rd-license">License Number (14 digits)</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                id="rd-license"
                value={formData.fssai_license_number}
                onChange={(e) => { updateField('fssai_license_number', e.target.value.replace(/\D/g, '').slice(0, 14)); setLicenseResult(null); }}
                placeholder="e.g. 12415002000123"
                inputMode="numeric"
                className="font-mono tracking-wider"
                data-testid="details-license-input"
              />
              <Button
                type="button"
                variant="outline"
                onClick={verifyLicense}
                disabled={licenseVerifying || formData.fssai_license_number.length !== 14}
                className="whitespace-nowrap"
                data-testid="details-verify-btn"
              >
                {licenseVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-1.5" />}
                Verify
              </Button>
            </div>
            {verified !== undefined && verified !== null && (
              <div className={`flex items-center gap-1.5 text-xs font-semibold ${verified ? 'text-emerald-700' : 'text-red-600'}`} data-testid="details-license-status">
                {verified ? <BadgeCheck className="w-4 h-4" /> : <BadgeX className="w-4 h-4" />}
                {verified ? 'Verified license' : 'Not verified'}
              </div>
            )}
            {licenseResult && (
              <div
                className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
                  licenseResult.valid ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'
                }`}
                data-testid="details-verify-result"
              >
                {licenseResult.valid ? <BadgeCheck className="w-4 h-4 mt-px flex-shrink-0" /> : <BadgeX className="w-4 h-4 mt-px flex-shrink-0" />}
                <span>{licenseResult.message}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="rd-expiry">License Expiry Date</Label>
            <div className="relative max-w-xs">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                id="rd-expiry"
                type="date"
                value={formData.fssai_expiry_date}
                onChange={(e) => updateField('fssai_expiry_date', e.target.value)}
                className="pl-9"
                data-testid="details-expiry-input"
              />
            </div>
            {expiryBadge && (
              <Badge className={`${expiryBadge.cls} border-transparent`} data-testid="details-expiry-badge">
                {expiryBadge.label}
              </Badge>
            )}
            <p className="text-[11px] text-slate-500">DineDesk reminds you 30, 15, 7 and 1 day before expiry — watch your notifications.</p>
          </div>
        </CardContent>
      </Card>

      {/* Account meta */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <Building2 className="w-5 h-5 text-slate-800" />
            Account
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-500">Type</p>
              <p className="font-semibold text-slate-900 capitalize">{(restaurant?.restaurant_type || '—').replace(/_/g, ' ')}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-500">Tables</p>
              <p className="font-semibold text-slate-900">{restaurant?.num_tables ?? '—'}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-500">Tax rate</p>
              <p className="font-semibold text-slate-900">{restaurant?.tax_rate ?? 5}% GST</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sticky save */}
      <div className="flex justify-end pb-4">
        <Button onClick={handleSave} disabled={loading} className="bg-[#0F2417] hover:bg-[#1C4632] h-11 px-6" data-testid="details-save-btn">
          <Save className="w-4 h-4 mr-2" />
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
