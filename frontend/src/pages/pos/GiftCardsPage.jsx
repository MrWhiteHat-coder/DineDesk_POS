import React, { useState, useEffect } from 'react';
import api, { giftCardAPI } from '../../lib/api';
import { toast } from 'sonner';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import {
  Gift, CreditCard, QrCode, Search, Plus, CheckCircle,
  Clock, XCircle, ArrowRight, IndianRupee, Send
} from 'lucide-react';

const DENOMINATIONS = [500, 1000, 2000, 5000];

export default function GiftCardsPage() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPurchase, setShowPurchase] = useState(false);
  const [showRedeem, setShowRedeem] = useState(false);
  const [showGift, setShowGift] = useState(false);
  const [search, setSearch] = useState('');
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemAmount, setRedeemAmount] = useState('');
  const [selectedAmount, setSelectedAmount] = useState(1000);
  const [customAmount, setCustomAmount] = useState('');
  const [giftRecipient, setGiftRecipient] = useState({ phone: '', name: '' });
  const [redeemResult, setRedeemResult] = useState(null);

  useEffect(() => { fetchCards(); }, []);

  const fetchCards = async () => {
    try {
      const res = await giftCardAPI.getAll();
      setCards(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    const amount = customAmount ? parseFloat(customAmount) : selectedAmount;
    if (!amount || amount < 100) {
      toast.error('Minimum gift card value is ₹100');
      return;
    }
    try {
      const res = await giftCardAPI.purchase({ face_value: amount });
      toast.success(`Gift card created: ${res.data.code}`);
      setShowPurchase(false);
      fetchCards();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create gift card');
    }
  };

  const handleRedeem = async () => {
    if (!redeemCode || !redeemAmount) {
      toast.error('Enter code and amount');
      return;
    }
    try {
      const res = await giftCardAPI.redeem({
        code: redeemCode,
        amount: parseFloat(redeemAmount)
      });
      setRedeemResult(res.data);
      toast.success(res.data.message);
      fetchCards();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to redeem');
    }
  };

  const handleGift = async () => {
    const amount = customAmount ? parseFloat(customAmount) : selectedAmount;
    if (!amount || !giftRecipient.phone) {
      toast.error('Amount and recipient phone are required');
      return;
    }
    try {
      const res = await giftCardAPI.purchase({
        face_value: amount,
        recipient_phone: giftRecipient.phone,
        recipient_name: giftRecipient.name
      });
      toast.success(`Gift card sent to ${giftRecipient.phone}: ${res.data.code}`);
      setShowGift(false);
      setGiftRecipient({ phone: '', name: '' });
      fetchCards();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send gift');
    }
  };

  const filtered = cards.filter(c =>
    !search || c.code?.toLowerCase().includes(search.toLowerCase()) ||
    c.recipient_name?.toLowerCase().includes(search.toLowerCase())
  );

  const statusIcon = (status) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-4 h-4 text-dd-success" />;
      case 'redeemed': return <Clock className="w-4 h-4 text-dd-saffron" />;
      case 'expired': return <XCircle className="w-4 h-4 text-dd-error" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink">Gift Cards</h1>
          <p className="text-sm text-gray-500">Purchase, redeem, and send digital gift cards</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowRedeem(true)} className="dd-btn-outline gap-2">
            <QrCode className="w-4 h-4" /> Redeem
          </Button>
          <Button onClick={() => setShowGift(true)} className="dd-btn-accent gap-2">
            <Send className="w-4 h-4" /> Gift
          </Button>
          <Button onClick={() => setShowPurchase(true)} className="dd-btn-primary gap-2">
            <Plus className="w-4 h-4" /> Purchase
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-dd-blue text-white border-0">
          <CardContent className="p-4">
            <p className="text-sm text-blue-200">Active Cards</p>
            <p className="text-3xl font-bold font-numbers">{cards.filter(c => c.status === 'active').length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Total Value</p>
            <p className="text-3xl font-bold font-numbers text-gray-900">₹{cards.reduce((s, c) => s + (c.balance || 0), 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Total Redeemed</p>
            <p className="text-3xl font-bold font-numbers text-dd-success">₹{cards.reduce((s, c) => s + ((c.face_value || 0) - (c.balance || 0)), 0).toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input placeholder="Search by code or name..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 dd-input" />
      </div>

      {/* Cards List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <Card className="trident-watermark">
            <CardContent className="p-12 text-center">
              <Gift className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No gift cards yet</p>
              <p className="text-sm text-gray-400 mt-1">Create your first gift card to get started</p>
            </CardContent>
          </Card>
        ) : (
          filtered.map(card => (
            <div key={card.id} className="flex items-center gap-4 p-4 bg-white rounded-card border border-dd-border hover:shadow-card-hover transition-all">
              <div className="w-12 h-12 bg-gradient-to-br from-dd-blue to-dd-saffron rounded-card flex items-center justify-center flex-shrink-0">
                <Gift className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm">{card.code}</span>
                  <span className="flex items-center gap-1 text-xs text-gray-500">{statusIcon(card.status)} {card.status}</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {card.recipient_name ? `Gifted to ${card.recipient_name}` : `Purchased`} · Expires {new Date(card.expires_at).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold font-numbers">₹{(card.balance || 0).toLocaleString()}</p>
                <p className="text-[10px] text-gray-400">of ₹{(card.face_value || 0).toLocaleString()}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Purchase Dialog */}
      <Dialog open={showPurchase} onOpenChange={setShowPurchase}>
        <DialogContent className="rounded-modal max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Purchase Gift Card</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {DENOMINATIONS.map(amount => (
                <button
                  key={amount}
                  onClick={() => { setSelectedAmount(amount); setCustomAmount(''); }}
                  className={`p-4 rounded-card border-2 text-center transition-all ${
                    selectedAmount === amount && !customAmount
                      ? 'border-dd-blue bg-blue-50 text-dd-blue'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="text-2xl font-bold font-numbers">₹{amount.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-1">{Math.floor(amount / 1000 * 10)} coins</p>
                </button>
              ))}
            </div>
            <div>
              <Label className="text-sm text-gray-600">Custom Amount</Label>
              <Input
                type="number"
                placeholder="Enter custom amount"
                value={customAmount}
                onChange={e => setCustomAmount(e.target.value)}
                className="mt-1.5 dd-input"
              />
            </div>
            <div className="bg-blue-50 rounded-card p-3 border border-blue-100">
              <p className="text-xs text-dd-blue font-medium">
                💰 You'll receive {Math.floor((customAmount || selectedAmount) / 1000 * 10)} Trident Coins with this purchase
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPurchase(false)} className="rounded-btn">Cancel</Button>
            <Button onClick={handlePurchase} className="dd-btn-primary">
              Purchase ₹{(customAmount || selectedAmount).toLocaleString()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Redeem Dialog */}
      <Dialog open={showRedeem} onOpenChange={setShowRedeem}>
        <DialogContent className="rounded-modal max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Redeem Gift Card</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm text-gray-600">Gift Card Code</Label>
              <Input
                placeholder="DD-XXXXXXXX"
                value={redeemCode}
                onChange={e => setRedeemCode(e.target.value.toUpperCase())}
                className="mt-1.5 dd-input font-mono"
              />
            </div>
            <div>
              <Label className="text-sm text-gray-600">Amount to Redeem (₹)</Label>
              <Input
                type="number"
                placeholder="Enter amount"
                value={redeemAmount}
                onChange={e => setRedeemAmount(e.target.value)}
                className="mt-1.5 dd-input"
              />
            </div>
            {redeemResult && (
              <div className="bg-emerald-50 rounded-card p-4 border border-emerald-200">
                <p className="text-sm font-semibold text-dd-success">✅ {redeemResult.message}</p>
                <p className="text-xs text-gray-600 mt-1">
                  Remaining balance: ₹{redeemResult.remaining_balance?.toFixed(2)} · Settlement: ₹{redeemResult.settlement_amount?.toFixed(2)}
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowRedeem(false); setRedeemResult(null); }} className="rounded-btn">Close</Button>
            <Button onClick={handleRedeem} className="dd-btn-primary">Redeem</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Gift Dialog */}
      <Dialog open={showGift} onOpenChange={setShowGift}>
        <DialogContent className="rounded-modal max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Send Gift Card</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {DENOMINATIONS.map(amount => (
                <button
                  key={amount}
                  onClick={() => { setSelectedAmount(amount); setCustomAmount(''); }}
                  className={`p-3 rounded-card border-2 text-center transition-all ${
                    selectedAmount === amount && !customAmount
                      ? 'border-dd-saffron bg-amber-50 text-dd-saffron-dark'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="text-xl font-bold font-numbers">₹{amount.toLocaleString()}</p>
                </button>
              ))}
            </div>
            <div>
              <Label className="text-sm text-gray-600">Recipient Phone *</Label>
              <Input
                placeholder="+91 98765 43210"
                value={giftRecipient.phone}
                onChange={e => setGiftRecipient(p => ({ ...p, phone: e.target.value }))}
                className="mt-1.5 dd-input"
              />
            </div>
            <div>
              <Label className="text-sm text-gray-600">Recipient Name</Label>
              <Input
                placeholder="Recipient's name"
                value={giftRecipient.name}
                onChange={e => setGiftRecipient(p => ({ ...p, name: e.target.value }))}
                className="mt-1.5 dd-input"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowGift(false)} className="rounded-btn">Cancel</Button>
            <Button onClick={handleGift} className="dd-btn-accent gap-2">
              <Send className="w-4 h-4" /> Send Gift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
