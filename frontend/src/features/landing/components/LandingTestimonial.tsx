import type { Testimonial } from '@/types';



type LandingTestimonialProps = {

  quote: Testimonial;

};



function initials(name: string) {

  return name

    .split(' ')

    .map((part) => part[0])

    .join('')

    .slice(0, 2)

    .toUpperCase();

}



export function LandingTestimonial({ quote }: LandingTestimonialProps) {

  return (

    <section className="landing-section-muted border-b border-border bg-background">

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">

        <div className="grid lg:grid-cols-[minmax(0,1fr)_auto] gap-8 lg:gap-14 items-start">

          <blockquote className="landing-testimonial-accent relative pl-5 sm:pl-6 border-l border-border max-w-3xl">

            <p className="landing-display text-xl sm:text-2xl font-medium text-foreground leading-snug tracking-tight">

              &ldquo;{quote.quote}&rdquo;

            </p>

          </blockquote>



          <footer className="flex items-center gap-3 lg:pt-1 shrink-0">

            <div

              className="landing-avatar w-9 h-9 rounded-full border flex items-center justify-center landing-mono text-[10px] font-medium text-muted-foreground"

              aria-hidden="true"

            >

              {initials(quote.author)}

            </div>

            <div>

              <p className="text-sm font-medium text-foreground">{quote.author}</p>

              <p className="text-xs text-muted-foreground mt-0.5">

                {quote.role}, {quote.company}

              </p>

            </div>

          </footer>

        </div>

      </div>

    </section>

  );

}

