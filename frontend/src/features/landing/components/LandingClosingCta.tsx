import { useNavigate } from '@tanstack/react-router'
import { MarketingButton } from '@/components/marketing/MarketingButton'
import { LandingBrowserFrame } from '@/features/landing/components/LandingBrowserFrame'
import { LandingSectionIntro } from '@/features/landing/components/LandingSectionIntro'
import { scrollToLandingContact } from '@/features/landing/landing-scroll'

type LandingClosingCtaProps = {
  onBookDemo?: () => void
}

export function LandingClosingCta({ onBookDemo }: LandingClosingCtaProps) {
  const navigate = useNavigate()
  const handleBookDemo = onBookDemo ?? (() => scrollToLandingContact('smooth'))

  return (
    <section className="landing-closing landing-section border-border bg-background overflow-hidden border-b">
      <div className="landing-section-inner py-20 sm:py-24">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="max-w-lg">
            <LandingSectionIntro
              eyebrow="Next steps"
              title="See the workspace on your data, not a slide deck"
              lead="Walk through CRM, finance, and ops in one session. We map your current stack and show where records can connect first."
              titleClassName="max-w-md"
            />

            <div className="landing-fade-in landing-fade-in-delay-1 mt-8 flex flex-wrap items-center gap-4">
              <MarketingButton type="button" onClick={handleBookDemo}>
                Book a demo
              </MarketingButton>
              <MarketingButton
                type="button"
                marketingVariant="link"
                onClick={() => navigate({ to: '/pricing' })}
              >
                See pricing
              </MarketingButton>
            </div>
          </div>

          <div className="landing-closing-frame landing-fade-in landing-fade-in-delay-2 min-w-0">
            <LandingBrowserFrame
              url="app.zopkit.com"
              maxContentHeight={320}
              variant="hero"
            >
              <img
                src="/fa-dashboard.svg"
                alt=""
                className="block h-auto w-full"
                loading="lazy"
                decoding="async"
              />
            </LandingBrowserFrame>
          </div>
        </div>
      </div>
    </section>
  )
}
