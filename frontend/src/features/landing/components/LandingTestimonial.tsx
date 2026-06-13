import type { Testimonial } from '@/types'
import { LandingScrollReveal } from '@/features/landing/components/LandingScrollReveal'
import { LandingSectionIntro } from '@/features/landing/components/LandingSectionIntro'

type LandingTestimonialProps = {
  quotes: Testimonial[]
}

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function LandingTestimonial({ quotes }: LandingTestimonialProps) {
  return (
    <section className="landing-section landing-section-muted border-border border-b py-20 sm:py-24">
      <div className="landing-section-inner">
        <LandingScrollReveal className="mb-10 sm:mb-12">
          <LandingSectionIntro
            eyebrow="Proof"
            title="What teams say after consolidating their stack"
            lead="Operators and finance leads who moved off point tools and into one shared workspace."
            titleClassName="max-w-lg"
            animate={false}
          />
        </LandingScrollReveal>

        <div className="grid gap-10 lg:grid-cols-2 lg:gap-12">
          {quotes.map((quote, i) => (
            <LandingScrollReveal key={quote.author} delay={i * 0.08}>
              <figure className="landing-testimonial-card border-border bg-background h-full rounded-xl border p-6 sm:p-8">
                <blockquote className="landing-testimonial-accent border-border relative max-w-none border-l pl-5 sm:pl-6">
                  <p className="landing-display text-foreground text-lg leading-snug font-medium tracking-tight sm:text-xl">
                    &ldquo;{quote.quote}&rdquo;
                  </p>
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  <div
                    className="landing-avatar text-muted-foreground landing-mono flex h-9 w-9 items-center justify-center rounded-md border text-[10px] font-medium"
                    aria-hidden="true"
                  >
                    {initials(quote.author)}
                  </div>
                  <div>
                    <p className="text-foreground text-sm font-medium">
                      {quote.author}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {quote.role}, {quote.company}
                    </p>
                  </div>
                </figcaption>
              </figure>
            </LandingScrollReveal>
          ))}
        </div>
      </div>
    </section>
  )
}
