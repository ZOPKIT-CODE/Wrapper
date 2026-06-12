import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import { LandingFooter } from '@/components/layout/LandingFooter'
import { MarketingNavbar } from '@/components/layout/MarketingNavbar'
import { MarketingPageShell } from '@/components/layout/MarketingPageShell'
import { useMarketingContactCta } from '@/features/landing/useMarketingContactCta'

type MarketingContentLayoutProps = {
  children: ReactNode
  className?: string
  mainClassName?: string
  showFooter?: boolean
  scrollToTopOnMount?: boolean
}

/** Shared marketing shell for product, industry, and similar content pages. */
export function MarketingContentLayout({
  children,
  className,
  mainClassName,
  showFooter = true,
  scrollToTopOnMount = true,
}: MarketingContentLayoutProps) {
  const scrollToContact = useMarketingContactCta()

  useEffect(() => {
    if (scrollToTopOnMount) {
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
  }, [scrollToTopOnMount])

  return (
    <MarketingPageShell className={className}>
      <MarketingNavbar minimal onBookDemo={scrollToContact} />
      <main className={cn('w-full', mainClassName)}>{children}</main>
      {showFooter ? <LandingFooter marketing /> : null}
    </MarketingPageShell>
  )
}
