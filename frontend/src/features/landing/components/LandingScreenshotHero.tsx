import { useCallback, useState } from 'react'

import { useNavigate } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'

import { LandingBrowserFrame } from '@/features/landing/components/LandingBrowserFrame'

import { LandingShowcaseTabs } from '@/features/landing/components/LandingShowcaseTabs'

import { HERO_SHOWCASE_TABS } from '@/features/landing/landing-screenshots'

type LandingScreenshotHeroProps = {
  onBookDemo?: () => void
}

export function LandingScreenshotHero({
  onBookDemo,
}: LandingScreenshotHeroProps) {
  const navigate = useNavigate()

  const [activeId, setActiveId] = useState(HERO_SHOWCASE_TABS[0].id)

  const activeTab =
    HERO_SHOWCASE_TABS.find((tab) => tab.id === activeId) ??
    HERO_SHOWCASE_TABS[0]

  const onShowcaseKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const index = HERO_SHOWCASE_TABS.findIndex((tab) => tab.id === activeId)

      if (event.key === 'ArrowRight') {
        event.preventDefault()

        setActiveId(
          HERO_SHOWCASE_TABS[(index + 1) % HERO_SHOWCASE_TABS.length].id
        )
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()

        setActiveId(
          HERO_SHOWCASE_TABS[
            (index - 1 + HERO_SHOWCASE_TABS.length) % HERO_SHOWCASE_TABS.length
          ].id
        )
      }
    },

    [activeId]
  )

  return (
    <section className="border-border bg-background relative overflow-hidden border-b">
      <div
        className="landing-hero-glow pointer-events-none absolute inset-0"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-4 pt-24 pb-14 sm:px-6 sm:pt-28 sm:pb-16 lg:px-8 lg:pb-20">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:gap-12 xl:gap-16">
          <div className="landing-fade-in max-w-xl">
            <h1 className="landing-display text-foreground text-[2.25rem] leading-[1.05] font-semibold tracking-tight text-balance sm:text-5xl lg:text-[3.2rem]">
              The workspace your teams actually run on
            </h1>

            <p className="text-muted-foreground landing-fade-in landing-fade-in-delay-1 mt-5 max-w-[42ch] text-base leading-relaxed sm:text-lg">
              CRM, finance, HR, and operations in one shell. Shared permissions,
              billing, and records. No re-entry between tools.
            </p>

            <div
              className="landing-hero-context landing-fade-in landing-fade-in-delay-1 mt-8"
              aria-live="polite"
            >
              <p className="landing-mono text-muted-foreground text-[11px]">
                {activeTab.label} · {activeTab.caption}
              </p>

              <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                {activeTab.detail}
              </p>
            </div>

            <div className="landing-fade-in landing-fade-in-delay-2 mt-8 flex flex-wrap items-center gap-4">
              <Button
                size="lg"
                onClick={onBookDemo}
                className="landing-btn-primary h-11 rounded-full px-7 text-sm font-medium"
              >
                Book a demo
              </Button>

              <button
                type="button"
                onClick={() => navigate({ to: '/pricing' })}
                className="landing-text-link cursor-pointer text-sm font-medium underline-offset-4 transition-colors hover:underline"
              >
                See pricing
              </button>
            </div>

            <LandingShowcaseTabs
              tabs={HERO_SHOWCASE_TABS}
              activeId={activeId}
              onChange={setActiveId}
              layout="horizontal"
              className="mt-8 lg:hidden"
            />
          </div>

          <div
            className="landing-fade-in landing-fade-in-delay-1 min-w-0"
            onKeyDown={onShowcaseKeyDown}
          >
            <div className="flex flex-col gap-4 sm:flex-row lg:gap-8">
              <LandingShowcaseTabs
                tabs={HERO_SHOWCASE_TABS}
                activeId={activeId}
                onChange={setActiveId}
                layout="vertical"
                className="hidden shrink-0 pt-1 lg:flex"
              />

              <div className="min-w-0 flex-1">
                <p className="landing-mono text-muted-foreground mb-3 hidden text-right text-[10px] lg:block">
                  {HERO_SHOWCASE_TABS.findIndex((t) => t.id === activeId) + 1} /{' '}
                  {HERO_SHOWCASE_TABS.length}
                </p>

                <div className="landing-hero-stack relative pb-4">
                  <div className="landing-hero-stack-back" aria-hidden="true" />

                  <div
                    role="tabpanel"
                    id={`showcase-panel-${activeTab.id}`}
                    aria-labelledby={`showcase-tab-${activeTab.id}`}
                    className="relative"
                  >
                    <LandingBrowserFrame
                      url={activeTab.url}
                      maxContentHeight={540}
                      variant="hero"
                    >
                      <div
                        className="landing-screenshot-swap"
                        key={activeTab.id}
                      >
                        {activeTab.render()}
                      </div>
                    </LandingBrowserFrame>
                  </div>

                  {activeTab.productId && (
                    <button
                      type="button"
                      onClick={() =>
                        navigate({ to: `/products/${activeTab.productId}` })
                      }
                      className="landing-module-chip text-foreground hover:text-foreground absolute right-4 -bottom-3 z-10 cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors"
                    >
                      Open {activeTab.label}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
