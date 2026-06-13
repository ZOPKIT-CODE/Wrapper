import * as React from 'react'
import { Button, type ButtonProps } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Marketing CTA taxonomy (Phase 0):
 * - primary: filled pill on light marketing surfaces (`landing-btn-primary`)
 * - secondary: outline pill for alternate actions
 * - link: text link for tertiary actions (pricing, learn more)
 */
export type MarketingButtonVariant = 'primary' | 'secondary' | 'link'

export type MarketingButtonProps = ButtonProps & {
  marketingVariant?: MarketingButtonVariant
}

const marketingVariantClasses: Record<MarketingButtonVariant, string> = {
  primary: 'landing-btn-primary rounded-full text-sm font-medium',
  secondary:
    'rounded-full border border-border bg-background text-sm font-medium hover:bg-muted',
  link: 'landing-text-link h-auto p-0 text-sm font-medium underline-offset-4 hover:underline',
}

export const MarketingButton = React.forwardRef<
  HTMLButtonElement,
  MarketingButtonProps
>(function MarketingButton(
  { marketingVariant = 'primary', className, variant, size, ...props },
  ref
) {
  const isLink = marketingVariant === 'link'

  return (
    <Button
      ref={ref}
      variant={isLink ? 'link' : (variant ?? 'default')}
      size={isLink ? undefined : (size ?? 'lg')}
      className={cn(
        marketingVariantClasses[marketingVariant],
        marketingVariant === 'primary' && 'h-11 px-7',
        marketingVariant === 'secondary' && 'h-11 px-7',
        className
      )}
      {...props}
    />
  )
})
