import { useNavigate } from '@tanstack/react-router';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { LandingBrowserFrame } from '@/features/landing/components/LandingBrowserFrame';
import { MODULE_RAIL_ITEMS } from '@/features/landing/landing-screenshots';

export function LandingProductScreenshotRail() {
  const navigate = useNavigate();

  return (
    <section id="platform" className="landing-section-muted py-16 sm:py-20 border-b border-border bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
            <p className="landing-section-eyebrow landing-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground mb-2">
            {MODULE_RAIL_ITEMS.length} modules
          </p>
          <h2 className="landing-display text-2xl sm:text-3xl font-semibold text-foreground">
            Modules in the suite
          </h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-md">
            Each module runs inside the same workspace. Turn on what you need.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate({ to: '/pricing' })}
          className="landing-text-link landing-mono text-xs transition-colors cursor-pointer shrink-0"
        >
          Compare plans
        </button>
      </div>

      <div className="relative">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-8 sm:w-12 z-10 landing-rail-fade-left"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-8 sm:w-12 z-10 landing-rail-fade-right"
          aria-hidden="true"
        />

        <div className="landing-product-rail flex overflow-x-auto snap-x snap-mandatory border-y border-border bg-background">
          {MODULE_RAIL_ITEMS.map((module) => (
            <button
              key={module.id}
              type="button"
              onClick={() => navigate({ to: `/products/${module.id}` })}
              className="group snap-start shrink-0 w-[min(88vw,340px)] sm:w-[360px] text-left border-r border-border transition-colors duration-200 cursor-pointer flex flex-col landing-rail-card"
            >
              <div className="p-4 pb-0">
                <LandingBrowserFrame
                  url={module.url}
                  maxContentHeight={module.maxHeight}
                className="shadow-none border-border/60 pointer-events-none"
                contentClassName="bg-background"
                  clipFade
                >
                  {module.render()}
                </LandingBrowserFrame>
              </div>
              <div className="px-6 py-6 flex-1 flex flex-col justify-end">
                <h3 className="landing-display text-xl font-semibold text-foreground transition-colors">
                  {module.name}
                </h3>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{module.desc}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  View module
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <p className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 flex items-center gap-1.5 text-[11px] text-muted-foreground landing-mono sm:hidden">
        <ChevronRight className="w-3 h-3" />
        Swipe to browse modules
      </p>
    </section>
  );
}
