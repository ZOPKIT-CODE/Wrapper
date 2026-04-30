/**
 * Dynamic credit purchase with free-form input and preset quick-select.
 */

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  DASHBOARD_PAGE_DESCRIPTION_CLASS,
  DASHBOARD_PAGE_TITLE_CLASS,
} from '@/components/dashboard/DashboardPageHeader'
import type { CreditPricing } from '@/types/pricing'

export interface CreditTopupsTabProps {
  creditPricing: CreditPricing | null
  onCreditPurchase: (creditAmount: number) => void
  isUpgrading: boolean
  currentBalance?: number
}

export function CreditTopupsTab({
  creditPricing,
  onCreditPurchase,
  isUpgrading,
  currentBalance,
}: CreditTopupsTabProps) {
  const [creditAmount, setCreditAmount] = useState<number | ''>(10000)

  const pricing = useMemo(() => {
    if (!creditPricing || !creditAmount) return null
    const total = Number(creditAmount) * creditPricing.unitPrice
    return {
      total,
      formattedTotal: total.toLocaleString('en-US', { style: 'currency', currency: creditPricing.currency }),
      isValid: Number(creditAmount) >= creditPricing.minimumCredits,
      belowMinimum: Number(creditAmount) > 0 && Number(creditAmount) < creditPricing.minimumCredits,
    }
  }, [creditAmount, creditPricing])

  const handleInputChange = (value: string) => {
    const num = value.replace(/[^0-9]/g, '')
    if (num === '') {
      setCreditAmount('')
      return
    }
    setCreditAmount(parseInt(num, 10))
  }

  const handlePurchase = () => {
    if (!pricing?.isValid || !creditAmount) return
    onCreditPurchase(Number(creditAmount))
  }

  if (!creditPricing) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="text-center max-w-2xl mx-auto">
        <h2 className={cn(DASHBOARD_PAGE_TITLE_CLASS, 'mb-4')} style={{ fontFamily: 'var(--zk-display)', letterSpacing: '-0.025em', color: 'var(--zk-ink)', fontWeight: 600 }}>Purchase Credits</h2>
        <p className={cn(DASHBOARD_PAGE_DESCRIPTION_CLASS, 'leading-relaxed')} style={{ fontFamily: 'var(--zk-font)', color: 'var(--zk-muted)', fontSize: 13 }}>
          Buy any amount of credits at{' '}
          <span style={{ fontFamily: 'var(--zk-mono)', fontWeight: 600, color: 'var(--zk-ink)' }}>
            {creditPricing.creditsPerDollar.toLocaleString()} credits per $1.00
          </span>
          . Credits are added instantly after payment.
        </p>
      </div>

      <div className="max-w-lg mx-auto space-y-6">
        {/* Current balance */}
        {currentBalance !== undefined && (
          <div className="text-center p-4 rounded-xl border" style={{ background: 'var(--zk-bg-2)' }}>
            <p style={{ fontFamily: 'var(--zk-font)', fontSize: 13, color: 'var(--zk-muted)' }}>Current Balance</p>
            <p style={{ fontFamily: 'var(--zk-mono)', fontWeight: 600, fontSize: 24, letterSpacing: '-0.04em', color: 'var(--zk-ink)' }}>{currentBalance.toLocaleString()} <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--zk-muted)' }}>credits</span></p>
          </div>
        )}

        {/* Credit amount input */}
        <div className="space-y-2">
          <label htmlFor="credit-amount" style={{ fontFamily: 'var(--zk-font)', fontSize: 13, color: 'var(--zk-ink)', fontWeight: 500 }}>
            How many credits?
          </label>
          <input
            id="credit-amount"
            type="text"
            inputMode="numeric"
            value={creditAmount === '' ? '' : creditAmount.toLocaleString()}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Enter credit amount"
            className={cn(
              'w-full px-4 py-3 text-lg font-semibold text-center rounded-xl border bg-background',
              'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary',
              'transition-colors',
              pricing?.belowMinimum && 'border-destructive focus:ring-destructive/50'
            )}
          />
          {pricing?.belowMinimum && (
            <p className="text-sm text-destructive text-center">
              Minimum purchase: {creditPricing.minimumCredits.toLocaleString()} credits (${creditPricing.minimumCharge.toFixed(2)})
            </p>
          )}
        </div>

        {/* Quick-select presets */}
        <div className="space-y-2">
          <p style={{ fontFamily: 'var(--zk-font)', fontSize: 13, color: 'var(--zk-muted)' }}>Quick select</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {creditPricing.presets.map((preset) => (
              <button
                key={preset}
                onClick={() => setCreditAmount(preset)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium border transition-all',
                  creditAmount === preset
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-background hover:bg-muted border-border hover:border-primary/50'
                )}
              >
                {preset.toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        {/* Price display */}
        {pricing && creditAmount && (
          <div className="p-6 rounded-xl border-2 border-primary/20 bg-primary/5 text-center space-y-1">
            <p style={{ fontFamily: 'var(--zk-font)', fontSize: 13, color: 'var(--zk-muted)' }}>Total</p>
            <p style={{ fontFamily: 'var(--zk-mono)', fontWeight: 600, fontSize: 30, letterSpacing: '-0.04em', color: 'var(--zk-ink)' }}>{pricing.formattedTotal}</p>
            <p style={{ fontFamily: 'var(--zk-font)', fontSize: 13, color: 'var(--zk-muted)' }}>
              <span style={{ fontFamily: 'var(--zk-mono)', fontWeight: 600 }}>{Number(creditAmount).toLocaleString()}</span> credits at <span style={{ fontFamily: 'var(--zk-mono)' }}>${creditPricing.unitPrice}</span>/credit
            </p>
          </div>
        )}

        {/* Purchase button */}
        <button
          onClick={handlePurchase}
          disabled={!pricing?.isValid || isUpgrading}
          className={cn(
            'w-full py-3 px-6 rounded-xl text-base font-semibold transition-all',
            'focus:outline-none focus:ring-2 focus:ring-primary/50',
            pricing?.isValid && !isUpgrading
              ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          )}
        >
          {isUpgrading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
              Processing...
            </span>
          ) : (
            `Purchase ${creditAmount ? Number(creditAmount).toLocaleString() : '0'} Credits`
          )}
        </button>

        <p style={{ fontFamily: 'var(--zk-font)', fontSize: 13, color: 'var(--zk-muted)' }} className="text-center">
          Credits expire with your subscription plan. Payment processed securely via Stripe.
        </p>
      </div>
    </div>
  )
}
