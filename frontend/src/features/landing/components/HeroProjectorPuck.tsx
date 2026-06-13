import { useId } from 'react'
import { useReducedMotion } from 'framer-motion'

const CX = 160
const TOP_CY = 46
const TOP_RX = 112
const TOP_RY = 20
const RIM_CY = 72
const RIM_RX = 122
const RIM_RY = 9
const SEGMENTS = 14

type HeroProjectorPuckProps = {
  isMobile?: boolean
}

function ellipsePoint(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  angle: number
) {
  return {
    x: cx + rx * Math.cos(angle),
    y: cy + ry * Math.sin(angle),
  }
}

function topSegmentPath(index: number, total: number): string {
  const arcStart = Math.PI * 0.1
  const arcSpan = Math.PI * 0.8
  const a0 = arcStart + (index / total) * arcSpan
  const a1 = arcStart + ((index + 1) / total) * arcSpan
  const p0 = ellipsePoint(CX, TOP_CY, TOP_RX, TOP_RY, a0)
  const p1 = ellipsePoint(CX, TOP_CY, TOP_RX, TOP_RY, a1)
  const largeArc = a1 - a0 > Math.PI ? 1 : 0
  return `M ${CX} ${TOP_CY} L ${p0.x} ${p0.y} A ${TOP_RX} ${TOP_RY} 0 ${largeArc} 1 ${p1.x} ${p1.y} Z`
}

function sideSegmentPath(index: number, total: number): string {
  const arcStart = Math.PI * 0.1
  const arcSpan = Math.PI * 0.8
  const a0 = arcStart + (index / total) * arcSpan
  const a1 = arcStart + ((index + 1) / total) * arcSpan
  const t0 = ellipsePoint(CX, TOP_CY, TOP_RX * 0.96, TOP_RY * 0.96, a0)
  const t1 = ellipsePoint(CX, TOP_CY, TOP_RX * 0.96, TOP_RY * 0.96, a1)
  const b0 = ellipsePoint(CX, RIM_CY, RIM_RX * 0.94, RIM_RY * 0.94, a0)
  const b1 = ellipsePoint(CX, RIM_CY, RIM_RX * 0.94, RIM_RY * 0.94, a1)
  return `M ${t0.x} ${t0.y} L ${t1.x} ${t1.y} L ${b1.x} ${b1.y} L ${b0.x} ${b0.y} Z`
}

