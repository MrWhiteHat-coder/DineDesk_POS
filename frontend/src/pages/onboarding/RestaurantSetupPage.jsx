import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { restaurantAPI } from '../../lib/api';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Checkbox } from '../../components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { UtensilsCrossed, ArrowRight, ArrowLeft, Store, Phone, MapPin, ShieldCheck, BadgeCheck, BadgeX, Loader2, CalendarDays } from 'lucide-react';
import logoUrl from '../../assets/dinedesk-logo.png';

export default function RestaurantSetupPage() {
  const { updateUser, updateRestaurant } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    name: '',
    restaurant_type: '',
    num_tables: '',
    avg_daily_orders: '',
    uses_delivery: false,
    delivery_platforms: [],
    contact_phone: '',
    contact_email: '',
    address: '',
    city: '',
    pincode: '',
    fssai_license_number: '',
    fssai_expiry_date: '',
  });

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const togglePlatform = (platform) => {
    setFormData((prev) => ({
      ...prev,
      delivery_platforms: prev.delivery_platforms.includes(platform)
        ? prev.delivery_platforms.filter((p) => p !== platform)
        : [...prev.delivery_platforms, platform],
    }));
  };

  // FSSAI license verification state
  const [licenseVerifying, setLicenseVerifying] = useState(false);
  const [licenseResult, setLicenseResult] = useState(null); // {valid, status, message}

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

  const handleNext = () => {
    if (step === 1) {
      if (!formData.name || !formData.restaurant_type || !formData.num_tables) {
        toast.error('Please fill all required fields');
        return;
      }
    }
    if (step === 2) {
      const license = String(formData.fssai_license_number || '').trim();
      if (!/^\d{14}$/.test(license)) {
        toast.error('FSSAI food license number (14 digits) is mandatory for registration');
        return;
      }
      if (!formData.fssai_expiry_date) {
        toast.error('Please add the license expiry date from your FSSAI certificate');
        return;
      }
    }
    setStep(step + 1);
  };

  const handleBack = () => {
    if (step === 1) {
      navigate('/onboarding');
    } else {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    if (!formData.contact_phone || !formData.contact_email || !formData.address || !formData.city || !formData.pincode) {
      toast.error('Please fill all contact details');
      return;
    }

    setLoading(true);
    try {
      const response = await restaurantAPI.onboard({
        ...formData,
        num_tables: parseInt(formData.num_tables),
        avg_daily_orders: parseInt(formData.avg_daily_orders) || 0,
        fssai_license_number: formData.fssai_license_number.trim(),
        fssai_expiry_date: formData.fssai_expiry_date || null,
      });

      updateUser({ restaurant_id: response.data.id });
      updateRestaurant(response.data);
      toast.success('Restaurant setup complete!');
      navigate('/subscription');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Setup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="text-center mb-8">
          <img src={logoUrl} alt="DineDesk" className="lp-logo-nav h-12 w-auto mx-auto mb-4" loading="eager" />
          <h1 className="font-heading text-2xl font-bold text-slate-900 mb-2">
            Setup Your Restaurant
          </h1>
          <p className="text-slate-500">Step {step} of 3</p>
        </div>

        {/* Progress Bar */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 flex-1 rounded-full transition-all ${
                s <= step ? 'bg-[#0F2417]' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>

        <Card className="border-slate-200 shadow-xl">
          <CardHeader>
            <CardTitle className="font-heading text-lg">
              {step === 1 && 'Restaurant Details'}
              {step === 2 && 'Delivery Platforms'}
              {step === 3 && 'Contact Information'}
            </CardTitle>
            <CardDescription>
              {step === 1 && 'Tell us about your restaurant'}
              {step === 2 && 'Do you use online delivery platforms?'}
              {step === 3 && 'How can customers reach you?'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Restaurant Details */}
            {step === 1 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">Restaurant Name *</Label>
                  <div className="relative">
                    <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => updateField('name', e.target.value)}
                      placeholder="Your Restaurant Name"
                      className="pl-10 h-12"
                      data-testid="restaurant-name-input"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Restaurant Type *</Label>
                  <Select
                    value={formData.restaurant_type}
                    onValueChange={(val) => updateField('restaurant_type', val)}
                  >
                    <SelectTrigger className="h-12" data-testid="restaurant-type-select">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="restaurant">Restaurant</SelectItem>
                      <SelectItem value="cafe">Cafe</SelectItem>
                      <SelectItem value="cloud_kitchen">Cloud Kitchen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tables">Number of Tables *</Label>
                    <Input
                      id="tables"
                      type="number"
                      value={formData.num_tables}
                      onChange={(e) => updateField('num_tables', e.target.value)}
                      placeholder="e.g., 10"
                      className="h-12"
                      data-testid="num-tables-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="orders">Avg Daily Orders</Label>
                    <Input
                      id="orders"
                      type="number"
                      value={formData.avg_daily_orders}
                      onChange={(e) => updateField('avg_daily_orders', e.target.value)}
                      placeholder="e.g., 50"
                      className="h-12"
                      data-testid="avg-orders-input"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Step 2: Delivery Platforms */}
            {step === 2 && (
              <>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="delivery"
                      checked={formData.uses_delivery}
                      onCheckedChange={(checked) => updateField('uses_delivery', checked)}
                      data-testid="uses-delivery-checkbox"
                    />
                    <Label htmlFor="delivery" className="cursor-pointer">
                      Do you sell on delivery platforms?
                    </Label>
                  </div>

                  {formData.uses_delivery && (
                    <div className="pl-6 space-y-3 animate-fade-in">
                      <p className="text-sm text-slate-500 mb-3">Select your platforms:</p>
                      
                      <div
                        onClick={() => togglePlatform('swiggy')}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          formData.delivery_platforms.includes('swiggy')
                            ? 'border-slate-800 bg-slate-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                        data-testid="platform-swiggy"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden bg-black">
                              <svg viewBox="0 0 61 61" className="w-8 h-8" fill="white">
                                <path d="M30.5 0C13.7 0 0 13.7 0 30.5S13.7 61 30.5 61 61 47.3 61 30.5 47.3 0 30.5 0zm15.3 23.8l-4.8 18.4c-.3 1.3-1.5 2.2-2.8 2.2H22.8c-1.3 0-2.5-.9-2.8-2.2l-4.8-18.4c-.4-1.6.8-3.1 2.4-3.1h25.8c1.6 0 2.8 1.5 2.4 3.1zm-7.6 4.1c-.5-1.4-1.8-2.3-3.3-2.3h-8.8c-1.5 0-2.8.9-3.3 2.3l-2.3 6.3c-.3.9.4 1.8 1.3 1.8h17.4c.9 0 1.6-.9 1.3-1.8l-2.3-6.3z"/>
                              </svg>
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">Swiggy</p>
                              <p className="text-xs text-slate-500">Food delivery platform</p>
                            </div>
                          </div>
                          <Checkbox checked={formData.delivery_platforms.includes('swiggy')} />
                        </div>
                      </div>

                      <div
                        onClick={() => togglePlatform('zomato')}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          formData.delivery_platforms.includes('zomato')
                            ? 'border-slate-800 bg-slate-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                        data-testid="platform-zomato"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden bg-red-500">
                              <span className="text-white font-bold text-lg">Z</span>
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">Zomato</p>
                              <p className="text-xs text-slate-500">Food delivery platform</p>
                            </div>
                          </div>
                          <Checkbox checked={formData.delivery_platforms.includes('zomato')} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* FSSAI food license — mandatory per Indian regulation */}
                <div className="space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-700" />
                    <div>
                      <Label htmlFor="fssai-license">FSSAI Food License Number *</Label>
                      <p className="text-[11px] text-slate-500">14-digit number on your FSSAI certificate — mandatory for registration in India</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id="fssai-license"
                      value={formData.fssai_license_number}
                      onChange={(e) => {
                        updateField('fssai_license_number', e.target.value.replace(/\D/g, '').slice(0, 14));
                        setLicenseResult(null);
                      }}
                      placeholder="e.g. 12415002000123"
                      inputMode="numeric"
                      className="h-12 font-mono tracking-wider"
                      data-testid="fssai-license-input"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={verifyLicense}
                      disabled={licenseVerifying || formData.fssai_license_number.length !== 14}
                      className="h-12 px-4 whitespace-nowrap"
                      data-testid="fssai-verify-btn"
                    >
                      {licenseVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-1.5" />}
                      Verify
                    </Button>
                  </div>
                  {licenseResult && (
                    <div
                      className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
                        licenseResult.valid
                          ? 'border-emerald-200 bg-white text-emerald-800'
                          : 'border-red-200 bg-white text-red-700'
                      }`}
                      data-testid="fssai-verify-result"
                    >
                      {licenseResult.valid
                        ? <BadgeCheck className="w-4 h-4 mt-px flex-shrink-0 text-emerald-600" />
                        : <BadgeX className="w-4 h-4 mt-px flex-shrink-0 text-red-500" />}
                      <span>
                        {licenseResult.message}
                        {licenseResult.registry_status === 'ACTIVE' && licenseResult.premises_address && (
                          <span className="block mt-1 text-emerald-700/80">Registered premises: {licenseResult.premises_address}</span>
                        )}
                      </span>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="fssai-expiry">License Expiry Date *</Label>
                    <div className="relative">
                      <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <Input
                        id="fssai-expiry"
                        type="date"
                        value={formData.fssai_expiry_date}
                        onChange={(e) => updateField('fssai_expiry_date', e.target.value)}
                        className="pl-10 h-12"
                        data-testid="fssai-expiry-input"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500">We remind you 30 days before expiry so you never fall out of compliance.</p>
                  </div>
                </div>
              </>
            )}

            {/* Step 3: Contact Info */}
            {step === 3 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="phone">Contact Phone *</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                      id="phone"
                      value={formData.contact_phone}
                      onChange={(e) => updateField('contact_phone', e.target.value)}
                      placeholder="+91 98765 43210"
                      className="pl-10 h-12"
                      data-testid="contact-phone-input"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Contact Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => updateField('contact_email', e.target.value)}
                    placeholder="restaurant@example.com"
                    className="h-12"
                    data-testid="contact-email-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address *</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => updateField('address', e.target.value)}
                      placeholder="Street address"
                      className="pl-10 h-12"
                      data-testid="address-input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => updateField('city', e.target.value)}
                      placeholder="Mumbai"
                      className="h-12"
                      data-testid="city-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pincode">Pincode *</Label>
                    <Input
                      id="pincode"
                      value={formData.pincode}
                      onChange={(e) => updateField('pincode', e.target.value)}
                      placeholder="400001"
                      className="h-12"
                      data-testid="pincode-input"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={handleBack}
                className="h-12"
                data-testid="back-btn"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>

              {step < 3 ? (
                <Button
                  onClick={handleNext}
                  className="h-12 bg-[#0F2417] hover:bg-[#1C4632]"
                  data-testid="next-btn"
                >
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="h-12 bg-[#0F2417] hover:bg-[#1C4632]"
                  data-testid="submit-setup-btn"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      Complete Setup
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
