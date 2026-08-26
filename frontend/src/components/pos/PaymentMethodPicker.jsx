import React from 'react';
import { Banknote, CreditCard, Smartphone, ChevronRight } from 'lucide-react';

const METHODS = [
  {
    id: 'cash',
    label: 'Cash',
    desc: 'Collect at the counter',
    icon: Banknote,
    tint: 'bg-[#E8F5E9] text-[#267E3E]',
    testid: 'checkout-cash',
  },
  {
    id: 'card',
    label: 'Card',
    desc: 'Debit / credit swipe',
    icon: CreditCard,
    tint: 'bg-[#E3F2FD] text-[#1565C0]',
    testid: 'checkout-card',
  },
  {
    id: 'upi',
    label: 'UPI',
    desc: 'GPay, PhonePe, Paytm',
    icon: Smartphone,
    tint: 'bg-[#FFF5F6] text-[#E23744]',
    testid: 'checkout-upi',
  },
];

export default function PaymentMethodPicker({
  amount,
  onSelect,
  loading = false,
  testIdPrefix = 'checkout',
}) {
  return (
    <div className="space-y-3" data-testid="payment-method-picker">
      <div className="text-center bg-[#FFF5F6] border border-[#F8D7DA] rounded-2xl py-5 px-4">
        <p className="text-[11px] uppercase tracking-[0.16em] font-bold text-[#E23744] mb-1">
          Amount to collect
        </p>
        <p className="font-numbers text-[34px] leading-none text-[#E23744]">
          ₹{Number(amount || 0).toFixed(2)}
        </p>
      </div>

      {METHODS.map((method) => (
        <button
          key={method.id}
          type="button"
          disabled={loading}
          onClick={() => onSelect(method.id)}
          className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-[#E8E8E8] text-left hover:border-[#E23744] hover:bg-[#FFF5F6] hover:shadow-card transition-all disabled:opacity-50"
          data-testid={`${testIdPrefix}-${method.id}`}
        >
          <span className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${method.tint}`}>
            <method.icon className="w-6 h-6" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[15px] font-bold text-[#1C1C1C]">{method.label}</span>
            <span className="block text-xs text-[#696969]">{method.desc}</span>
          </span>
          <ChevronRight className="w-5 h-5 text-[#E23744]" />
        </button>
      ))}
    </div>
  );
}
