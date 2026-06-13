import { Link } from '@tanstack/react-router'
import { LandingScrollReveal } from '@/features/landing/components/LandingScrollReveal'

export function LandingClosingCta() {
  return (
    <section className="landing-closing landing-section landing-section-tint border-border border-b py-12 sm:py-14">
      <div className="landing-section-inner">
        <LandingScrollReveal>
          <div className="landing-closing-strip flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <p className="landing-section-eyebrow">Still evaluating?</p>
              <p className="landing-display text-foreground mt-2 text-lg font-semibold sm:text-xl">
                Compare plans or return to the form above when you are ready to
                talk.
              </p>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                Most teams book after reviewing modules and pricing. No need to
                submit the form twice.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-4 sm:justify-end">
              <Link
                to="/pricing"
                className="landing-btn-primary landing-cta inline-flex h-11 items-center rounded-full px-7 text-sm font-medium"
              >
                See pricing
              </Link>
              <a
                href="#contact"
                className="landing-text-link text-sm font-medium underline-offset-4 transition-colors hover:underline"
              >
                Back to contact form
              </a>
            </div>
          </div>
        </LandingScrollReveal>
      </div>
    </section>
  )
}
