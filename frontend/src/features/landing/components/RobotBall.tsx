import { useId } from 'react'

type RobotBallProps = {
  size?: number
}

/** Sci-fi focus drone — white armor plates, central blue projector lens, red accent strips. */
export function RobotBall({ size = 90 }: RobotBallProps) {
  const uid = useId().replace(/:/g, '')

  const panelStroke = '#080a0e'
  const groove = 'rgba(8,10,14,0.85)'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ display: 'block', overflow: 'visible' }}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`${uid}-shell`} cx="38%" cy="30%" r="68%">
          <stop offset="0%" stopColor="#f0f3f7" />
          <stop offset="45%" stopColor="#d4dae2" />
          <stop offset="100%" stopColor="#8e98a8" />
        </radialGradient>
        <radialGradient id={`${uid}-plate-a`} cx="42%" cy="32%" r="65%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#e2e8ef" />
          <stop offset="100%" stopColor="#a8b2c0" />
        </radialGradient>
        <radialGradient id={`${uid}-plate-b`} cx="58%" cy="68%" r="60%">
          <stop offset="0%" stopColor="#eef1f5" />
          <stop offset="100%" stopColor="#9aa5b4" />
        </radialGradient>
        <radialGradient id={`${uid}-recess`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#141820" />
          <stop offset="100%" stopColor="#06080c" />
        </radialGradient>
        <radialGradient id={`${uid}-housing`} cx="48%" cy="44%" r="55%">
          <stop offset="0%" stopColor="#2a3038" />
          <stop offset="100%" stopColor="#0a0c10" />
        </radialGradient>
        <radialGradient id={`${uid}-iris`} cx="46%" cy="42%" r="58%">
          <stop offset="0%" stopColor="#5ec8ff" />
          <stop offset="28%" stopColor="#1a78e8" />
          <stop offset="62%" stopColor="#0a3888" />
          <stop offset="100%" stopColor="#020818" />
        </radialGradient>
        <radialGradient id={`${uid}-core`} cx="44%" cy="40%" r="52%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="22%" stopColor="#c8f0ff" />
          <stop offset="55%" stopColor="#38b8ff" />
          <stop offset="100%" stopColor="#0848a0" />
        </radialGradient>
        <radialGradient id={`${uid}-spec`} cx="32%" cy="26%" r="48%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <linearGradient id={`${uid}-red`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,40,60,0)" />
          <stop offset="20%" stopColor="#ff2848" />
          <stop offset="50%" stopColor="#ff5570" />
          <stop offset="80%" stopColor="#ff2848" />
          <stop offset="100%" stopColor="rgba(255,40,60,0)" />
        </linearGradient>
        <filter
          id={`${uid}-bloom`}
          x="-80%"
          y="-80%"
          width="260%"
          height="260%"
        >
          <feGaussianBlur stdDeviation="2.8" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter
          id={`${uid}-led`}
          x="-100%"
          y="-100%"
          width="300%"
          height="300%"
        >
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
        <filter
          id={`${uid}-red-glow`}
          x="-50%"
          y="-200%"
          width="200%"
          height="500%"
        >
          <feGaussianBlur stdDeviation="1.8" />
        </filter>
        <clipPath id={`${uid}-clip`}>
          <circle cx="50" cy="50" r="46" />
        </clipPath>
      </defs>

      {/* Shadow under-sphere */}
      <ellipse
        cx="50"
        cy="92"
        rx="28"
        ry="5"
        fill="rgba(0,0,0,0.45)"
        opacity="0.6"
      />

      {/* Base sphere */}
      <circle cx="50" cy="50" r="46" fill={`url(#${uid}-shell)`} />
      <circle
        cx="50"
        cy="50"
        r="46"
        fill={`url(#${uid}-recess)`}
        opacity="0.35"
      />

      <g clipPath={`url(#${uid}-clip)`}>
        {/* White armor gores */}
        <path
          d="M 28,11 Q 50,5 72,11 Q 67,28 58,34 Q 50,27 42,34 Q 33,28 28,11Z"
          fill={`url(#${uid}-plate-a)`}
          stroke={panelStroke}
          strokeWidth="0.7"
        />
        <path
          d="M 27,89 Q 50,95 73,89 Q 68,72 59,66 Q 50,73 41,66 Q 32,72 27,89Z"
          fill={`url(#${uid}-plate-b)`}
          stroke={panelStroke}
          strokeWidth="0.7"
        />
        <path
          d="M 71,11 Q 93,27 96,50 Q 83,54 75,48 Q 77,34 67,22 Z"
          fill={`url(#${uid}-plate-a)`}
          stroke={panelStroke}
          strokeWidth="0.7"
        />
        <path
          d="M 96,50 Q 93,73 71,89 Q 67,77 75,65 Q 83,59 75,48 Z"
          fill={`url(#${uid}-plate-b)`}
          stroke={panelStroke}
          strokeWidth="0.7"
        />
        <path
          d="M 29,11 Q 7,27 4,50 Q 17,54 25,48 Q 23,34 33,22 Z"
          fill={`url(#${uid}-plate-a)`}
          stroke={panelStroke}
          strokeWidth="0.7"
        />
        <path
          d="M 4,50 Q 7,73 29,89 Q 33,77 25,65 Q 17,59 25,48 Z"
          fill={`url(#${uid}-plate-b)`}
          stroke={panelStroke}
          strokeWidth="0.7"
        />

        {/* Dark mechanical channels */}
        <path
          d="M 28,11 Q 50,5 72,11"
          fill="none"
          stroke={groove}
          strokeWidth="1.8"
        />
        <path
          d="M 27,89 Q 50,95 73,89"
          fill="none"
          stroke={groove}
          strokeWidth="1.8"
        />
        <path
          d="M 71,11 Q 93,27 96,50"
          fill="none"
          stroke={groove}
          strokeWidth="1.4"
        />
        <path
          d="M 4,50 Q 7,27 29,11"
          fill="none"
          stroke={groove}
          strokeWidth="1.4"
        />
        <path
          d="M 96,50 Q 93,73 71,89"
          fill="none"
          stroke={groove}
          strokeWidth="1.4"
        />
        <path
          d="M 4,50 Q 7,73 29,89"
          fill="none"
          stroke={groove}
          strokeWidth="1.4"
        />

        {/* Vents / micro detail */}
        {[22, 78].map((x) => (
          <g key={x} opacity="0.55">
            {[44, 48, 52, 56].map((y) => (
              <rect
                key={y}
                x={x}
                y={y}
                width="2.2"
                height="0.9"
                rx="0.3"
                fill="#0c1018"
              />
            ))}
          </g>
        ))}

        {/* Red accent strips — equator */}
        <path
          d="M 6,50 Q 28,47 50,50 Q 72,53 94,50"
          fill="none"
          stroke={`url(#${uid}-red)`}
          strokeWidth="2.4"
          strokeLinecap="round"
          filter={`url(#${uid}-red-glow)`}
          opacity="0.95"
        />
        {/* Red vertical arcs */}
        <path
          d="M 18,28 Q 14,50 18,72"
          fill="none"
          stroke="#ff3355"
          strokeWidth="1.8"
          strokeLinecap="round"
          filter={`url(#${uid}-red-glow)`}
          opacity="0.85"
        />
        <path
          d="M 82,28 Q 86,50 82,72"
          fill="none"
          stroke="#ff3355"
          strokeWidth="1.8"
          strokeLinecap="round"
          filter={`url(#${uid}-red-glow)`}
          opacity="0.85"
        />

        {/* Specular highlight */}
        <ellipse cx="36" cy="26" rx="20" ry="12" fill={`url(#${uid}-spec)`} />
      </g>

      {/* Secondary blue status LEDs */}
      {(
        [
          [34, 38],
          [66, 38],
          [34, 62],
          [66, 62],
          [50, 22],
          [50, 78],
        ] as const
      ).map(([x, y], i) => (
        <rect
          key={i}
          x={x - 1.6}
          y={y - 0.7}
          width="3.2"
          height="1.4"
          rx="0.4"
          fill="#4dc8ff"
          filter={`url(#${uid}-led)`}
          opacity="0.9"
        />
      ))}

      {/* ─── Central focus projector lens ─── */}
      <circle cx="50" cy="50" r="23" fill={`url(#${uid}-housing)`} />
      <circle
        cx="50"
        cy="50"
        r="23"
        fill="none"
        stroke="#1a2028"
        strokeWidth="2"
      />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
        const r = (deg * Math.PI) / 180
        return (
          <circle
            key={i}
            cx={50 + 20.5 * Math.cos(r)}
            cy={50 + 20.5 * Math.sin(r)}
            r="0.85"
            fill="#3a4450"
          />
        )
      })}
      <circle cx="50" cy="50" r="17.5" fill="#080c14" />
      <circle
        cx="50"
        cy="50"
        r="17.5"
        fill="none"
        stroke="#1e2838"
        strokeWidth="1.2"
      />
      <circle cx="50" cy="50" r="14" fill={`url(#${uid}-iris)`} />
      <circle
        cx="50"
        cy="50"
        r="14"
        fill="none"
        stroke="#2088ff"
        strokeWidth="0.7"
        opacity="0.6"
      />
      {/* Focus rings */}
      {[11.5, 8.5, 5.5].map((r) => (
        <circle
          key={r}
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="rgba(94,200,255,0.22)"
          strokeWidth="0.45"
        />
      ))}
      <circle
        cx="50"
        cy="50"
        r="9"
        fill="none"
        stroke="#40a8ff"
        strokeWidth="1.4"
        className="robot-ball__focus-ring"
        filter={`url(#${uid}-bloom)`}
      />
      <circle
        cx="50"
        cy="50"
        r="6.2"
        fill={`url(#${uid}-core)`}
        className="robot-ball__focus-core"
        filter={`url(#${uid}-bloom)`}
      />
      <circle
        cx="50"
        cy="50"
        r="2.4"
        fill="#ffffff"
        className="robot-ball__focus-hot"
      />
      <ellipse
        cx="46"
        cy="46"
        rx="2.2"
        ry="1.4"
        fill="rgba(255,255,255,0.75)"
        transform="rotate(-25,46,46)"
      />

      {/* Horizontal lens flare */}
      <ellipse
        cx="50"
        cy="50"
        rx="26"
        ry="2.2"
        fill="rgba(120,220,255,0.12)"
        filter={`url(#${uid}-bloom)`}
      />

      {/* Outer rim */}
      <circle
        cx="50"
        cy="50"
        r="46"
        fill="none"
        stroke="rgba(180,200,220,0.35)"
        strokeWidth="1"
      />
    </svg>
  )
}
