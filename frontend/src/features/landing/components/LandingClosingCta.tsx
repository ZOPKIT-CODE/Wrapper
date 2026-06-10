import { useNavigate } from '@tanstack/react-router';

import { Button } from '@/components/ui/button';

import { LandingBrowserFrame } from '@/features/landing/components/LandingBrowserFrame';



type LandingClosingCtaProps = {

  onBookDemo?: () => void;

};



export function LandingClosingCta({ onBookDemo }: LandingClosingCtaProps) {

  const navigate = useNavigate();



  return (

    <section className="landing-closing border-b border-border overflow-hidden bg-background">

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">

        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">

          <div className="max-w-lg">

            <h2 className="landing-display text-2xl sm:text-3xl font-semibold text-foreground leading-snug text-balance tracking-tight">

              See the workspace on your data, not a slide deck

            </h2>

            <p className="mt-4 text-sm sm:text-base text-muted-foreground leading-relaxed max-w-md">

              Walk through CRM, finance, and ops in one session. We map your current stack and show where records can connect first.

            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">

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

          </div>



          <div className="min-w-0 landing-closing-frame">

            <LandingBrowserFrame url="app.zopkit.com" maxContentHeight={260} variant="hero">

              <img

                src="/fa-dashboard.svg"

                alt=""

                className="w-full h-auto block"

                loading="lazy"

                decoding="async"

              />

            </LandingBrowserFrame>

          </div>

        </div>

      </div>

    </section>

  );

}

