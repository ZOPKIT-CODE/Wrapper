import { useId } from 'react'
import { useReducedMotion } from 'framer-motion'

const CX = 150
const DISC_CY = 28
const DISC_RX = 98
const DISC_RY = 14
const RIM_LIGHTS = 13

/** Ellipse half-width at tier junction (front-facing 3/4 view) */
const T1_BOT_RX = 118
const T1_TOP_RX = 106
const T2_TOP_RX = 94
const T3_TOP_RX = 86

const Y_BASE = 86
const Y_T1 = 68
const Y_T2 = 52
const Y_T3 = 40

type HeroProjectorPuckProps = {
  isMobile?: boolean
}

function tierWall(
  botRx: number,
  topRx: number,
  yBot: number,
  yTop: number
): string {
  const xL0 = CX - botRx
  const xR0 = CX + botRx
  const xL1 = CX - topRx
  const xR1 = CX + topRx
  return `M ${xL0} ${yBot} L ${xL1} ${yTop} Q ${CX} ${yTop - 2} ${xR1} ${yTop} L ${xR0} ${yBot} Q ${CX} ${yBot + 1.5} ${xL0} ${yBot} Z`
}

export function HeroProjectorPuck({
  isMobile = false,
}: HeroProjectorPuckProps) {
  const uid = useId().replace(/:/g, '')
  const reduceMotion = useReducedMotion()

  const rimDots = Array.from({ length: RIM_LIGHTS }, (_, i) => {
    const t = i / (RIM_LIGHTS - 1)
    const angle = Math.PI * 0.1 + t * Math.PI * 0.8
    return {
      x: CX + DISC_RX * Math.cos(angle) * 0.91,
      y: DISC_CY + DISC_RY * Math.sin(angle) * 0.78,
      i,
    }
  })

  const panelCount = 14
  const panels = Array.from({ length: panelCount }, (_, i) => {
    const t = i / (panelCount - 1)
    const x = CX - T2_TOP_RX + t * T2_TOP_RX * 2
    const yTop = Y_T2 - 1
    const yBot = Y_T1 + 2
    const inset = Math.abs(x - CX) / T2_TOP_RX
    const xAdj = x + (x < CX ? 1.2 : -1.2) * inset
    return { x: xAdj, yTop, yBot, i }
  })

  const motionOn = !isMobile && !reduceMotion

  return (
    <div
      className={`hero-projector-puck landing-hero-illust-projector${motionOn ? 'hero-projector-puck--alive' : ''}`}
      style={{
        position: 'relative',
        width: isMobile
          ? 'clamp(140px, 40vw, 200px)'
          : 'clamp(168px, 20vw, 268px)',
        aspectRatio: '300 / 96',
        zIndex: 5,
        willChange: 'transform',
        transform: 'translateZ(0)',
      }}
    >
      <svg
        className="hero-projector-puck__svg"
        viewBox="0 0 300 96"
        fill="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`${uid}-body-deep`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e3d62" />
            <stop offset="45%" stopColor="#122640" />
            <stop offset="100%" stopColor="#060d18" />
          </linearGradient>
          <linearGradient id={`${uid}-body-mid`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a4f78" />
            <stop offset="100%" stopColor="#142a48" />
          </linearGradient>
          <linearGradient id={`${uid}-body-upper`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#345e8c" />
            <stop offset="100%" stopColor="#1a3558" />
          </linearGradient>
          <linearGradient id={`${uid}-body-collar`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3d6a98" />
            <stop offset="100%" stopColor="#1e4068" />
          </linearGradient>
          <radialGradient id={`${uid}-disc`} cx="46%" cy="34%" r="64%">
            <stop offset="0%" stopColor="#3f6d9c" />
            <stop offset="38%" stopColor="#1c3558" />
            <stop offset="100%" stopColor="#080f1c" />
          </radialGradient>
          <radialGradient id={`${uid}-disc-shine`} cx="28%" cy="24%" r="42%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.28)" />
            <stop offset="55%" stopColor="rgba(255,255,255,0.04)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          <radialGradient id={`${uid}-well`} cx="50%" cy="55%" r="52%">
            <stop offset="0%" stopColor="#030810" />
            <stop offset="55%" stopColor="#0a1828" />
            <stop offset="100%" stopColor="#162e48" />
          </radialGradient>
          <radialGradient id={`${uid}-well-rim`} cx="50%" cy="50%" r="50%">
            <stop offset="72%" stopColor="rgba(0,0,0,0)" />
            <stop offset="88%" stopColor="rgba(94,231,255,0.12)" />
            <stop offset="100%" stopColor="rgba(94,231,255,0.22)" />
          </radialGradient>
          <radialGradient id={`${uid}-lens`} cx="50%" cy="46%" r="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="18%" stopColor="#e8fcff" />
            <stop offset="48%" stopColor="#4dc8ff" />
            <stop offset="100%" stopColor="#184878" />
          </radialGradient>
          <radialGradient id={`${uid}-led`} cx="50%" cy="28%" r="58%">
            <stop offset="0%" stopColor="#f8feff" />
            <stop offset="45%" stopColor="#6ee9ff" />
            <stop offset="100%" stopColor="#1a4878" />
          </radialGradient>
          <linearGradient id={`${uid}-band`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(94,231,255,0)" />
            <stop offset="12%" stopColor="rgba(94,231,255,0.35)" />
            <stop offset="50%" stopColor="rgba(210,250,255,0.95)" />
            <stop offset="88%" stopColor="rgba(94,231,255,0.35)" />
            <stop offset="100%" stopColor="rgba(94,231,255,0)" />
          </linearGradient>
          <linearGradient id={`${uid}-groove`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(46,140,255,0)" />
            <stop offset="20%" stopColor="rgba(94,231,255,0.55)" />
            <stop offset="50%" stopColor="rgba(200,248,255,1)" />
            <stop offset="80%" stopColor="rgba(94,231,255,0.55)" />
            <stop offset="100%" stopColor="rgba(46,140,255,0)" />
          </linearGradient>
          <linearGradient id={`${uid}-edge-l`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0.2)" />
            <stop offset="40%" stopColor="rgba(255,255,255,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.4)" />
          </linearGradient>
          <filter
            id={`${uid}-soft`}
            x="-40%"
            y="-40%"
            width="180%"
            height="180%"
          >
            <feGaussianBlur stdDeviation="2.4" />
          </filter>
          <filter
            id={`${uid}-bloom`}
            x="-100%"
            y="-100%"
            width="300%"
            height="300%"
          >
            <feGaussianBlur stdDeviation="4.8" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter
            id={`${uid}-led-glow`}
            x="-100%"
            y="-100%"
            width="300%"
            height="300%"
          >
            <feGaussianBlur stdDeviation="1.4" />
          </filter>
          <filter
            id={`${uid}-groove-glow`}
            x="-20%"
            y="-200%"
            width="140%"
            height="500%"
          >
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>

        {/* Ground shadow */}
        <ellipse
          cx={CX}
          cy="93.5"
          rx="102"
          ry="4"
          fill="rgba(0,0,0,0.55)"
          filter={`url(#${uid}-soft)`}
        />

        {/* Base plinth */}
        <ellipse
          cx={CX}
          cy={Y_BASE + 2}
          rx={T1_BOT_RX + 4}
          ry="5"
          fill="#050a12"
        />
        <ellipse cx={CX} cy={Y_BASE} rx={T1_BOT_RX} ry="4.5" fill="#0a1424" />

        {/* Tier 1 — widest body */}
        <path
          d={tierWall(T1_BOT_RX, T1_TOP_RX, Y_BASE, Y_T1)}
          fill={`url(#${uid}-body-deep)`}
        />
        {/* Front vent slots */}
        {[-28, -14, 0, 14, 28].map((ox) => (
          <rect
            key={ox}
            x={CX + ox - 3.5}
            y={Y_T1 + 4}
            width="7"
            height="10"
            rx="1.2"
            fill="rgba(0,0,0,0.38)"
            stroke="rgba(94,231,255,0.06)"
            strokeWidth="0.4"
          />
        ))}
        <ellipse
          cx={CX}
          cy={Y_T1}
          rx={T1_TOP_RX}
          ry="5"
          fill="#142840"
          opacity="0.85"
        />

        {/* Recessed base groove (reference signature) */}
        <ellipse
          cx={CX}
          cy={Y_BASE - 5}
          rx={T1_BOT_RX - 6}
          ry="3.2"
          fill="rgba(0,0,0,0.25)"
        />
        <ellipse
          cx={CX}
          cy={Y_BASE - 5}
          rx={T1_BOT_RX - 6}
          ry="3.2"
          fill="none"
          stroke={`url(#${uid}-groove)`}
          strokeWidth="2.8"
          filter={`url(#${uid}-groove-glow)`}
          className={motionOn ? 'hero-projector-puck__groove' : undefined}
        />
        <ellipse
          cx={CX}
          cy={Y_BASE - 5}
          rx={T1_BOT_RX - 10}
          ry="2"
          fill="none"
          stroke="rgba(94,231,255,0.18)"
          strokeWidth="0.6"
        />
        <ellipse
          cx={CX}
          cy={Y_BASE - 5}
          rx={T1_BOT_RX - 6}
          ry="3.2"
          fill="none"
          stroke={`url(#${uid}-groove)`}
          strokeWidth="1"
        />

        {/* Tier 1 → 2 junction band */}
        <path
          d={`M ${CX - T1_TOP_RX + 4} ${Y_T1} Q ${CX} ${Y_T1 - 1.5} ${CX + T1_TOP_RX - 4} ${Y_T1}`}
          stroke={`url(#${uid}-band)`}
          strokeWidth="1.6"
          opacity="0.85"
          className={
            motionOn
              ? 'hero-projector-puck__band hero-projector-puck__band--1'
              : undefined
          }
        />

        {/* Tier 2 — segmented side panels */}
        <path
          d={tierWall(T1_TOP_RX, T2_TOP_RX, Y_T1, Y_T2)}
          fill={`url(#${uid}-body-mid)`}
        />
        {panels.map(({ x, yTop, yBot, i }) => (
          <line
            key={i}
            x1={x}
            y1={yTop}
            x2={x}
            y2={yBot}
            stroke="rgba(0,0,0,0.28)"
            strokeWidth="0.55"
          />
        ))}
        <ellipse
          cx={CX}
          cy={Y_T2}
          rx={T2_TOP_RX}
          ry="4.2"
          fill="#1a3558"
          opacity="0.7"
        />

        {/* Tier 2 → 3 junction band */}
        <path
          d={`M ${CX - T2_TOP_RX + 4} ${Y_T2} Q ${CX} ${Y_T2 - 1.2} ${CX + T2_TOP_RX - 4} ${Y_T2}`}
          stroke={`url(#${uid}-band)`}
          strokeWidth="1.4"
          opacity="0.9"
          className={
            motionOn
              ? 'hero-projector-puck__band hero-projector-puck__band--2'
              : undefined
          }
        />

        {/* Tier 3 — collar ring */}
        <path
          d={tierWall(T2_TOP_RX, T3_TOP_RX, Y_T2, Y_T3)}
          fill={`url(#${uid}-body-collar)`}
        />
        <ellipse
          cx={CX}
          cy={Y_T3}
          rx={T3_TOP_RX}
          ry="3.5"
          fill="#224a72"
          opacity="0.65"
        />

        {/* Top disc — flat machined face */}
        <ellipse
          cx={CX}
          cy={DISC_CY}
          rx={DISC_RX}
          ry={DISC_RY}
          fill={`url(#${uid}-disc)`}
        />
        <ellipse
          cx={CX}
          cy={DISC_CY}
          rx={DISC_RX}
          ry={DISC_RY}
          fill={`url(#${uid}-disc-shine)`}
        />

        {/* Beveled outer rim */}
        <ellipse
          cx={CX}
          cy={DISC_CY}
          rx={DISC_RX - 0.5}
          ry={DISC_RY - 0.5}
          stroke="rgba(94,231,255,0.32)"
          strokeWidth="0.85"
        />
        <ellipse
          cx={CX}
          cy={DISC_CY + 0.6}
          rx={DISC_RX - 2.5}
          ry={DISC_RY - 1.8}
          stroke="rgba(0,0,0,0.42)"
          strokeWidth="0.55"
        />

        {/* Brushed radial spokes */}
        {Array.from({ length: 16 }, (_, i) => {
          const a = (i / 16) * Math.PI * 2
          const x2 = CX + Math.cos(a) * DISC_RX * 0.82
          const y2 = DISC_CY + Math.sin(a) * DISC_RY * 0.82
          return (
            <line
              key={`spoke-${i}`}
              x1={CX}
              y1={DISC_CY}
              x2={x2}
              y2={y2}
              stroke="rgba(255,255,255,0.03)"
              strokeWidth="0.35"
            />
          )
        })}

        {/* Machined concentric grooves */}
        {[0.88, 0.74, 0.6, 0.48, 0.36].map((scale, idx) => (
          <ellipse
            key={scale}
            cx={CX}
            cy={DISC_CY + 0.4}
            rx={DISC_RX * scale}
            ry={DISC_RY * scale}
            stroke={idx % 2 === 0 ? 'rgba(94,231,255,0.1)' : 'rgba(0,0,0,0.22)'}
            strokeWidth="0.45"
          />
        ))}

        {/* Recessed emitter well — sloped inner bowl */}
        <ellipse
          cx={CX}
          cy={DISC_CY + 1}
          rx="56"
          ry="14"
          fill={`url(#${uid}-well)`}
        />
        <path
          d={`M ${CX - 38} ${DISC_CY + 4} Q ${CX} ${DISC_CY - 6} ${CX + 38} ${DISC_CY + 4}`}
          fill="rgba(0,0,0,0.22)"
        />
        <ellipse
          cx={CX}
          cy={DISC_CY + 1}
          rx="56"
          ry="14"
          fill={`url(#${uid}-well-rim)`}
        />
        <ellipse
          cx={CX}
          cy={DISC_CY + 1}
          rx="56"
          ry="14"
          stroke="rgba(94,231,255,0.16)"
          strokeWidth="0.65"
          className={motionOn ? 'hero-projector-puck__well-ring' : undefined}
        />
        <ellipse
          cx={CX}
          cy={DISC_CY + 1.5}
          rx="40"
          ry="10"
          stroke="rgba(0,0,0,0.38)"
          strokeWidth="0.55"
        />
        {/* Collar data ports */}
        {[-22, 22].map((ox, pi) => (
          <circle
            key={ox}
            cx={CX + ox}
            cy={Y_T3 - 2}
            r="2.2"
            fill="#0a1828"
            stroke="rgba(94,231,255,0.25)"
            strokeWidth="0.5"
            className={motionOn ? 'hero-projector-puck__port' : undefined}
            style={motionOn ? { animationDelay: `${pi * 0.9}s` } : undefined}
          />
        ))}

        {/* Rim lens domes — front arc */}
        {rimDots.map(({ x, y, i }) => (
          <g
            key={i}
            className={motionOn ? 'hero-projector-puck__led' : undefined}
            style={motionOn ? { animationDelay: `${i * 0.14}s` } : undefined}
          >
            <ellipse
              cx={x}
              cy={y}
              rx="3.6"
              ry="2.4"
              fill={`url(#${uid}-led)`}
              filter={`url(#${uid}-led-glow)`}
            />
            <ellipse
              cx={x}
              cy={y - 0.7}
              rx="1.4"
              ry="0.9"
              fill="rgba(255,255,255,0.92)"
            />
          </g>
        ))}

        {/* Projection lens */}
        <circle
          cx={CX}
          cy={DISC_CY}
          r="15"
          fill={`url(#${uid}-lens)`}
          filter={`url(#${uid}-bloom)`}
          className={motionOn ? 'hero-projector-puck__core' : undefined}
        />
        <circle
          cx={CX}
          cy={DISC_CY}
          r="15"
          fill="none"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="0.65"
        />
        <circle
          cx={CX}
          cy={DISC_CY}
          r="6"
          fill="#ffffff"
          className={motionOn ? 'hero-projector-puck__core-hot' : undefined}
        />
        <circle cx={CX} cy={DISC_CY} r="2.2" fill="#ffffff" />

        {/* Front-left specular edge highlight */}
        <path
          d={`M ${CX - DISC_RX + 6} ${DISC_CY - 5} Q ${CX - DISC_RX + 12} ${DISC_CY} ${CX - DISC_RX + 6} ${DISC_CY + 7}`}
          stroke={`url(#${uid}-edge-l)`}
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.6"
        />
        <path
          d={`M ${CX - T2_TOP_RX + 8} ${Y_T2 + 4} L ${CX - T1_TOP_RX + 6} ${Y_T1 + 6}`}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}
