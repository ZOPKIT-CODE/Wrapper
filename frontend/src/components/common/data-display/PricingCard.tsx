import React from 'react'
import type { PricingCardProps } from '@/types/pricing'
import { PearlButton } from '@/components/ui/pearl-button'
import { cn } from '@/lib/utils'
import {
  formatMonthlyInrDisplay,
  formatMonthlyUsdDisplay,
} from '@/features/billing/utils/planPriceDisplay'

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
  isPremium = false,
}) => {
  const isTopupCard = type === 'topup'
  const showInr =
    applicationDisplayCurrency === 'inr' && (annualPriceInr ?? 0) > 0

  return (
    <div className="relative flex items-center justify-center">
      {recommended && !isTopupCard && (
        <div className="absolute top-[-12px] left-1/2 z-20 -translate-x-1/2">
          <span className="bg-primary text-primary-foreground inline-block rounded-full px-4 py-1.5 text-[10px] font-bold tracking-wider whitespace-nowrap uppercase shadow-md">
            Most Popular
          </span>
        </div>
      )}

      <div
        className={cn(
          'relative z-10 mx-auto flex min-h-[580px] w-full max-w-[380px] cursor-pointer flex-col justify-between gap-5 overflow-hidden rounded-[2rem] px-6 py-9 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
          isPremium
            ? 'bg-primary/5 border-primary/30 border shadow-[0_20px_50px_-20px_rgba(27,46,90,0.2)] hover:scale-[1.03] hover:shadow-[0_40px_80px_-30px_rgba(27,46,90,0.3)]'
            : 'border border-slate-200/60 bg-white shadow-[0_10px_30px_-10px_rgba(0,0,0,0.05)] hover:-translate-y-1 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)]'
        )}
      >
        {recommended && (
          <div className="pointer-events-none absolute -top-[10px] -right-[10px] z-20 flex h-[150px] w-[150px] items-center justify-center overflow-hidden">
            <div className="bg-primary absolute flex h-[34px] w-[150%] -translate-y-4 rotate-45 items-center justify-center text-[10px] font-black tracking-[0.2em] text-white uppercase shadow-lg">
              PREMIUM
            </div>
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col gap-5">
          <div className="flex-shrink-0 space-y-1.5">
            <span
              className={cn(
                'block text-lg font-extrabold tracking-tight',
                isPremium ? 'text-primary' : 'text-primary'
              )}
            >
              {name}
            </span>
            <p
              className={cn(
                'max-w-[90%] text-[0.75rem] leading-relaxed font-medium',
                isPremium ? 'text-primary/70' : 'text-slate-500'
              )}
            >
              {description}
            </p>
          </div>

          <div
            className={cn(
              'h-px w-full',
              isPremium ? 'bg-primary/15' : 'bg-slate-100'
            )}
          />

          <div className="flex-shrink-0 space-y-2 py-2 text-center">
            {type === 'application' ? (
              <>
                <div className="flex flex-col items-center gap-0.5">
                  <span
                    className={cn(
                      'text-3xl font-black tracking-tight',
                      isPremium ? 'text-primary' : 'text-slate-900'
                    )}
                  >
                    {showInr
                      ? formatMonthlyInrDisplay(annualPriceInr ?? 0)
                      : formatMonthlyUsdDisplay(annualPriceUsd ?? 0)}
                  </span>
                  <span
                    className={cn(
                      'text-xs font-semibold tracking-wide uppercase',
                      isPremium ? 'text-primary/60' : 'text-slate-400'
                    )}
                  >
                    {showInr ? 'per month (INR)' : 'per month (USD)'}
                  </span>
                </div>
                <div
                  className={cn(
                    'pt-1 text-[0.875rem] font-bold',
                    isPremium ? 'text-primary' : 'text-slate-700'
                  )}
                >
                  {freeCredits?.toLocaleString()} credits / year included
                </div>
                <div
                  className={cn(
                    'text-[0.7rem] font-medium',
                    isPremium ? 'text-primary/50' : 'text-slate-400'
                  )}
                >
                  Billed annually
                </div>
              </>
            ) : (
              <>
                <div className="flex items-baseline justify-center gap-1">
                  <span
                    className={cn(
                      'text-4xl font-black tracking-tight',
                      isPremium ? 'text-primary' : 'text-slate-900'
                    )}
                  >
                    ${price}
                  </span>
                  <span
                    className={cn(
                      'text-sm font-semibold',
                      isPremium ? 'text-primary/60' : 'text-slate-400'
                    )}
                  >
                    one-time
                  </span>
                </div>
                <div
                  className={cn(
                    'text-[0.875rem] font-bold',
                    isPremium ? 'text-primary' : 'text-slate-700'
                  )}
                >
                  {credits?.toLocaleString()} Credits
                </div>
                <div
                  className={cn(
                    'text-[0.7rem] font-medium',
                    isPremium ? 'text-primary/50' : 'text-slate-400'
                  )}
                >
                  Credits expire with plan
                </div>
              </>
            )}
          </div>

          <div
            className={cn(
              'h-px w-full',
              isPremium ? 'bg-primary/15' : 'bg-slate-100'
            )}
          />

          <ul className="m-0 flex min-h-0 flex-1 list-none flex-col gap-2.5 overflow-y-auto p-0 pr-1">
            {features.map((feature, index) => (
              <li key={index} className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full shadow-sm',
                    isPremium
                      ? 'bg-primary shadow-primary/20'
                      : 'bg-slate-100 shadow-slate-200/50'
                  )}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    className={cn(
                      'h-3.5 w-3.5',
                      isPremium ? 'text-white' : 'text-slate-700'
                    )}
                  >
                    <path
                      fillRule="evenodd"
                      d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <span
                  className={cn(
                    'text-[0.8125rem] font-medium',
                    isPremium ? 'text-primary' : 'text-slate-600'
                  )}
                >
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
            className={`w-full shadow-lg ${isPremium ? '' : '!bg-primary hover:!bg-primary-hover'}`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Processing...
              </span>
            ) : (
              `Purchase ${name}`
            )}
          </PearlButton>
        </div>
      </div>
    </div>
  )
}

export default PricingCard
