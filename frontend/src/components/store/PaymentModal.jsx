import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  CreditCard, Smartphone, Banknote, Check, Shield, Zap,
  ChevronRight, Sparkles,
} from 'lucide-react';

const PAYMENT_METHODS = [
  { id: 'upi', label: 'UPI', icon: Smartphone, color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { id: 'card', label: 'Card', icon: CreditCard, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: 'netbanking', label: 'Net Banking', icon: Banknote, color: 'bg-green-100 text-green-700 border-green-200' },
];

export default function PaymentModal({ open, onOpenChange, addon, billing, onSuccess }) {
  const [step, setStep] = useState('method'); // method → details → processing → success
  const [selectedMethod, setSelectedMethod] = useState('upi');
  const [formData, setFormData] = useState({
    upiId: '',
    cardNumber: '',
    cardExpiry: '',
    cardCvv: '',
    cardName: '',
  });

  const price = billing === 'monthly' ? addon?.monthly_price : Math.round(addon?.annual_price / 12);
  const annualPrice = addon?.annual_price;

  const resetAndClose = () => {
    setStep('method');
    setSelectedMethod('upi');
    setFormData({ upiId: '', cardNumber: '', cardExpiry: '', cardCvv: '', cardName: '' });
    onOpenChange(false);
  };

  const handleProceed = () => {
    setStep('details');
  };

  const handlePay = () => {
    setStep('processing');
    // Simulate payment processing
    setTimeout(() => {
      setStep('success');
    }, 2000);
  };

  const handleDone = () => {
    resetAndClose();
    onSuccess?.();
  };

  if (!addon) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetAndClose(); }}>
      <DialogContent className="rounded-2xl max-w-md p-0 overflow-hidden" data-testid="payment-modal">
        {/* Processing State */}
        {step === 'processing' && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 border-4 border-slate-200 border-t-[#1E3A8A] rounded-full animate-spin mx-auto mb-4" />
            <p className="font-heading font-bold text-lg text-slate-900">Processing Payment...</p>
            <p className="text-sm text-slate-500 mt-1">Please don't close this window</p>
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400">
              <Shield className="w-3.5 h-3.5" />
              <span>Secured by DineDesk Pay</span>
            </div>
          </div>
        )}

        {/* Success State */}
        {step === 'success' && (
          <div className="p-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce-in">
              <Check className="w-10 h-10 text-green-600" />
            </div>
            <p className="font-heading font-bold text-xl text-slate-900">Payment Successful! 🎉</p>
            <p className="text-sm text-slate-500 mt-2">
              <span className="font-semibold">{addon.name}</span> has been activated on your account.
            </p>
            <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-3">
              <p className="text-xs text-green-700">
                ₹{price.toLocaleString()}/{billing === 'monthly' ? 'month' : 'month (billed annually)'} — Start using your new feature now!
              </p>
            </div>
            <Button
              onClick={handleDone}
              className="w-full mt-6 bg-[#1E3A8A] hover:bg-[#2563EB] text-white rounded-xl h-11"
              data-testid="payment-success-btn"
            >
              <Sparkles className="w-4 h-4 mr-2" /> Start Using {addon.name}
            </Button>
          </div>
        )}

        {/* Payment Method Selection */}
        {step === 'method' && (
          <>
            <DialogHeader className="p-6 pb-0">
              <DialogTitle className="font-heading text-lg flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#F59E0B]" /> Subscribe to {addon.name}
              </DialogTitle>
            </DialogHeader>
            <div className="p-6 space-y-4">
              {/* Order Summary */}
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-600">{addon.name}</span>
                  <span className="text-sm font-bold text-slate-900">₹{price.toLocaleString()}/mo</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Billing: {billing === 'monthly' ? 'Monthly' : `Annual (₹${annualPrice?.toLocaleString()}/yr)`}</span>
                  {billing === 'annual' && (
                    <span className="text-green-600 font-medium">Save 17%</span>
                  )}
                </div>
                <div className="border-t border-dashed border-slate-200 mt-3 pt-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700">Total due today</span>
                  <span className="text-lg font-bold text-slate-900">₹{billing === 'monthly' ? price.toLocaleString() : annualPrice?.toLocaleString()}</span>
                </div>
              </div>

              {/* Payment Methods */}
              <div>
                <Label className="text-sm font-semibold text-slate-700 mb-2 block">Select Payment Method</Label>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_METHODS.map(method => {
                    const Icon = method.icon;
                    const isSelected = selectedMethod === method.id;
                    return (
                      <button
                        key={method.id}
                        onClick={() => setSelectedMethod(method.id)}
                        className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5 ${
                          isSelected
                            ? 'border-[#1E3A8A] bg-blue-50 ring-1 ring-[#1E3A8A]/20'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                        data-testid={`payment-method-${method.id}`}
                      >
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${method.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className={`text-xs font-semibold ${isSelected ? 'text-[#1E3A8A]' : 'text-slate-600'}`}>
                          {method.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Button
                onClick={handleProceed}
                className="w-full bg-[#1E3A8A] hover:bg-[#2563EB] text-white rounded-xl h-11"
                data-testid="payment-proceed-btn"
              >
                Continue <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </>
        )}

        {/* Payment Details */}
        {step === 'details' && (
          <>
            <DialogHeader className="p-6 pb-0">
              <DialogTitle className="font-heading text-lg flex items-center gap-2">
                {selectedMethod === 'upi' && <Smartphone className="w-5 h-5 text-purple-600" />}
                {selectedMethod === 'card' && <CreditCard className="w-5 h-5 text-blue-600" />}
                {selectedMethod === 'netbanking' && <Banknote className="w-5 h-5 text-green-600" />}
                Pay via {PAYMENT_METHODS.find(m => m.id === selectedMethod)?.label}
              </DialogTitle>
            </DialogHeader>
            <div className="p-6 space-y-4">
              {/* Amount */}
              <div className="text-center bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500">Amount to pay</p>
                <p className="text-2xl font-bold text-slate-900">₹{billing === 'monthly' ? price.toLocaleString() : annualPrice?.toLocaleString()}</p>
                <p className="text-[10px] text-slate-400">{addon.name} — {billing === 'monthly' ? 'Monthly' : 'Annual'}</p>
              </div>

              {/* UPI Form */}
              {selectedMethod === 'upi' && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-slate-600">UPI ID</Label>
                    <Input
                      placeholder="yourname@upi"
                      value={formData.upiId}
                      onChange={e => setFormData(p => ({ ...p, upiId: e.target.value }))}
                      className="mt-1 h-11 rounded-xl"
                      data-testid="upi-input"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 text-center">
                    💡 This is a mock payment — no real money will be charged
                  </p>
                </div>
              )}

              {/* Card Form */}
              {selectedMethod === 'card' && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-slate-600">Card Number</Label>
                    <Input
                      placeholder="4242 4242 4242 4242"
                      value={formData.cardNumber}
                      onChange={e => setFormData(p => ({ ...p, cardNumber: e.target.value }))}
                      className="mt-1 h-11 rounded-xl font-mono"
                      data-testid="card-number-input"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-slate-600">Expiry</Label>
                      <Input
                        placeholder="MM/YY"
                        value={formData.cardExpiry}
                        onChange={e => setFormData(p => ({ ...p, cardExpiry: e.target.value }))}
                        className="mt-1 h-11 rounded-xl"
                        data-testid="card-expiry-input"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">CVV</Label>
                      <Input
                        type="password"
                        placeholder="•••"
                        value={formData.cardCvv}
                        onChange={e => setFormData(p => ({ ...p, cardCvv: e.target.value }))}
                        className="mt-1 h-11 rounded-xl"
                        data-testid="card-cvv-input"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-600">Cardholder Name</Label>
                    <Input
                      placeholder="Name on card"
                      value={formData.cardName}
                      onChange={e => setFormData(p => ({ ...p, cardName: e.target.value }))}
                      className="mt-1 h-11 rounded-xl"
                      data-testid="card-name-input"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 text-center">
                    💡 This is a mock payment — no real money will be charged
                  </p>
                </div>
              )}

              {/* Net Banking Form */}
              {selectedMethod === 'netbanking' && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-slate-600">Select Bank</Label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      {['SBI', 'HDFC', 'ICICI', 'Axis'].map(bank => (
                        <button
                          key={bank}
                          onClick={() => setFormData(p => ({ ...p, upiId: bank }))}
                          className={`p-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                            formData.upiId === bank
                              ? 'border-[#1E3A8A] bg-blue-50 text-[#1E3A8A]'
                              : 'border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {bank} Bank
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 text-center">
                    💡 This is a mock payment — no real money will be charged
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep('method')}
                  className="flex-1 rounded-xl h-11"
                >
                  Back
                </Button>
                <Button
                  onClick={handlePay}
                  className="flex-1 bg-[#1E3A8A] hover:bg-[#2563EB] text-white rounded-xl h-11"
                  data-testid="pay-now-btn"
                >
                  <Zap className="w-4 h-4 mr-1" /> Pay ₹{billing === 'monthly' ? price?.toLocaleString() : annualPrice?.toLocaleString()}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
