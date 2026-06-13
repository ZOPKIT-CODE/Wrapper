import { useState, useEffect } from 'react'
import { motion, MotionConfig } from 'framer-motion'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { MobileHeroSection } from './MobileHeroSection'
import {
  landingHeroCopy,
  landingHeroLayout,
  landingHeroMotion,
} from '../landing-hero-copy'
import { landingFonts, landingType } from '../landing-typography'
import { scrollToLandingContact } from '../landing-scroll'
import { CinematicHeroBackdrop } from './CinematicHeroBackdrop'
import { HeroCinematicAtmosphere } from './HeroCinematicAtmosphere'
import { HeroOrchestratorDashboard } from './HeroOrchestratorDashboard'
import { HeroStageConnectors } from './HeroStageConnectors'
import { HeroProjectionBeam } from './HeroProjectionBeam'
import { HeroProjectorPuck } from './HeroProjectorPuck'
import { HeroScanFlash } from './HeroScanFlash'
import { RobotBall } from './RobotBall'
import './hero-cinematic.css'
import './robot-ball.css'
import './hero-scan-flash.css'
import './hero-projection-beam.css'
import './hero-projection-particles.css'
import './hero-projector-puck.css'

// ─── Mobile detection ──────────────────────────────────────────────────────────
function useMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isMobile
}

function useMediaQuery(query: string, defaultValue = false) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia(query).matches
      : defaultValue
  )
  useEffect(() => {
    const mq = window.matchMedia(query)
    setMatches(mq.matches)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [query])
  return matches
}

function useCompactHeroStage() {
  return useMediaQuery(`(max-width: ${landingHeroLayout.compactMax}px)`)
}

function useHeroSideRailsVisible() {
  return useMediaQuery(`(min-width: ${landingHeroLayout.sideRailMin}px)`, true)
}

// ─── Shared keyframes ──────────────────────────────────────────────────────────
const PROJECTOR_STYLES = `
  @keyframes data-flow-up   { to { stroke-dashoffset: 9; } }
  @keyframes pp-floor-pulse { 0%,100%{ opacity:0.6 } 50%{ opacity:1 } }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`

// ─── Agent data ────────────────────────────────────────────────────────────────
const BLUE = '#4dc8ff'

/** Holographic HUD palette — cinematic glass projection. */
const INK = {
  base: 'rgba(220, 245, 255, 0.94)',
  soft: 'rgba(94, 231, 255, 0.62)',
  muted: 'rgba(148, 200, 255, 0.48)',
  faint: 'rgba(94, 231, 255, 0.22)',
  border: 'rgba(94, 231, 255, 0.14)',
  borderMd: 'rgba(94, 231, 255, 0.26)',
  wash: 'rgba(94, 231, 255, 0.05)',
  washMd: 'rgba(94, 231, 255, 0.09)',
  panel: 'rgba(4, 14, 32, 0.65)',
  accentWash: 'rgba(94, 231, 255, 0.08)',
  accentBorder: 'rgba(94, 231, 255, 0.35)',
}

const TX = (color = 'rgba(255,255,255,0.85)', size = 8, weight = 500) => ({
  fontSize: size,
  fontWeight: weight,
  color,
  fontFamily: landingFonts.mono,
  lineHeight: 1.3,
  letterSpacing: '0.02em',
})