export function HeroProjectorPuck({
  isMobile = false,
}: HeroProjectorPuckProps) {
  const uid = useId().replace(/:/g, '')
  const motionOn = !useReducedMotion()

  return (
    <div
      className={`hero-projector-puck hero-projector-puck--sci landing-hero-illust-projector${
        motionOn ? 'hero-projector-puck--alive' : ''
      }`}
      style={{
        position: 'relative',
        width: isMobile
          ? 'clamp(148px, 42vw, 220px)'
          : 'clamp(176px, 22vw, 280px)',
        aspectRatio: '320 / 140',
        zIndex: 5,
      }}
    >
      <div className="hero-projector-puck__cast" aria-hidden="true" />
      <div className="hero-projector-puck__stage">
        <div
          className="hero-projector-puck__glow hero-projector-puck__glow--shadow"
          aria-hidden="true"
        />
        <div
          className="hero-projector-puck__glow hero-projector-puck__glow--floor-core"
          aria-hidden="true"
        />
        <div
          className="hero-projector-puck__glow hero-projector-puck__glow--floor-strip-l"
          aria-hidden="true"
        />
        <div
          className="hero-projector-puck__glow hero-projector-puck__glow--floor-strip-r"
          aria-hidden="true"
        />
        <div
          className="hero-projector-puck__glow hero-projector-puck__glow--core"
          aria-hidden="true"
        />

        <svg
          className="hero-projector-puck__svg"
          viewBox="0 0 320 140"
          fill="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient
              id={`${uid}-panel-light`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor="#f2f5f9" />
              <stop offset="100%" stopColor="#d5dce6" />
            </linearGradient>
            <linearGradient
              id={`${uid}-panel-dark`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor="#2a3344" />
              <stop offset="100%" stopColor="#121820" />
            </linearGradient>
            <linearGradient id={`${uid}-rim`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1e2836" />
              <stop offset="100%" stopColor="#0a0f16" />
            </linearGradient>
            <linearGradient id={`${uid}-strip`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ff3355" stopOpacity="0.15" />
              <stop offset="20%" stopColor="#ff4d6d" />
              <stop offset="50%" stopColor="#ff8099" />
              <stop offset="80%" stopColor="#ff4d6d" />
              <stop offset="100%" stopColor="#ff3355" stopOpacity="0.15" />
            </linearGradient>
            <linearGradient id={`${uid}-lens`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="22%" stopColor="#dffbff" />
              <stop offset="55%" stopColor="#42c8ff" />
              <stop offset="100%" stopColor="#1a5a8a" />
            </linearGradient>
            <radialGradient id={`${uid}-well`} cx="50%" cy="55%" r="55%">
              <stop offset="0%" stopColor="#040810" />
              <stop offset="70%" stopColor="#101c2c" />
              <stop offset="100%" stopColor="#243850" />
            </radialGradient>
            <filter
              id={`${uid}-blur-soft`}
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
            >
              <feGaussianBlur stdDeviation="3" />
            </filter>
            <filter
              id={`${uid}-blur-strip`}
              x="-80%"
              y="-200%"
              width="260%"
              height="500%"
            >
              <feGaussianBlur stdDeviation="4.5" />
            </filter>
            <filter
              id={`${uid}-bloom`}
              x="-120%"
              y="-120%"
              width="340%"
              height="340%"
            >
              <feGaussianBlur stdDeviation="7" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* SVG ground contact */}
          <ellipse
            cx={CX}
            cy="128"
            rx="118"
            ry="6"
            fill="rgba(0,0,0,0.55)"
            filter={`url(#${uid}-blur-soft)`}
          />
          <ellipse
            cx={CX}
            cy="126"
            rx="82"
            ry="3"
            fill="rgba(0,0,0,0.32)"
            filter={`url(#${uid}-blur-soft)`}
          />

          {/* Outer rim / base */}
          <ellipse
            cx={CX}
            cy={RIM_CY + 1}
            rx={RIM_RX + 3}
            ry={RIM_RY + 2}
            fill="#060a10"
          />
          <ellipse
            cx={CX}
            cy={RIM_CY}
            rx={RIM_RX}
            ry={RIM_RY}
            fill={`url(#${uid}-rim)`}
          />

          {/* Side wall segments */}
          {Array.from({ length: SEGMENTS }, (_, i) => (
            <path
              key={`side-${i}`}
              d={sideSegmentPath(i, SEGMENTS)}
              fill={i % 2 === 0 ? '#161e2a' : '#222c3a'}
              stroke="rgba(0,0,0,0.45)"
              strokeWidth="0.35"
            />
          ))}

          {/* Side glow strips — reference red accents */}
          <rect
            x="38"
            y="62"
            width="28"
            height="5"
            rx="2.5"
            fill={`url(#${uid}-strip)`}
            filter={`url(#${uid}-blur-strip)`}
            className={
              motionOn
                ? 'hero-projector-puck__strip hero-projector-puck__strip--l'
                : undefined
            }
          />
          <rect
            x="254"
            y="62"
            width="28"
            height="5"
            rx="2.5"
            fill={`url(#${uid}-strip)`}
            filter={`url(#${uid}-blur-strip)`}
            className={
              motionOn
                ? 'hero-projector-puck__strip hero-projector-puck__strip--r'
                : undefined
            }
          />
          <rect
            x="38"
            y="62"
            width="28"
            height="5"
            rx="2.5"
            fill={`url(#${uid}-strip)`}
            opacity="0.92"
          />
          <rect
            x="254"
            y="62"
            width="28"
            height="5"
            rx="2.5"
            fill={`url(#${uid}-strip)`}
            opacity="0.92"
          />

          {/* Front blue status indicators */}
          <rect
            x="152"
            y="58"
            width="4"
            height="14"
            rx="1.5"
            fill="#3ecbff"
            opacity="0.85"
          />
          <rect
            x="158"
            y="58"
            width="4"
            height="14"
            rx="1.5"
            fill="#3ecbff"
            opacity="0.85"
          />
          <rect
            x="151"
            y="57"
            width="6"
            height="16"
            rx="2"
            fill="#5ee7ff"
            opacity="0.35"
            filter={`url(#${uid}-blur-soft)`}
          />
          <rect
            x="157"
            y="57"
            width="6"
            height="16"
            rx="2"
            fill="#5ee7ff"
            opacity="0.35"
            filter={`url(#${uid}-blur-soft)`}
          />

          {/* Top deck */}
          <ellipse
            cx={CX}
            cy={TOP_CY + 0.5}
            rx={TOP_RX + 2}
            ry={TOP_RY + 1.5}
            fill="#0c121a"
          />
          {Array.from({ length: SEGMENTS }, (_, i) => (
            <path
              key={`top-${i}`}
              d={topSegmentPath(i, SEGMENTS)}
              fill={
                i % 2 === 0
                  ? `url(#${uid}-panel-light)`
                  : `url(#${uid}-panel-dark)`
              }
              stroke="rgba(0,0,0,0.22)"
              strokeWidth="0.4"
            />
          ))}

          {/* Machined ring lines */}
          {[0.92, 0.78, 0.64].map((scale) => (
            <ellipse
              key={scale}
              cx={CX}
              cy={TOP_CY + 0.5}
              rx={TOP_RX * scale}
              ry={TOP_RY * scale}
              stroke="rgba(0,0,0,0.18)"
              strokeWidth="0.45"
            />
          ))}

          {/* Vents on front arc */}
          {[-48, -24, 24, 48].map((ox) => (
            <rect
              key={ox}
              x={CX + ox - 4}
              y={TOP_CY + 8}
              width="8"
              height="3"
              rx="1"
              fill="rgba(0,0,0,0.35)"
            />
          ))}

          {/* Projector well + lens */}
          <ellipse
            cx={CX}
            cy={TOP_CY + 1}
            rx="38"
            ry="11"
            fill={`url(#${uid}-well)`}
          />
          <ellipse
            cx={CX}
            cy={TOP_CY + 1}
            rx="38"
            ry="11"
            stroke="rgba(94,231,255,0.2)"
            strokeWidth="0.75"
            className={motionOn ? 'hero-projector-puck__well-ring' : undefined}
          />
          <circle
            cx={CX}
            cy={TOP_CY}
            r="15"
            fill={`url(#${uid}-lens)`}
            filter={`url(#${uid}-bloom)`}
            className={motionOn ? 'hero-projector-puck__core' : undefined}
          />
          <circle
            cx={CX}
            cy={TOP_CY}
            r="15"
            fill="none"
            stroke="rgba(255,255,255,0.25)"
            strokeWidth="0.65"
          />
          <circle
            cx={CX}
            cy={TOP_CY}
            r="6.5"
            fill="#ffffff"
            className={motionOn ? 'hero-projector-puck__core-hot' : undefined}
          />
          <circle cx={CX} cy={TOP_CY} r="2.2" fill="#ffffff" />

          {/* Top specular */}
          <ellipse
            cx={CX - 42}
            cy={TOP_CY - 6}
            rx="36"
            ry="8"
            fill="rgba(255,255,255,0.14)"
          />
        </svg>
      </div>
    </div>
  )
}
