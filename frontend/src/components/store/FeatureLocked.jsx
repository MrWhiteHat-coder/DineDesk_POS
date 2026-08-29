import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Lock, Zap, ArrowRight } from 'lucide-react';

export default function FeatureLocked({ addonName, addonPrice, featureDescription }) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center min-h-[400px] animate-fade-in">
      <Card className="max-w-md w-full mx-4 border-slate-200 overflow-hidden">
        {/* Gradient header */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10">
            <div className="w-14 h-14 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Lock className="w-7 h-7 text-white" />
            </div>
            <h2 className="font-heading font-bold text-white text-lg">Feature Locked</h2>
            <p className="text-slate-300 text-sm mt-1">
              {addonName || 'This feature'} requires an add-on subscription
            </p>
          </div>
        </div>

        <CardContent className="p-6 text-center">
          {featureDescription && (
            <p className="text-sm text-slate-500 mb-4">{featureDescription}</p>
          )}

          <div className="bg-slate-50 rounded-xl p-4 mb-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Required Add-on</span>
              <span className="text-sm font-bold text-slate-900">{addonName}</span>
            </div>
            {addonPrice && (
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200">
                <span className="text-xs text-slate-400">Starting from</span>
                <span className="text-lg font-bold text-[#1E3A8A]">₹{addonPrice}/mo</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Button
              onClick={() => navigate('/pos/store')}
              className="w-full bg-[#1E3A8A] hover:bg-[#2563EB] text-white rounded-xl h-11 gap-2"
              data-testid="unlock-feature-btn"
            >
              <Zap className="w-4 h-4" /> Unlock in Store <ArrowRight className="w-4 h-4" />
            </Button>
            <Button
              onClick={() => navigate('/pos')}
              variant="ghost"
              className="w-full text-slate-500 rounded-xl"
            >
              Back to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
