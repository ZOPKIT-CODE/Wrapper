// Pricing-related type definitions

export type CheckoutCurrency = 'usd' | 'inr';

export interface ApplicationPlan {
  id: string;
  name: string;
  description: string;
  /** Annual price in USD */
  annualPriceUsd: number;
  /** Annual price in INR (whole rupees) */
  annualPriceInr: number;
  currency: string;
  features: string[];
  freeCredits: number;
  recommended?: boolean;
  popular?: boolean;
}

export interface CreditTopup {
  id: string;
  name: string;
  description: string;
  credits: number;
  price: number;
  currency: string;
  features: string[];
  recommended?: boolean;
}

export interface PricingCardProps {
  name: string;
  description: string;
  credits?: number;
  price?: number;
  currency: string;
  features: string[];
  validityMonths?: number;
  recommended?: boolean;
  onPurchase?: () => void;
  isLoading?: boolean;
  annualPriceUsd?: number;
  annualPriceInr?: number;
  /** Which currency to show for application plans (checkout uses the same selection). */
  applicationDisplayCurrency?: CheckoutCurrency;
  freeCredits?: number;
  type?: 'application' | 'topup';
  isPremium?: boolean;
}