// ─── Act 1–3: center fall → hold → descend to puck ─────────────────────────────
function HeroStageBall({ isMobile }: { isMobile: boolean }) {
  const m = landingHeroMotion
  const BALL_SIZE = isMobile ? 64 : 88
  const ballFilter = isMobile
    ? 'drop-shadow(0 8px 16px rgba(0,0,0,0.55)) drop-shadow(0 0 14px rgba(77,200,255,0.55))'
    : 'drop-shadow(0 12px 24px rgba(0,0,0,0.6)) drop-shadow(0 0 20px rgba(77,200,255,0.65)) drop-shadow(0 0 40px rgba(56,184,255,0.25))'

  const puckLandTime = m.puckDelay
  const centerLandFrac = m.ballCenterFallDur / puckLandTime
  const holdEndFrac = m.ballDescentDelay / puckLandTime
  const descentPx = isMobile ? 200 : 265

  return (
    <motion.div
      className="hero-stage-ball"
      initial={{ y: -170, opacity: 0, scale: 0.45 }}
      animate={{
        y: [-170, 0, 0, descentPx],
        opacity: [0, 1, 1, 0],
        scale: [0.45, 1, 1, 0.8],
      }}
      transition={{
        duration: puckLandTime,
        delay: m.ballCenterDelay,
        times: [0, centerLandFrac, holdEndFrac, 1],
        ease: [[0.34, 1.15, 0.64, 1], 'linear', [0.42, 0, 0.58, 1]],
      }}
      style={{
        position: 'absolute',
        left: '50%',
        top: isMobile ? '32%' : '34%',
        x: '-50%',
        zIndex: 35,
        pointerEvents: 'none',
        filter: ballFilter,
        willChange: 'transform, opacity',
      }}
      aria-hidden="true"
    >
      <motion.div
        animate={{ y: [0, -3, 0] }}
        transition={{
          duration: 3.5,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: m.ballCenterFallDur,
        }}
      >
        <RobotBall size={BALL_SIZE} />
      </motion.div>
    </motion.div>
  )
}

