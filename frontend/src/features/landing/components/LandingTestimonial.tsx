import type { Testimonial } from '@/types'

type LandingTestimonialProps = {
  quote: Testimonial
}

function initials(name: string) {
  return name

    .split(' ')

    .map((part) => part[0])

    .join('')

    .slice(0, 2)

    .toUpperCase()
}

export function LandingTestimonial({ quote }: LandingTestimonialProps) {
  return (
    <section className="landing-section landing-section-muted border-border bg-background border-b">
      <div className="landing-section-inner py-20 sm:py-24">
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-14">
          <blockquote className="landing-testimonial-accent border-border relative max-w-3xl border-l pl-5 sm:pl-6">
            <p className="landing-display text-foreground text-xl leading-snug font-medium tracking-tight sm:text-2xl">
              &ldquo;{quote.quote}&rdquo;
            </p>
          </blockquote>

          <footer className="flex shrink-0 items-center gap-3 lg:pt-1">
            <div
              className="landing-avatar landing-mono text-muted-foreground flex h-9 w-9 items-center justify-center rounded-full border text-[10px] font-medium"
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
          </footer>
        </div>
      </div>
    </section>
  )
}
