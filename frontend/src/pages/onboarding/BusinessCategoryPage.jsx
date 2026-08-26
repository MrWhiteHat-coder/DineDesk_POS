import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../../components/ui/card';
import { UtensilsCrossed, Shirt, ShoppingCart, ArrowRight, Lock } from 'lucide-react';

const businessCategories = [
  {
    id: 'food',
    name: 'Food Business',
    description: 'Restaurants, Cafes, Cloud Kitchens',
    icon: UtensilsCrossed,
    enabled: true,
    color: 'slate',
  },
  {
    id: 'clothing',
    name: 'Clothing Business',
    description: 'Fashion Stores, Boutiques',
    icon: Shirt,
    enabled: false,
    color: 'purple',
  },
  {
    id: 'supermarket',
    name: 'Supermarket',
    description: 'Grocery Stores, General Stores',
    icon: ShoppingCart,
    enabled: false,
    color: 'green',
  },
];

export default function BusinessCategoryPage() {
  const navigate = useNavigate();

  const handleSelect = (category) => {
    if (category.enabled) {
      navigate('/onboarding/setup');
    }
  };

  return (
    <div className="min-h-screen bg-linen flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-ink rounded-2xl mb-4 shadow-ink">
            <UtensilsCrossed className="w-8 h-8 text-white" />
          </div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-navy font-semibold mb-2">Onboarding</p>
          <h1 className="font-display text-3xl font-semibold text-ink mb-2">
            Welcome to DineDesk
          </h1>
          <p className="text-ink/50 text-lg">Select your business category to get started</p>
        </div>

        {/* Business Category Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {businessCategories.map((category) => (
            <Card
              key={category.id}
              onClick={() => handleSelect(category)}
              className={`relative overflow-hidden cursor-pointer transition-all duration-300 ${
                category.enabled
                  ? 'hover:shadow-card-hover hover:-translate-y-1 border-2 border-transparent hover:border-navy/30'
                  : 'opacity-60 cursor-not-allowed'
              }`}
              data-testid={`category-${category.id}`}
            >
              <CardContent className="p-6">
                {!category.enabled && (
                  <div className="absolute top-3 right-3 bg-slate-100 text-slate-500 text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Coming Soon
                  </div>
                )}

                <div
                  className={`w-14 h-14 rounded-xl flex items-center justify-center mb-4 ${
                    category.enabled
                      ? 'bg-navy/10 text-navy'
                      : 'bg-linen text-ink/30'
                  }`}
                >
                  <category.icon className="w-7 h-7" />
                </div>

                <h3 className="font-heading font-semibold text-lg text-slate-900 mb-2">
                  {category.name}
                </h3>
                <p className="text-slate-500 text-sm mb-4">{category.description}</p>

                {category.enabled && (
                  <div className="flex items-center text-navy font-medium text-sm group">
                    Get Started
                    <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Info Note */}
        <p className="text-center text-slate-400 text-sm mt-8">
          More business categories will be available soon. Stay tuned!
        </p>
      </div>
    </div>
  );
}
