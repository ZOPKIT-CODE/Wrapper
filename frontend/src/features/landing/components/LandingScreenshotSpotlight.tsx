import { useNavigate } from '@tanstack/react-router';

import { ArrowRight } from 'lucide-react';

import { LandingBrowserFrame } from '@/features/landing/components/LandingBrowserFrame';

import { SPOTLIGHT_FEATURES } from '@/features/landing/landing-screenshots';



export function LandingScreenshotSpotlight() {

  const navigate = useNavigate();



  return (

    <section className="border-b border-border bg-background">

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20">

        <h2 className="landing-display text-2xl sm:text-3xl font-semibold text-foreground max-w-xl text-balance tracking-tight">

          Inside the product

        </h2>

      </div>



      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 sm:pb-24 pt-10 sm:pt-12 space-y-20 sm:space-y-28">

        {SPOTLIGHT_FEATURES.map((feature, index) => {

          const reversed = index % 2 === 1;

          return (

            <article

              key={feature.id}

              className={`grid lg:grid-cols-2 gap-10 lg:gap-16 items-center ${

                reversed ? 'lg:[&>*:first-child]:order-2' : ''

              }`}

            >

              <div className={reversed ? 'lg:pl-4' : 'lg:pr-4'}>

                <LandingBrowserFrame url={feature.url} maxContentHeight={440} variant="hero">

                  {feature.render()}

                </LandingBrowserFrame>

              </div>



              <div className="max-w-lg">

                <h3 className="landing-display text-2xl sm:text-3xl font-semibold text-foreground leading-snug text-balance tracking-tight">

                  {feature.title}

                </h3>

                <p className="mt-4 text-muted-foreground leading-relaxed">{feature.body}</p>

                <ul className="mt-6 space-y-2">

                  {feature.bullets.map((bullet) => (

                    <li

                      key={bullet}

                      className="flex gap-3 text-sm text-muted-foreground leading-relaxed"

                    >

                      <span className="landing-spotlight-bullet landing-mono text-[10px] mt-0.5 shrink-0">

                        —

                      </span>

                      {bullet}

                    </li>

                  ))}

                </ul>

                <button

                  type="button"

                  onClick={() => navigate({ to: `/products/${feature.productId}` })}

                  className="landing-text-link mt-8 inline-flex items-center gap-2 text-sm font-medium transition-colors cursor-pointer group"

                >

                  Explore module

                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />

                </button>

              </div>

            </article>

          );

        })}

      </div>

    </section>

  );

}

