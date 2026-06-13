import { useId } from 'react'

/** Zopkit holographic palette — aligned with puck + hero cyan. */
const CYAN = '#4dc8ff'
const CYAN_BRIGHT = '#5ee7ff'
const CYAN_DIM = '#2e8cb8'
const NAVY_DEEP = '#060e1c'
const NAVY_MID = '#122848'
const NAVY_PANEL = '#1a3558'
const NAVY_BAND = '#0c1628'

type RobotBallProps = {
  size?: number
}

/** Panelled sphere — navy metallic shell, cyan rim LEDs, holographic eye. */
export function RobotBall({ size = 90 }: RobotBallProps) {
  const uid = useId().replace(/:/g, '')

  const rimLights = [
    { x: 50, y: 11, w: 16, h: 3.2 },
    { x: 50, y: 86, w: 16, h: 3.2 },
    { x: 11, y: 50, w: 3.2, h: 16 },
    { x: 86, y: 50, w: 3.2, h: 16 },
  ] as const

  const cyanAccents = [
    { x: 32, y: 28, w: 5, h: 2 },
    { x: 62, y: 30, w: 4, h: 1.8 },
    { x: 28, y: 62, w: 4.5, h: 2 },
    { x: 64, y: 66, w: 5, h: 2 },
    { x: 38, y: 72, w: 3.5, h: 1.6 },
    { x: 70, y: 38, w: 3.5, h: 1.6 },
  ] as const

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ display: 'block', overflow: 'visible' }}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`${uid}-shell`} cx="38%" cy="28%" r="68%">
          <stop offset="0%" stopColor="#3d6a9a" />
          <stop offset="38%" stopColor="#1a3558" />
          <stop offset="72%" stopColor="#122848" />
          <stop offset="100%" stopColor={NAVY_DEEP} />
        </radialGradient>
        <radialGradient id={`${uid}-panel`} cx="45%" cy="38%" r="55%">
          <stop offset="0%" stopColor="#2f5688" />
          <stop offset="100%" stopColor={NAVY_PANEL} />
        </radialGradient>
        <linearGradient id={`${uid}-band-v`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={NAVY_DEEP} />
          <stop offset="18%" stopColor={NAVY_BAND} />
          <stop offset="50%" stopColor="#142a48" />
          <stop offset="82%" stopColor={NAVY_BAND} />
          <stop offset="100%" stopColor={NAVY_DEEP} />
        </linearGradient>
        <linearGradient id={`${uid}-band-h`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={NAVY_DEEP} />
          <stop offset="50%" stopColor={NAVY_MID} />
          <stop offset="100%" stopColor={NAVY_DEEP} />
        </linearGradient>
        <radialGradient id={`${uid}-iris`} cx="48%" cy="42%" r="58%">
          <stop offset="0%" stopColor="#d8f8ff" />
          <stop offset="22%" stopColor={CYAN} />
          <stop offset="55%" stopColor="#1a4a88" />
          <stop offset="100%" stopColor={NAVY_DEEP} />
        </radialGradient>
        <radialGradient id={`${uid}-core`} cx="46%" cy="40%" r="50%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="35%" stopColor="#e8fcff" />
          <stop offset="100%" stopColor={CYAN} />
        </radialGradient>
        <linearGradient id={`${uid}-rim`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f0fcff" />
          <stop offset="50%" stopColor={CYAN_BRIGHT} />
          <stop offset="100%" stopColor={CYAN_DIM} />
        </linearGradient>
        <linearGradient id={`${uid}-accent`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f8feff" />
          <stop offset="100%" stopColor={CYAN} />
        </linearGradient>
        <radialGradient id={`${uid}-shine`} cx="32%" cy="22%" r="48%">
          <stop offset="0%" stopColor="rgba(94,231,255,0.22)" />
          <stop offset="100%" stopColor="rgba(94,231,255,0)" />
        </radialGradient>
        <filter
          id={`${uid}-cyan-glow`}
          x="-120%"
          y="-120%"
          width="340%"
          height="340%"
        >
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter
          id={`${uid}-lens-glow`}
          x="-100%"
          y="-100%"
          width="300%"
          height="300%"
        >
          <feGaussianBlur stdDeviation="3.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`${uid}-soft`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.6" />
        </filter>
        <clipPath id={`${uid}-clip`}>
          <circle cx="50" cy="50" r="46" />
        </clipPath>
      </defs>

      <circle cx="50" cy="50" r="46" fill={`url(#${uid}-shell)`} />
      <circle cx="50" cy="50" r="46" fill={`url(#${uid}-shine)`} />

      <g clipPath={`url(#${uid}-clip)`}>
        <rect
          x="44"
          y="4"
          width="12"
          height="92"
          fill={`url(#${uid}-band-v)`}
          opacity="0.95"
        />
        <rect
          x="4"
          y="44"
          width="92"
          height="12"
          fill={`url(#${uid}-band-h)`}
          opacity="0.95"
        />

        <path
          d="M 8 8 Q 50 6 92 8 Q 88 44 50 44 Q 12 44 8 8 Z"
          fill={`url(#${uid}-panel)`}
          stroke="rgba(94,231,255,0.14)"
          strokeWidth="0.45"
        />
        <path
          d="M 8 92 Q 50 94 92 92 Q 88 56 50 56 Q 12 56 8 92 Z"
          fill={`url(#${uid}-panel)`}
          stroke="rgba(94,231,255,0.14)"
          strokeWidth="0.45"
        />
        <path
          d="M 8 8 Q 6 50 8 92 Q 44 88 44 50 Q 44 12 8 8 Z"
          fill={`url(#${uid}-panel)`}
          stroke="rgba(94,231,255,0.14)"
          strokeWidth="0.45"
        />
        <path
          d="M 92 8 Q 94 50 92 92 Q 56 88 56 50 Q 56 12 92 8 Z"
          fill={`url(#${uid}-panel)`}
          stroke="rgba(94,231,255,0.14)"
          strokeWidth="0.45"
        />

        {[
          [50, 22],
          [50, 78],
          [22, 50],
          [78, 50],
          [30, 30],
          [70, 30],
          [30, 70],
          [70, 70],
        ].map(([cx, cy], i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r="0.85"
            fill="#1a3558"
            stroke="rgba(94,231,255,0.2)"
            strokeWidth="0.3"
          />
        ))}
        <path
          d="M 18 18 L 32 32 M 68 18 L 82 32 M 18 82 L 32 68 M 68 82 L 82 68"
          stroke="rgba(94,231,255,0.1)"
          strokeWidth="0.5"
        />

        {cyanAccents.map(({ x, y, w, h }, i) => (
          <rect
            key={i}
            x={x - w / 2}
            y={y - h / 2}
            width={w}
            height={h}
            rx="0.6"
            fill={`url(#${uid}-accent)`}
            opacity="0.8"
            filter={`url(#${uid}-soft)`}
          />
        ))}
      </g>

      {rimLights.map(({ x, y, w, h }, i) => (
        <g key={i} filter={`url(#${uid}-cyan-glow)`}>
          <rect
            x={x - w / 2}
            y={y - h / 2}
            width={w}
            height={h}
            rx="1"
            fill={NAVY_DEEP}
          />
          <rect
            x={x - w / 2 + 0.6}
            y={y - h / 2 + 0.5}
            width={w - 1.2}
            height={h - 1}
            rx="0.8"
            fill={`url(#${uid}-rim)`}
          />
        </g>
      ))}

      <circle cx="50" cy="50" r="22" fill={NAVY_MID} />
      <circle
        cx="50"
        cy="50"
        r="22"
        fill="none"
        stroke="rgba(94,231,255,0.28)"
        strokeWidth="1.8"
      />
      {([0, 45, 90, 135, 180, 225, 270, 315] as const).map((deg, i) => {
        const r = (deg * Math.PI) / 180
        return (
          <circle
            key={i}
            cx={50 + 19 * Math.cos(r)}
            cy={50 + 19 * Math.sin(r)}
            r="0.75"
            fill="#224a72"
          />
        )
      })}
      <circle cx="50" cy="50" r="17" fill={NAVY_DEEP} />
      <circle
        cx="50"
        cy="50"
        r="17"
        fill="none"
        stroke="rgba(94,231,255,0.18)"
        strokeWidth="1.2"
      />
      <circle cx="50" cy="50" r="13.5" fill={`url(#${uid}-iris)`} />
      <circle
        cx="50"
        cy="50"
        r="13.5"
        fill="none"
        stroke={CYAN}
        strokeWidth="0.7"
        opacity="0.65"
        filter={`url(#${uid}-lens-glow)`}
        className="robot-ball__iris-ring"
      />
      <circle cx="50" cy="50" r="8" fill="#030810" />
      <circle
        cx="50"
        cy="50"
        r="6.5"
        fill={`url(#${uid}-core)`}
        filter={`url(#${uid}-lens-glow)`}
        className="robot-ball__core"
      />
      <circle
        cx="50"
        cy="50"
        r="2.4"
        fill="#ffffff"
        className="robot-ball__core-hot"
      />

      <ellipse
        cx="50"
        cy="50"
        rx="28"
        ry="2.2"
        fill="rgba(94,231,255,0.35)"
        filter={`url(#${uid}-soft)`}
      />
      <ellipse cx="50" cy="50" rx="14" ry="1" fill="rgba(255,255,255,0.55)" />

      <ellipse
        cx="36"
        cy="28"
        rx="18"
        ry="11"
        fill="rgba(94,231,255,0.12)"
        transform="rotate(-20, 36, 28)"
        clipPath={`url(#${uid}-clip)`}
      />
      <circle
        cx="50"
        cy="50"
        r="46"
        fill="none"
        stroke="rgba(94,231,255,0.32)"
        strokeWidth="0.85"
      />
      <circle
        cx="50"
        cy="50"
        r="46"
        fill="none"
        stroke="rgba(0,0,0,0.35)"
        strokeWidth="1"
      />
    </svg>
  )
}
