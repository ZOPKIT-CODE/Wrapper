import React, { useEffect } from 'react'
import { LandingFooter } from '@/components/layout/LandingFooter'
import { MarketingNavbar } from '@/components/layout/MarketingNavbar'
import { MarketingPageShell } from '@/components/layout/MarketingPageShell'
import { useMarketingContactCta } from '@/features/landing/useMarketingContactCta'

interface LegalPageLayoutProps {
  title: string
  lastUpdated?: string
  children: React.ReactNode
  wide?: boolean
  contained?: boolean
  docIntro?: React.ReactNode
  tableOfContents?: { id: string; label: string }[]
  hideStartTrialCta?: boolean
}

export function LegalPageLayout({
  title,
  lastUpdated = '',
  children,
  wide = false,
  contained = true,
  docIntro,
  tableOfContents,
}: LegalPageLayoutProps) {
  const scrollToContact = useMarketingContactCta()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  return (
    <MarketingPageShell>
      <MarketingNavbar minimal onBookDemo={scrollToContact} />

      <main
        className={`relative mx-auto px-4 pt-28 pb-16 sm:px-6 sm:pt-32 lg:px-8 ${wide ? 'max-w-6xl' : 'max-w-4xl'}`}
      >
        {contained ? (
          <div className="border-border border-b pb-12 md:pb-16">
            <h1 className="landing-display text-foreground text-3xl font-semibold tracking-tight md:text-4xl">
              {title}
            </h1>
            {lastUpdated && (
              <p className="landing-mono text-muted-foreground mt-3 text-xs">
                Last updated: {lastUpdated}
              </p>
            )}
            {docIntro && (
              <div className="text-muted-foreground border-border mt-6 max-w-3xl border-l pl-4 text-[15px] leading-relaxed">
                {docIntro}
              </div>
            )}
            {tableOfContents && tableOfContents.length > 0 && (
              <nav
                aria-label="Table of contents"
                className="border-border mt-10 border-t pt-8"
              >
                <p className="landing-mono text-muted-foreground mb-3 text-[11px] tracking-[0.12em] uppercase">
                  On this page
                </p>
                <ol className="text-muted-foreground space-y-2 text-sm">
                  {tableOfContents.map((item) => (
                    <li key={item.id}>
                      <a
                        href={`#${item.id}`}
                        className="landing-text-link hover:text-foreground underline-offset-4 transition-colors hover:underline"
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            )}
            <div className="mt-10 flex max-w-none flex-col gap-0">
              {children}
            </div>
          </div>
        ) : (
          <>{children}</>
        )}
      </main>

      <LandingFooter marketing />
    </MarketingPageShell>
  )
}
