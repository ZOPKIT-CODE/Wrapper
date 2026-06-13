import { useNavigate } from '@tanstack/react-router'
import { ArrowRight, ChevronRight } from 'lucide-react'
import { LandingBrowserFrame } from '@/features/landing/components/LandingBrowserFrame'
import { MODULE_RAIL_ITEMS } from '@/features/landing/landing-screenshots'

export function LandingProductScreenshotRail() {
  const navigate = useNavigate()

  return (
    <section
      id="platform"
      className="landing-section-muted border-border bg-background border-b py-16 sm:py-20"
    >
      <div className="mx-auto mb-10 flex max-w-7xl flex-col gap-4 px-4 sm:flex-row sm:items-end sm:justify-between sm:px-6 lg:px-8">
        <div>
          <p className="landing-section-eyebrow landing-mono text-muted-foreground mb-2 text-[11px] tracking-[0.14em] uppercase">
            {MODULE_RAIL_ITEMS.length} modules
          </p>
          <h2 className="landing-display text-foreground text-2xl font-semibold sm:text-3xl">
            Modules in the suite
          </h2>
          <p className="text-muted-foreground mt-2 max-w-md text-sm">
            Each module runs inside the same workspace. Turn on what you need.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate({ to: '/pricing' })}
          className="landing-text-link landing-mono shrink-0 cursor-pointer text-xs transition-colors"
        >
          Compare plans
        </button>
      </div>

      <div className="relative">
        <div
          className="landing-rail-fade-left pointer-events-none absolute inset-y-0 left-0 z-10 w-8 sm:w-12"
          aria-hidden="true"
        />
        <div
          className="landing-rail-fade-right pointer-events-none absolute inset-y-0 right-0 z-10 w-8 sm:w-12"
          aria-hidden="true"
        />

        <div className="landing-product-rail border-border bg-background flex snap-x snap-mandatory overflow-x-auto border-y">
          {MODULE_RAIL_ITEMS.map((module) => (
            <button
              key={module.id}
              type="button"
              onClick={() => navigate({ to: `/products/${module.id}` })}
              className="group border-border landing-rail-card flex w-[min(88vw,340px)] shrink-0 cursor-pointer snap-start flex-col border-r text-left transition-colors duration-200 sm:w-[360px]"
            >
              <div className="p-4 pb-0">
                <LandingBrowserFrame
                  url={module.url}
                  maxContentHeight={module.maxHeight}
                  className="border-border/60 pointer-events-none shadow-none"
                  contentClassName="bg-background"
                  clipFade
                >
                  {module.render()}
                </LandingBrowserFrame>
              </div>
              <div className="flex flex-1 flex-col justify-end px-6 py-6">
                <h3 className="landing-display text-foreground text-xl font-semibold transition-colors">
                  {module.name}
                </h3>
                <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                  {module.desc}
                </p>
                <span className="text-muted-foreground group-hover:text-foreground mt-4 inline-flex items-center gap-1.5 text-xs font-medium transition-colors">
                  View module
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <p className="text-muted-foreground landing-mono mx-auto mt-4 flex max-w-7xl items-center gap-1.5 px-4 text-[11px] sm:hidden sm:px-6 lg:px-8">
        <ChevronRight className="h-3 w-3" />
        Swipe to browse modules
      </p>
    </section>
  )
}
