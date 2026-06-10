import { useCallback, useState } from 'react';

import { useNavigate } from '@tanstack/react-router';

import { Button } from '@/components/ui/button';

import { LandingBrowserFrame } from '@/features/landing/components/LandingBrowserFrame';

import { LandingShowcaseTabs } from '@/features/landing/components/LandingShowcaseTabs';

import { HERO_SHOWCASE_TABS } from '@/features/landing/landing-screenshots';



type LandingScreenshotHeroProps = {

  onBookDemo?: () => void;

};



export function LandingScreenshotHero({ onBookDemo }: LandingScreenshotHeroProps) {

  const navigate = useNavigate();

  const [activeId, setActiveId] = useState(HERO_SHOWCASE_TABS[0].id);

  const activeTab =

    HERO_SHOWCASE_TABS.find((tab) => tab.id === activeId) ?? HERO_SHOWCASE_TABS[0];



  const onShowcaseKeyDown = useCallback(

    (event: React.KeyboardEvent) => {

      const index = HERO_SHOWCASE_TABS.findIndex((tab) => tab.id === activeId);

      if (event.key === 'ArrowRight') {

        event.preventDefault();

        setActiveId(HERO_SHOWCASE_TABS[(index + 1) % HERO_SHOWCASE_TABS.length].id);

      }

      if (event.key === 'ArrowLeft') {

        event.preventDefault();

        setActiveId(

          HERO_SHOWCASE_TABS[(index - 1 + HERO_SHOWCASE_TABS.length) % HERO_SHOWCASE_TABS.length].id

        );

      }

    },

    [activeId]

  );



  return (

    <section className="relative border-b border-border bg-background overflow-hidden">

      <div className="landing-hero-glow absolute inset-0 pointer-events-none" aria-hidden="true" />



      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 pb-14 sm:pb-16 lg:pb-20">

        <div className="grid lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] gap-10 lg:gap-12 xl:gap-16 items-center">

          <div className="max-w-xl landing-fade-in">

            <h1 className="landing-display text-[2.25rem] sm:text-5xl lg:text-[3.2rem] font-semibold leading-[1.05] text-balance text-foreground tracking-tight">

              The workspace your teams actually run on

            </h1>

            <p className="mt-5 text-base sm:text-lg leading-relaxed text-muted-foreground max-w-[42ch] landing-fade-in landing-fade-in-delay-1">

              CRM, finance, HR, and operations in one shell. Shared permissions, billing, and records. No re-entry between tools.

            </p>



            <div

              className="mt-8 landing-hero-context landing-fade-in landing-fade-in-delay-1"

              aria-live="polite"

            >

              <p className="landing-mono text-[11px] text-muted-foreground">

                {activeTab.label} · {activeTab.caption}

              </p>

              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{activeTab.detail}</p>

            </div>



            <div className="mt-8 flex flex-wrap items-center gap-4 landing-fade-in landing-fade-in-delay-2">

              <Button

                size="lg"

                onClick={onBookDemo}

                className="landing-btn-primary rounded-full h-11 px-7 text-sm font-medium"

              >

                Book a demo

              </Button>

              <button

                type="button"

                onClick={() => navigate({ to: '/pricing' })}

                className="landing-text-link text-sm font-medium transition-colors cursor-pointer underline-offset-4 hover:underline"

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

            <div className="flex flex-col sm:flex-row gap-4 lg:gap-8">

              <LandingShowcaseTabs

                tabs={HERO_SHOWCASE_TABS}

                activeId={activeId}

                onChange={setActiveId}

                layout="vertical"

                className="hidden lg:flex shrink-0 pt-1"

              />



              <div className="flex-1 min-w-0">

                <p className="hidden lg:block landing-mono text-[10px] text-muted-foreground mb-3 text-right">

                  {HERO_SHOWCASE_TABS.findIndex((t) => t.id === activeId) + 1} / {HERO_SHOWCASE_TABS.length}

                </p>



                <div className="relative landing-hero-stack pb-4">

                  <div className="landing-hero-stack-back" aria-hidden="true" />



                  <div

                    role="tabpanel"

                    id={`showcase-panel-${activeTab.id}`}

                    aria-labelledby={`showcase-tab-${activeTab.id}`}

                    className="relative"

                  >

                    <LandingBrowserFrame url={activeTab.url} maxContentHeight={540} variant="hero">

                      <div className="landing-screenshot-swap" key={activeTab.id}>

                        {activeTab.render()}

                      </div>

                    </LandingBrowserFrame>

                  </div>



                  {activeTab.productId && (

                    <button

                      type="button"

                      onClick={() => navigate({ to: `/products/${activeTab.productId}` })}

                      className="landing-module-chip absolute -bottom-3 right-4 z-10 rounded-full border px-3 py-1 text-xs font-medium text-foreground hover:text-foreground transition-colors cursor-pointer"

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

  );

}

