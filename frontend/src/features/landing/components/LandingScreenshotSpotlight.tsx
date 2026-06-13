import { useNavigate } from '@tanstack/react-router'

import { ArrowRight } from 'lucide-react'

import { LandingBrowserFrame } from '@/features/landing/components/LandingBrowserFrame'

import { SPOTLIGHT_FEATURES } from '@/features/landing/landing-screenshots'

export function LandingScreenshotSpotlight() {
  const navigate = useNavigate()

  return (
    <section className="border-border bg-background border-b">
      <div className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 sm:pt-20 lg:px-8">
        <h2 className="landing-display text-foreground max-w-xl text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          Inside the product
        </h2>
      </div>

      <div className="mx-auto max-w-7xl space-y-20 px-4 pt-10 pb-16 sm:space-y-28 sm:px-6 sm:pt-12 sm:pb-24 lg:px-8">
        {SPOTLIGHT_FEATURES.map((feature, index) => {
          const reversed = index % 2 === 1

          return (
            <article
              key={feature.id}
              className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ${
                reversed ? 'lg:[&>*:first-child]:order-2' : ''
              }`}
            >
              <div className={reversed ? 'lg:pl-4' : 'lg:pr-4'}>
                <LandingBrowserFrame
                  url={feature.url}
                  maxContentHeight={440}
                  variant="hero"
                >
                  {feature.render()}
                </LandingBrowserFrame>
              </div>

              <div className="max-w-lg">
                <h3 className="landing-display text-foreground text-2xl leading-snug font-semibold tracking-tight text-balance sm:text-3xl">
                  {feature.title}
                </h3>

                <p className="text-muted-foreground mt-4 leading-relaxed">
                  {feature.body}
                </p>

                <ul className="mt-6 space-y-2">
                  {feature.bullets.map((bullet) => (
                    <li
                      key={bullet}
                      className="text-muted-foreground flex gap-3 text-sm leading-relaxed"
                    >
                      <span className="landing-spotlight-bullet landing-mono mt-0.5 shrink-0 text-[10px]">
                        —
                      </span>

                      {bullet}
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() =>
                    navigate({ to: `/products/${feature.productId}` })
                  }
                  className="landing-text-link group mt-8 inline-flex cursor-pointer items-center gap-2 text-sm font-medium transition-colors"
                >
                  Explore module
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
