/**
 * Billing plans and credit top-up constants.
 * Fallback when API is unavailable; must match backend plan ids: starter, professional, enterprise.
 * Subscription billing is annual only (Stripe/API). UI may show monthly equivalent.
 */

import type { ApplicationPlan, CreditTopup } from '@/types/pricing'

export const applicationPlansFallback: ApplicationPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Essential tools for small teams',
    annualPriceUsd: 120,
    annualPriceInr: 9999,
    currency: 'USD',
    freeCredits: 60000,
    features: ['CRM tools', 'User Management', 'Basic permissions', 'Email support']
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'Comprehensive tools for growing businesses',
    annualPriceUsd: 240,
    annualPriceInr: 19999,
    currency: 'USD',
    freeCredits: 300000,
    features: [
      'All Starter features',
      'CRM & HR tools',
      'Advanced permissions',
      'Priority support',
      'Affiliate management'
    ],
    popular: true
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Complete solution with all features',
    annualPriceUsd: 360,
    annualPriceInr: 29999,
    currency: 'USD',
    freeCredits: 1200000,
    features: [
      'All Professional features',
      'Unlimited users',
      'White-label options',
      'Dedicated support',
      'All integrations'
    ]
  }
]

export const creditTopups: CreditTopup[] = [
  {
    id: 'credits_5000',
    name: '5,000 Credits',
    description: 'Perfect for light usage',
    credits: 5000,
    price: 5,
    currency: 'USD',
    features: ['5,000 credits', 'Never expires', 'Use anytime', 'No monthly fees']
  },
  {
    id: 'credits_10000',
    name: '10,000 Credits',
    description: 'Ideal for regular operations',
    credits: 10000,
    price: 10,
    currency: 'USD',
    features: ['10,000 credits', 'Never expires', 'Best value', 'Priority support'],
    recommended: true
  },
  {
    id: 'credits_15000',
    name: '15,000 Credits',
    description: 'For high-volume operations',
    credits: 15000,
    price: 15,
    currency: 'USD',
    features: ['15,000 credits', 'Never expires', 'Maximum value', 'Premium support']
  }
]
