import type { Testimonial } from '@/types'

type ExperienceProofProps = {
  testimonial: Testimonial
}

export function ExperienceProof({ testimonial }: ExperienceProofProps) {
  return (
    <section className="xp-proof" aria-label="Customer proof">
      <div className="xp-proof-grid">
        <article className="xp-proof-cell xp-proof-quote">
          <blockquote className="xp-display">
            &ldquo;{testimonial.quote}&rdquo;
          </blockquote>
          <cite>
            {testimonial.author}, {testimonial.role} at {testimonial.company}
          </cite>
        </article>
        <article className="xp-proof-cell">
          <div className="xp-metric-value">47%</div>
          <div className="xp-metric-label">
            faster month-end close after consolidating finance and ops
          </div>
        </article>
        <article className="xp-proof-cell">
          <div className="xp-metric-value">6</div>
          <div className="xp-metric-label">
            modules sharing one identity and billing account
          </div>
        </article>
      </div>
    </section>
  )
}
