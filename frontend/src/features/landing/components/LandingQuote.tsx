import { motion, useReducedMotion } from 'framer-motion';
import { testimonials } from '@/data/content';
import { landingEase } from '@/features/landing/components/landing-motion';

export function LandingQuote() {
  const reduceMotion = useReducedMotion();
  const quote = testimonials[0];

  return (
    <section className="border-y border-border bg-muted/30">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.35 }}
        transition={{ duration: 0.55, ease: landingEase }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24"
      >
        <blockquote className="max-w-3xl border-l-2 border-primary pl-6 sm:pl-8">
          <p className="font-['Bricolage_Grotesque'] text-2xl sm:text-3xl font-medium text-foreground leading-snug tracking-[-0.02em]">
            &ldquo;{quote.quote}&rdquo;
          </p>
          <footer className="mt-8">
            <p className="text-sm font-medium text-foreground">{quote.author}</p>
            <p className="text-sm text-muted-foreground">
              {quote.role}, {quote.company}
            </p>
          </footer>
        </blockquote>
      </motion.div>
    </section>
  );
}
