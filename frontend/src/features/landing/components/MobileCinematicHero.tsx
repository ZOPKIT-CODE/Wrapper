import { motion, MotionConfig, useReducedMotion } from 'framer-motion'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { landingHeroCopy, landingHeroMotion } from '../landing-hero-copy'
import { landingFonts, landingType } from '../landing-typography'
import { scrollToLandingContact } from '../landing-scroll'
import { CinematicHeroBackdrop } from './CinematicHeroBackdrop'
import { LandingBrowserFrame } from './LandingBrowserFrame'
import { RobotBall } from './RobotBall'
import './hero-cinematic.css'
import './robot-ball.css'

type MobileCinematicHeroProps = {
  onBookDemo?: () => void
}

const ease = [0.22, 1, 0.36, 1] as const

/** Mobile hero — dark cinematic shell, shared copy, static robo-ball + workspace preview. */
export function MobileCinematicHero({ onBookDemo }: MobileCinematicHeroProps) {
  const reduceMotion = useReducedMotion()
  const handleBookDemo = onBookDemo ?? (() => scrollToLandingContact('smooth'))
  const m = landingHeroMotion.ch2

  const motionProps = (delay: number) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 14 } as const,
          animate: { opacity: 1, y: 0 } as const,
          transition: { duration: 0.34, delay, ease },
        }

  return (
    <MotionConfig reducedMotion="user">
      <section className="landing-hero landing-hero--cinematic landing-hero--mobile-cine border-border border-b">
        <CinematicHeroBackdrop />

        <div className="landing-hero-copy landing-hero-copy--mobile-cine">
          <motion.div {...motionProps(m.line1)}>
            <h1
              className="landing-display text-center"
              style={{
                margin: 0,
                fontFamily: landingFonts.display,
                letterSpacing: landingType.displayTracking,
                lineHeight: 1.1,
              }}
            >
              <span
                className="landing-hero-headline-line block text-[clamp(1.375rem,6vw,1.75rem)] font-semibold"
                style={{ color: 'rgba(220, 245, 255, 0.94)' }}
              >
                {landingHeroCopy.headlineLine1}
              </span>
              <span
                className="landing-hero-headline-line block text-[clamp(1.1875rem,5.2vw,1.5rem)] font-semibold"
                style={{ color: '#5ee7ff' }}
              >
                {landingHeroCopy.headlineLine2}
              </span>
            </h1>
          </motion.div>

          <motion.p
            className="landing-hero-subtext mx-auto mt-4 max-w-md text-center text-sm leading-relaxed"
            {...motionProps(m.subtext)}
          >
            {landingHeroCopy.subtext}
          </motion.p>

          <motion.div
            className="landing-hero-actions mt-6"
            role="group"
            aria-label="Get started"
            {...motionProps(m.cta)}
          >
            <Button
              type="button"
              size="lg"
              onClick={handleBookDemo}
              aria-label="Book a demo, go to contact form"
              className="landing-btn-primary landing-cta h-11 rounded-full px-7 text-sm font-medium"
            >
              Book a demo
            </Button>
            <Link
              to="/pricing"
              className="landing-text-link landing-cta-link text-sm font-medium underline-offset-4 transition-colors hover:underline"
            >
              See pricing
            </Link>
          </motion.div>
        </div>

        <div className="landing-hero-mobile-stage" aria-hidden="true">
          <div className="landing-hero-mobile-ball">
            <RobotBall size={56} />
          </div>
          <LandingBrowserFrame
            url="app.zopkit.com"
            maxContentHeight={200}
            variant="hero"
            className="landing-hero-mobile-frame mx-auto w-full max-w-[min(100%,320px)]"
          >
            <img
              src="/fa-dashboard.svg"
              alt=""
              className="block h-auto w-full"
              loading="eager"
              decoding="async"
            />
          </LandingBrowserFrame>
        </div>
      </section>
    </MotionConfig>
  )
}
