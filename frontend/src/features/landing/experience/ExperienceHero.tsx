import { useEffect, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import gsap from 'gsap'
import { NetworkCanvas } from './NetworkCanvas'
import { useExperienceMotion } from './useExperienceMotion'

type ExperienceHeroProps = {
  onBookDemo?: () => void
}

export function ExperienceHero({ onBookDemo }: ExperienceHeroProps) {
  const rootRef = useRef<HTMLElement>(null)
  const navigate = useNavigate()
  const { reduceMotion, disableWebGL } = useExperienceMotion()

  useEffect(() => {
    if (reduceMotion || !rootRef.current) return

    const ctx = gsap.context(() => {
      gsap
        .timeline({ defaults: { ease: 'power3.out' } })
        .from('.xp-hero-eyebrow', { opacity: 0, y: 18, duration: 0.55 })
        .from(
          '.xp-hero-line',
          { opacity: 0, y: 40, duration: 0.85, stagger: 0.1 },
          '-=0.25'
        )
        .from('.xp-hero-sub', { opacity: 0, y: 20, duration: 0.65 }, '-=0.35')
        .from(
          '.xp-hero-cta',
          {
            y: 16,
            duration: 0.5,
            stagger: 0.08,
            clearProps: 'all',
          },
          '-=0.25'
        )
        .from(
          '.xp-hero-visual',
          { opacity: 0, scale: 0.94, duration: 1.1 },
          '-=0.7'
        )
    }, rootRef)

    return () => ctx.revert()
  }, [reduceMotion])

  return (
    <section ref={rootRef} className="xp-hero" aria-label="Hero">
      <div className="xp-hero-copy">
        <p className="xp-hero-eyebrow">Unified operations platform</p>
        <h1 className="xp-hero-title xp-display">
          <span className="xp-hero-line block">One workspace.</span>
          <span className="xp-hero-line block">
            Every <em>connected</em> record.
          </span>
        </h1>
        <p className="xp-hero-sub">
          CRM, finance, HR, and operations share identity, data, and billing in
          a single Zopkit workspace built for growing teams.
        </p>
        <div className="xp-hero-actions">
          <button
            type="button"
            className="xp-hero-cta xp-btn-primary"
            onClick={onBookDemo}
          >
            Book a demo
          </button>
          <button
            type="button"
            className="xp-hero-cta xp-btn-ghost"
            onClick={() => navigate({ to: '/pricing' })}
          >
            See pricing
          </button>
        </div>
      </div>

      <div className="xp-hero-visual">
        <div className="xp-hero-glow" aria-hidden="true" />
        <NetworkCanvas disabled={disableWebGL} />
      </div>
    </section>
  )
}
