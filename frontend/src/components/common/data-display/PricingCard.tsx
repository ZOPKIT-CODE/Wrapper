import React from 'react';
import type { PricingCardProps } from '@/types/pricing';
import { PearlButton } from '@/components/ui/pearl-button';
import { cn } from '@/lib/utils';
import { formatMonthlyInrDisplay, formatMonthlyUsdDisplay } from '@/features/billing/utils/planPriceDisplay';

const PricingCard: React.FC<PricingCardProps> = ({
  name,
  description,
  credits,
  price,
  currency: _currency,
  features,
  validityMonths: _validityMonths,
  recommended = false,
  onPurchase,
  isLoading = false,
  annualPriceUsd,
  annualPriceInr,
  applicationDisplayCurrency = 'usd',
  freeCredits,
  type = 'topup',
  isPremium = false
}) => {
  const isTopupCard = type === 'topup';
  const showInr =
    applicationDisplayCurrency === 'inr' && (annualPriceInr ?? 0) > 0;

  return (
    <div className="relative flex justify-center items-center">
      {recommended && !isTopupCard && (
        <div className="absolute top-[-12px] left-1/2 -translate-x-1/2 z-20">
          <span className="bg-[#1B2E5A] text-white px-4 py-1.5 rounded-full text-[10px] font-bold shadow-md inline-block whitespace-nowrap uppercase tracking-wider">
            Most Popular
          </span>
        </div>
      )}

      <div className={cn(
        "relative flex flex-col gap-5 justify-between py-9 px-6 w-full max-w-[380px] min-h-[580px] mx-auto rounded-[2rem] transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] z-10 overflow-hidden cursor-pointer",
        isPremium
          ? "bg-[#1B2E5A]/5 border border-[#1B2E5A]/30 shadow-[0_20px_50px_-20px_rgba(27,46,90,0.2)] hover:scale-[1.03] hover:shadow-[0_40px_80px_-30px_rgba(27,46,90,0.3)]"
          : "bg-white border border-slate-200/60 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] hover:-translate-y-1"
      )}>

        {recommended && (
          <div className="absolute w-[150px] h-[150px] -top-[10px] -right-[10px] flex items-center justify-center z-20 pointer-events-none overflow-hidden">
            <div className="absolute w-[150%] h-[34px] bg-[#1B2E5A] rotate-45 -translate-y-4 flex items-center justify-center text-white font-black text-[10px] tracking-[0.2em] shadow-lg uppercase">
              PREMIUM
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col gap-5 min-h-0">
          <div className="space-y-1.5 flex-shrink-0">
            <span className={cn(
              "text-lg font-extrabold tracking-tight block",
              isPremium ? "text-[#1B2E5A]" : "text-[#1B2E5A]"
            )}>
              {name}
            </span>
            <p className={cn(
              "text-[0.75rem] font-medium leading-relaxed max-w-[90%]",
              isPremium ? "text-[#1B2E5A]/70" : "text-slate-500"
            )}>
              {description}
            </p>
          </div>

          <div className={cn(
            "w-full h-px",
            isPremium ? "bg-[#1B2E5A]/15" : "bg-slate-100"
          )} />

          <div className="text-center py-2 space-y-2 flex-shrink-0">
            {type === 'application' ? (
              <>
                <div className="flex flex-col items-center gap-0.5">
                  <span className={cn(
                    "text-3xl font-black tracking-tight",
                    isPremium ? "text-[#1B2E5A]" : "text-slate-900"
                  )}>
                    {showInr
                      ? formatMonthlyInrDisplay(annualPriceInr ?? 0)
                      : formatMonthlyUsdDisplay(annualPriceUsd ?? 0)}
                  </span>
                  <span className={cn(
                    "text-xs font-semibold uppercase tracking-wide",
                    isPremium ? "text-[#1B2E5A]/60" : "text-slate-400"
                  )}>
                    {showInr ? 'per month (INR)' : 'per month (USD)'}
                  </span>
                </div>
                <div className={cn(
                  "text-[0.875rem] font-bold pt-1",
                  isPremium ? "text-[#1B2E5A]" : "text-slate-700"
                )}>
                  {freeCredits?.toLocaleString()} credits / year included
                </div>
                <div className={cn(
                  "text-[0.7rem] font-medium",
                  isPremium ? "text-[#1B2E5A]/50" : "text-slate-400"
                )}>
                  Billed annually
                </div>
              </>
            ) : (
              <>
                <div className="flex items-baseline justify-center gap-1">
                  <span className={cn(
                    "text-4xl font-black tracking-tight",
                    isPremium ? "text-[#1B2E5A]" : "text-slate-900"
                  )}>${price}</span>
                  <span className={cn(
                    "text-sm font-semibold",
                    isPremium ? "text-[#1B2E5A]/60" : "text-slate-400"
                  )}>one-time</span>
                </div>
                <div className={cn(
                  "text-[0.875rem] font-bold",
                  isPremium ? "text-[#1B2E5A]" : "text-slate-700"
                )}>
                  {credits?.toLocaleString()} Credits
                </div>
                <div className={cn(
                  "text-[0.7rem] font-medium",
                  isPremium ? "text-[#1B2E5A]/50" : "text-slate-400"
                )}>
                  Credits expire with plan
                </div>
              </>
            )}
          </div>

          <div className={cn(
            "w-full h-px",
            isPremium ? "bg-[#1B2E5A]/15" : "bg-slate-100"
          )} />

          <ul className="flex flex-col gap-2.5 list-none p-0 m-0 flex-1 min-h-0 overflow-y-auto pr-1">
            {features.map((feature, index) => (
              <li key={index} className="flex items-center gap-3">
                <div className={cn(
                  "flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center shadow-sm",
                  isPremium ? "bg-[#1B2E5A] shadow-[#1B2E5A]/20" : "bg-slate-100 shadow-slate-200/50"
                )}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className={cn(
                    "w-3.5 h-3.5",
                    isPremium ? "text-white" : "text-slate-700"
                  )}>
                    <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className={cn(
                  "text-[0.8125rem] font-medium",
                  isPremium ? "text-[#1B2E5A]" : "text-slate-600"
                )}>
                  {feature}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 flex-shrink-0">
          <PearlButton
            onClick={onPurchase}
            disabled={isLoading}
            variant="primary"
            color="blue"
            size="md"
            className={`w-full shadow-lg ${isPremium ? '' : '!bg-[#1B2E5A] hover:!bg-[#162447]'}`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </span>
            ) : `Purchase ${name}`}
          </PearlButton>
        </div>
      </div>
    </div>
  );
};

export default PricingCard;