// ─── Holographic Dashboard ─────────────────────────────────────────────────────
function DashboardMock({
  isMobile,
  mobileScale = 1,
}: {
  isMobile: boolean
  mobileScale?: number
}) {
  const SCREEN_DELAY = landingHeroMotion.screenDelay
  const SCREEN_DUR = landingHeroMotion.screenDur
  const SCREEN_EASE = [0.04, 0.92, 0.2, 1] as [number, number, number, number]
  const CLIP_ORIGIN = '50% 100%'

  return (
    <motion.div
      className={`landing-hero-illust-dashboard-wrap${isMobile ? '' : 'landing-hero-illust-dashboard-wrap--desktop'}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: SCREEN_DELAY, duration: 0.15 }}
      style={{
        position: 'relative',
        padding: 2,
        borderRadius: 'clamp(10px, 1vw, 16px)',
        zIndex: 4,
        width: isMobile ? '100%' : undefined,
      }}
    >
      {/* Frame glow — appears with screen */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15, delay: SCREEN_DELAY }}
        className="landing-hero-illust-dashboard-frame"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          borderRadius: 'inherit',
          background: 'transparent',
        }}
      />

      {/* Projection energy burst when hologram materializes */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{
          duration: SCREEN_DUR * 1.25,
          delay: SCREEN_DELAY,
          times: [0, 0.06, 0.4, 1],
          ease: 'easeInOut',
        }}
        style={{
          position: 'absolute',
          inset: -4,
          pointerEvents: 'none',
          borderRadius: 'clamp(14px, 1.3vw, 20px)',
          boxShadow:
            '0 0 0 2px rgba(94,231,255,0.55), 0 0 28px 14px rgba(77,200,255,0.35), 0 0 64px 28px rgba(94,231,255,0.12)',
          zIndex: 10,
        }}
      />

      {/* Screen — reveals upward from puck projection */}
      <div
        className="landing-hero-glass-window landing-hero-glass-window--screen"
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: isMobile ? '16 / 10' : '152 / 75',
          borderRadius: 'clamp(8px, 0.8vw, 14px)',
          overflow: 'hidden',
          display: 'flex',
        }}
      >
        <motion.div
          className="landing-hero-illust-screen"
          initial={{ clipPath: `circle(0px at ${CLIP_ORIGIN})` }}
          animate={{ clipPath: `circle(150% at ${CLIP_ORIGIN})` }}
          transition={{
            duration: SCREEN_DUR,
            delay: SCREEN_DELAY,
            ease: SCREEN_EASE,
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: isMobile ? 800 : '100%',
            height: isMobile ? 400 : '100%',
            display: 'flex',
            ...(isMobile ? { zoom: mobileScale } : {}),
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 1,
              background: `linear-gradient(90deg, transparent, ${INK.borderMd}, ${INK.border}, ${INK.borderMd}, transparent)`,
              zIndex: 10,
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '28%',
              background: `linear-gradient(to top, ${INK.accentWash}, transparent)`,
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />

          <HeroOrchestratorDashboard />
        </motion.div>

        {/* Flash burst */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0, 1, 0.5, 0] }}
          transition={{
            duration: 0.45,
            delay: SCREEN_DELAY,
            times: [0, 0.01, 0.06, 0.2, 1],
            ease: 'easeOut',
          }}
          style={{
            position: 'absolute',
            top: '20%',
            bottom: '20%',
            left: '15%',
            right: '15%',
            background:
              'radial-gradient(ellipse at 50% 50%, rgba(220,238,255,0.62) 0%, rgba(120,170,255,0.24) 30%, rgba(50,90,200,0.08) 60%, transparent 100%)',
            pointerEvents: 'none',
            zIndex: 22,
          }}
        />
      </div>
    </motion.div>
  )
}

// ─── Act 4: puck → beam → screen (ball handled by HeroStageBall) ───────────────
function ProjectionStack({ isMobile }: { isMobile: boolean }) {
  const m = landingHeroMotion
  const BALL_SIZE = isMobile ? 64 : 88

  return (
    <div className="landing-hero-projection-stack">
      {/* Volumetric beam — hidden until puck has formed (coneDelay) */}
      <motion.div
        className="landing-hero-projection-beam"
        aria-hidden="true"
        initial={{ opacity: 0, visibility: 'hidden' }}
        animate={{ opacity: 1, visibility: 'visible' }}
        transition={{
          delay: m.coneDelay,
          duration: 0.01,
        }}
      >
        <HeroProjectionBeam isMobile={isMobile} />
      </motion.div>

      {/* Landing pulse when ball arrives at puck position */}
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: [0.4, 2.4, 3.2], opacity: [0, 0.55, 0] }}
        transition={{
          duration: m.puckMorphDur * 1.1,
          delay: m.puckDelay,
          ease: 'easeOut',
        }}
        style={{
          position: 'absolute',
          bottom: 8,
          left: '50%',
          x: '-50%',
          width: BALL_SIZE,
          height: BALL_SIZE,
          borderRadius: '50%',
          border: '1.5px solid rgba(94,231,255,0.7)',
          boxShadow: '0 0 24px 8px rgba(77,200,255,0.35)',
          zIndex: 34,
          pointerEvents: 'none',
        }}
      />

      {/* Step 2 — puck forms at stack base */}
      <div className="landing-hero-projection-puck">
        <motion.div
          className="landing-hero-projection-puck__inner"
          initial={{ opacity: 0, scale: 0.75 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            duration: m.puckMorphDur,
            delay: m.puckDelay,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <HeroProjectorPuck isMobile={isMobile} />
        </motion.div>
      </div>
    </div>
  )
}

// ─── Side agent cards ──────────────────────────────────────────────────────────
const SIDE_LEFT = [
  {
    source: 'B2B CRM Agent',
    color: BLUE,
    feeds: ['Lead scored: sample account', 'Pipeline updated (sample)'],
    integrations: ['CRM', 'Email'],
  },
  {
    source: 'Finance Agent',
    color: BLUE,
    feeds: ['GST return filed (sample)', 'Invoice reconciled'],
    integrations: ['Tally', 'GST'],
  },
]
const SIDE_RIGHT = [
  {
    source: 'HRMS Agent',
    color: BLUE,
    feeds: ['Payroll batch processed', 'Leave requests reviewed'],
    integrations: ['ESIC', 'PF'],
  },
  {
    source: 'Projects Agent',
    color: BLUE,
    feeds: ['Sprint blockers resolved', 'Budget on track'],
    integrations: ['Tasks', 'Git'],
  },
]

type SideCard = {
  source: string
  color: string
  feeds: string[]
  integrations: string[]
}

function SideAgentCard({
  source,
  color,
  feeds,
  integrations,
  isMobile = false,
}: SideCard & { isMobile?: boolean }) {
  if (isMobile) {
    return (
      <div
        className="landing-hero-illust-side-card landing-hero-glass-window"
        style={{
          borderTopColor: color,
          borderRadius: '0 0 8px 8px',
          padding: '4px 5px',
        }}
      >
        <span
          style={{
            ...TX(color, 4.5, 700),
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            display: 'block',
            marginBottom: 3,
          }}
        >
          {source}
        </span>
        {feeds.slice(0, 2).map((f, i) => (
          <div key={i} style={{ marginBottom: 1.5 }}>
            <span style={{ ...TX(INK.muted, 4), lineHeight: 1.3 }}>{f}</span>
          </div>
        ))}
        <div
          style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginTop: 3 }}
        >
          {integrations.slice(0, 2).map((tag, i) => (
            <span
              key={i}
              className="landing-hero-glass-tag"
              style={{
                ...TX(color, 4, 600),
                borderRadius: 3,
                padding: '1px 3px',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      className="landing-hero-illust-side-card landing-hero-glass-window"
      style={{
        borderTopColor: color,
        borderRadius: '0 0 12px 12px',
        padding: '10px 12px',
      }}
    >
      {/* Card title */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 9,
        }}
      >
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: 5,
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <img
            src="https://res.cloudinary.com/dr9vzaa7u/image/upload/v1765126845/Zopkit_Simple_Logo_glohfr.jpg"
            alt="Zopkit"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </div>
        <span
          style={{
            ...TX(color, 8, 700),
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            flex: 1,
          }}
        >
          {source}
        </span>
      </div>

      {/* Activity */}
      <div style={{ marginBottom: 8 }}>
        <span
          style={{
            ...TX(INK.muted, 6, 600),
            textTransform: 'uppercase',
            letterSpacing: '0.10em',
            display: 'block',
            marginBottom: 5,
          }}
        >
          Activity
        </span>
        {feeds.slice(0, 2).map((item, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 5,
              marginBottom: i < Math.min(feeds.length, 2) - 1 ? 4 : 0,
            }}
          >
            <span style={{ ...TX(INK.soft, 7.5), lineHeight: 1.4 }}>
              {item}
            </span>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: INK.border, margin: '0 0 8px' }} />

      {/* INTEGRATIONS */}
      <div>
        <span
          style={{
            ...TX(INK.muted, 6, 600),
            textTransform: 'uppercase',
            letterSpacing: '0.10em',
            display: 'block',
            marginBottom: 5,
          }}
        >
          Integrations
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {integrations.slice(0, 2).map((tag, i) => (
            <span
              key={i}
              className="landing-hero-glass-tag"
              style={{
                ...TX(color, 7, 600),
                borderRadius: 4,
                padding: '2px 7px',
                letterSpacing: '0.03em',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Floor glow ────────────────────────────────────────────────────────────────
function FloorGlow() {
  const m = landingHeroMotion

  return (
    <motion.div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-[1]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        delay: m.act3.ballDescentDelay,
        duration: 0.35,
        ease: 'easeOut',
      }}
      aria-hidden="true"
    >
      <div
        className="landing-hero-floor-glow pointer-events-none absolute right-0 bottom-0 left-0 h-[280px]"
        style={{ animation: 'pp-floor-pulse 3.5s ease-in-out infinite' }}
      />
      <div
        className="pointer-events-none absolute bottom-0 left-1/2 h-[70px] w-[min(280px,36%)] -translate-x-1/2"
        style={{
          background:
            'radial-gradient(ellipse at 50% 100%, color-mix(in oklch, var(--foreground) 10%, transparent), transparent 65%)',
          animation: 'pp-floor-pulse 3.5s ease-in-out 0.7s infinite',
        }}
      />
      <motion.div
        initial={{ opacity: 0, scaleX: 0.1 }}
        animate={{ opacity: [0, 0, 0.9, 0], scaleX: [0.1, 0.1, 1.4, 2.2] }}
        transition={{
          duration: 0.55,
          delay: m.coneDelay + 0.08,
          times: [0, 0.01, 0.22, 1],
          ease: 'easeOut',
        }}
        style={{
          position: 'absolute',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(340px, 44%)',
          height: 50,
          background:
            'radial-gradient(ellipse at 50% 100%, color-mix(in oklch, var(--primary) 40%, transparent), color-mix(in oklch, var(--foreground) 8%, transparent) 50%, transparent 75%)',
          pointerEvents: 'none',
          zIndex: 3,
          transformOrigin: 'center bottom',
        }}
      />
    </motion.div>
  )
}

// ─── Headline ──────────────────────────────────────────────────────────────────
function Headline({ isMobile }: { isMobile: boolean }) {
  const s1 = landingHeroMotion.act2

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, delay: s1.line1, ease: 'easeOut' }}
      style={{
        textAlign: 'center',
        position: 'relative',
        zIndex: 3,
        maxWidth: 900,
        margin: '0 auto',
        width: '100%',
      }}
    >
      <h1
        className="landing-display"
        style={{
          margin: 0,
          fontFamily: landingFonts.display,
          lineHeight: isMobile ? 1.1 : 1.08,
          letterSpacing: landingType.displayTracking,
        }}
      >
        <motion.span
          className="landing-hero-headline-line block"
          initial={{ y: 18, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{
            duration: s1.lineDur,
            delay: s1.line1,
            ease: [0.22, 1, 0.36, 1],
          }}
          style={{
            fontSize: isMobile
              ? 'clamp(22px, 6vw, 28px)'
              : 'clamp(30px, 4.8vw, 44px)',
            fontWeight: 600,
            color: 'var(--foreground)',
          }}
        >
          {landingHeroCopy.headlineLine1}
        </motion.span>
        <motion.span
          className="landing-hero-headline-line block"
          initial={{ y: 18, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{
            duration: s1.lineDur,
            delay: s1.line2,
            ease: [0.22, 1, 0.36, 1],
          }}
          style={{
            fontSize: isMobile
              ? 'clamp(19px, 5.2vw, 24px)'
              : 'clamp(26px, 4.2vw, 40px)',
            fontWeight: 600,
            color: 'var(--primary)',
          }}
        >
          {landingHeroCopy.headlineLine2}
        </motion.span>
      </h1>
      <motion.p
        className="landing-hero-subtext"
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{
          duration: s1.subtextDur,
          delay: s1.subtext,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        {landingHeroCopy.subtext}
      </motion.p>
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{
          duration: s1.dividerDur,
          delay: s1.divider,
          ease: 'easeOut',
        }}
        className="landing-hero-divider mx-auto"
        style={{
          width: 40,
          height: 1,
          borderRadius: 1,
          background:
            'linear-gradient(90deg, transparent, color-mix(in srgb, var(--border) 80%, var(--primary)), transparent)',
        }}
      />
    </motion.div>
  )
}

function HeroActions({ onBookDemo }: { onBookDemo?: () => void }) {
  const navigate = useNavigate()
  const handleBookDemo = onBookDemo ?? (() => scrollToLandingContact('smooth'))

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: landingHeroMotion.act2.ctaDur,
        delay: landingHeroMotion.act2.cta,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="landing-hero-actions"
    >
      <Button
        type="button"
        size="lg"
        onClick={handleBookDemo}
        className="landing-btn-primary h-11 rounded-full px-7 text-sm font-medium"
      >
        Book a demo
      </Button>
      <button
        type="button"
        onClick={() => navigate({ to: '/pricing' })}
        className="landing-text-link cursor-pointer text-sm font-medium underline-offset-4 transition-colors hover:underline"
      >
        See pricing
      </button>
    </motion.div>
  )
}

// ─── Desktop hero (≥768px) ─────────────────────────────────────────────────────
function DesktopPetpoojaHeroSection({
  onBookDemo,
}: {
  onBookDemo?: () => void
}) {
  const PUCK_H = 'clamp(40px, 5vw, 56px)'
  const compactHero = useCompactHeroStage()
  const sideRailsVisible = useHeroSideRailsVisible()

  return (
    <MotionConfig reducedMotion="user">
      <style>{PROJECTOR_STYLES}</style>
      <section className="landing-hero landing-hero--cinematic border-border border-b">
        <CinematicHeroBackdrop />
        <HeroCinematicAtmosphere />

        <FloorGlow />

        <div className="landing-hero-copy">
          <Headline isMobile={false} />
          <HeroActions onBookDemo={onBookDemo} />
        </div>

        <div
          className={`landing-hero-stage landing-hero-stage--cinematic${sideRailsVisible ? '' : 'landing-hero-stage--no-rails'}`}
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'center',
            gap: sideRailsVisible ? 64 : 0,
            paddingLeft: 0,
            paddingRight: 0,
            boxSizing: 'border-box',
          }}
        >
          <HeroScanFlash isMobile={false} />
          <HeroStageBall isMobile={false} />
          {sideRailsVisible && (
            <motion.div
              className="landing-hero-side-rail landing-hero-side-rail--left"
              initial={{ opacity: 0, x: -22 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: landingHeroMotion.sideDur,
                delay: landingHeroMotion.sideLeft,
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{
                width: 'clamp(175px, 14vw, 210px)',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                paddingTop: 'clamp(36px, 4vw, 56px)',
                zIndex: 5,
              }}
            >
              {SIDE_LEFT.map((card) => (
                <SideAgentCard key={card.source} {...card} />
              ))}
            </motion.div>
          )}

          {/* CENTER */}
          <div
            className="landing-hero-illust-center"
            style={{
              flex: '1 1 auto',
              minWidth: 0,
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'clamp(10px, 1.75vw, 20px)',
              overflow: 'visible',
              zIndex: 2,
            }}
          >
            <DashboardMock isMobile={false} mobileScale={1} />
            <div
              style={{
                width: 'clamp(180px, 24vw, 300px)',
                height: PUCK_H,
                flexShrink: 0,
              }}
              aria-hidden="true"
            />
            <ProjectionStack isMobile={false} />
          </div>

          {sideRailsVisible && (
            <motion.div
              className="landing-hero-side-rail landing-hero-side-rail--right"
              initial={{ opacity: 0, x: 22 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: landingHeroMotion.sideDur,
                delay: landingHeroMotion.sideRight,
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{
                width: 'clamp(175px, 14vw, 210px)',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                paddingTop: 'clamp(36px, 4vw, 56px)',
                zIndex: 5,
              }}
            >
              {SIDE_RIGHT.map((card) => (
                <SideAgentCard key={card.source} {...card} />
              ))}
            </motion.div>
          )}

          {sideRailsVisible && <HeroStageConnectors compact={compactHero} />}
        </div>
      </section>
    </MotionConfig>
  )
}

export function PetpoojaHeroSection({
  onBookDemo,
}: {
  onBookDemo?: () => void
}) {
  const isMobile = useMobile()
  if (isMobile) {
    return <MobileHeroSection onBookDemo={onBookDemo} />
  }
  return <DesktopPetpoojaHeroSection onBookDemo={onBookDemo} />
}
