import { motion } from 'framer-motion'

// ─── Shared keyframes ──────────────────────────────────────────────────────────
const PROJECTOR_STYLES = `
  @keyframes data-flow-up   { to { stroke-dashoffset: 9; } }
  @keyframes pp-float       { 0%,100%{ transform:translateY(0px) }  50%{ transform:translateY(-5px) } }
  @keyframes pp-lens-glow   {
    0%,100%{ box-shadow:0 0 0 3px rgba(27,46,90,1), 0 0 24px 8px rgba(36,59,110,0.95), 0 0 60px 16px rgba(27,46,90,0.55), 0 0 110px 26px rgba(15,27,61,0.25) }
    50%{     box-shadow:0 0 0 5px rgba(46,79,140,1), 0 0 38px 14px rgba(46,79,140,1),   0 0 90px 24px rgba(36,59,110,0.70), 0 0 170px 38px rgba(27,46,90,0.38) }
  }
  @keyframes pp-hotspot     { 0%,100%{ opacity:0.85; filter:blur(1px); transform:scale(1) } 50%{ opacity:1; filter:blur(0px); transform:scale(1.18) } }
  @keyframes pp-ring-out    { 0%{ transform:scale(0.5); opacity:0.8 } 100%{ transform:scale(4.5); opacity:0 } }
  @keyframes pp-cone-breath { 0%,100%{ opacity:1 } 50%{ opacity:0.82 } }
  @keyframes pp-floor-pulse { 0%,100%{ opacity:0.6 } 50%{ opacity:1 } }
  @keyframes pp-scan        { 0%{ top:-6% } 100%{ top:106% } }
  @keyframes conn-flow      { from { stroke-dashoffset: 18 } to { stroke-dashoffset: 0 } }
  @keyframes rb-lens-pulse  {
    0%,100% { opacity:1; }
    50%     { opacity:0.72; }
  }
  @keyframes rb-core-pulse  {
    0%,100% { r:5; opacity:1; }
    50%     { r:6.5; opacity:0.8; }
  }
`

// ─── Agent data ────────────────────────────────────────────────────────────────
const AGENTS = [
  { id: 1, source: 'B2B CRM',     color: '#3b82f6', metric1: '342 Leads',     metric2: '₹12.4M pipeline', bars: [0.5,0.7,0.55,0.85,0.65], progress: 87 },
  { id: 2, source: 'Finance',     color: '#10b981', metric1: '₹84.2L Rev',    metric2: '100% GST filed',  bars: [0.4,0.65,0.8,0.9,0.75],  progress: 94 },
  { id: 3, source: 'Operations',  color: '#f59e0b', metric1: '1,247 SKUs',    metric2: '34 Orders today', bars: [0.7,0.5,0.85,0.6,0.45],  progress: 72 },
  { id: 4, source: 'HRMS',        color: '#8b5cf6', metric1: '284 Employees', metric2: '98% Attendance',  bars: [0.6,0.75,0.65,0.7,0.9],  progress: 91 },
  { id: 5, source: 'Projects',    color: '#06b6d4', metric1: '47 Projects',   metric2: '12 Due this week',bars: [0.45,0.6,0.8,0.55,0.75], progress: 68 },
] as const

const SIDEBAR_ITEMS = [
  { color: '#3b82f6', active: false },
  { color: '#10b981', active: false },
  { color: '#f59e0b', active: false },
  { color: '#8b5cf6', active: true  },
  { color: '#06b6d4', active: false },
  { color: '#6366f1', active: false },
  { color: '#ec4899', active: false },
  { color: '#14b8a6', active: false },
  { color: '#f97316', active: false },
  { color: '#ef4444', active: false },
  { color: '#a3e635', active: false },
]

function RobotIcon({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: 'block', flexShrink: 0 }}>
      <line x1="12" y1="1.5" x2="12" y2="4.2" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="12" cy="1.2" r="1.2" fill={color} />
      <rect x="3" y="4.2" width="18" height="13.5" rx="3.2" fill="#0d1120" stroke={color} strokeWidth="1" />
      <rect x="1" y="8" width="2" height="5" rx="1" fill={color} opacity="0.45" />
      <rect x="21" y="8" width="2" height="5" rx="1" fill={color} opacity="0.45" />
      <rect x="5" y="6.8" width="14" height="5.5" rx="1.5" fill={color} fillOpacity="0.1" stroke={color} strokeWidth="0.5" strokeOpacity="0.5" />
      <polyline points="6.5,9.5 8,9.5 9,7.6 10.2,11.5 11.4,8.2 12.5,10.5 13.6,9.5 17.5,9.5" stroke={color} fill="none" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="9" y="14.8" width="6" height="1.2" rx="0.6" fill={color} opacity="0.4" />
    </svg>
  )
}

const TX = (color = 'rgba(255,255,255,0.85)', size = 8, weight = 500) => ({
  fontSize: size, fontWeight: weight, color,
  fontFamily: '"SF Mono","Fira Code","Roboto Mono",monospace',
  lineHeight: 1.3, letterSpacing: '0.02em',
})

// ─── Robot ball — detailed SVG: paneled sphere, multi-ring camera lens, neon circuits ─
function RobotBall() {
  return (
    <svg width="90" height="90" viewBox="0 0 100 100" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        {/* Base sphere shading */}
        <radialGradient id="rb-body" cx="36%" cy="28%" r="68%">
          <stop offset="0%"   stopColor="#5a6070"/>
          <stop offset="22%"  stopColor="#282e38"/>
          <stop offset="55%"  stopColor="#181c24"/>
          <stop offset="100%" stopColor="#080a0e"/>
        </radialGradient>
        {/* Panel fill — slightly different shade for depth */}
        <radialGradient id="rb-panel-a" cx="50%" cy="40%" r="60%">
          <stop offset="0%"   stopColor="#20252e"/>
          <stop offset="100%" stopColor="#0d1016"/>
        </radialGradient>
        <radialGradient id="rb-panel-b" cx="50%" cy="60%" r="60%">
          <stop offset="0%"   stopColor="#1a1e26"/>
          <stop offset="100%" stopColor="#0a0c12"/>
        </radialGradient>
        {/* Lens outer housing */}
        <radialGradient id="rb-lens-housing" cx="42%" cy="34%" r="60%">
          <stop offset="0%"   stopColor="#38404e"/>
          <stop offset="100%" stopColor="#0c0e14"/>
        </radialGradient>
        {/* Lens inner iris */}
        <radialGradient id="rb-iris" cx="40%" cy="35%" r="65%">
          <stop offset="0%"   stopColor="#4090e0"/>
          <stop offset="20%"  stopColor="#1050c0"/>
          <stop offset="50%"  stopColor="#071a60"/>
          <stop offset="80%"  stopColor="#030d30"/>
          <stop offset="100%" stopColor="#010510"/>
        </radialGradient>
        {/* Lens core glow */}
        <radialGradient id="rb-core" cx="45%" cy="38%" r="55%">
          <stop offset="0%"   stopColor="#a8d4ff"/>
          <stop offset="30%"  stopColor="#3080ff"/>
          <stop offset="70%"  stopColor="#0830a0"/>
          <stop offset="100%" stopColor="#020818"/>
        </radialGradient>
        {/* Small side sensor */}
        <radialGradient id="rb-sensor" cx="40%" cy="35%" r="60%">
          <stop offset="0%"   stopColor="#4a6080"/>
          <stop offset="55%"  stopColor="#162030"/>
          <stop offset="100%" stopColor="#080e18"/>
        </radialGradient>
        {/* Top specular */}
        <radialGradient id="rb-spec" cx="42%" cy="32%" r="55%">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.28)"/>
          <stop offset="60%"  stopColor="rgba(200,220,255,0.06)"/>
          <stop offset="100%" stopColor="rgba(255,255,255,0)"/>
        </radialGradient>
        {/* Neon blue glow filter */}
        <filter id="rb-neon" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="1.2" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        {/* Soft lens glow */}
        <filter id="rb-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.5" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        {/* Clip to sphere */}
        <clipPath id="rb-clip"><circle cx="50" cy="50" r="46"/></clipPath>
      </defs>

      {/* ── 1. Base sphere ── */}
      <circle cx="50" cy="50" r="46" fill="url(#rb-body)"/>

      {/* ── 2. Armored panel segments (clipped) ── */}
      <g clipPath="url(#rb-clip)" opacity="0.92">
        {/* Top-center panel */}
        <path d="M 28,10 Q 50,4 72,10 Q 68,30 60,36 Q 50,28 40,36 Q 32,30 28,10Z"
          fill="url(#rb-panel-a)" stroke="#06080d" strokeWidth="0.9"/>
        {/* Bottom-center panel */}
        <path d="M 26,90 Q 50,96 74,90 Q 70,70 62,64 Q 50,72 38,64 Q 30,70 26,90Z"
          fill="url(#rb-panel-b)" stroke="#06080d" strokeWidth="0.9"/>
        {/* Upper-right panel */}
        <path d="M 70,10 Q 92,26 95,50 Q 82,54 74,48 Q 76,34 66,22 Z"
          fill="url(#rb-panel-a)" stroke="#06080d" strokeWidth="0.9"/>
        {/* Lower-right panel */}
        <path d="M 95,50 Q 92,74 70,90 Q 66,78 74,66 Q 82,60 74,48 Z"
          fill="url(#rb-panel-b)" stroke="#06080d" strokeWidth="0.9"/>
        {/* Upper-left panel */}
        <path d="M 30,10 Q 8,26 5,50 Q 18,54 26,48 Q 24,34 34,22 Z"
          fill="url(#rb-panel-a)" stroke="#06080d" strokeWidth="0.9"/>
        {/* Lower-left panel */}
        <path d="M 5,50 Q 8,74 30,90 Q 34,78 26,66 Q 18,60 26,48 Z"
          fill="url(#rb-panel-b)" stroke="#06080d" strokeWidth="0.9"/>
        {/* Seam highlight lines — thin bright edge on each panel */}
        <path d="M 28,10 Q 50,4 72,10" fill="none" stroke="rgba(130,150,180,0.18)" strokeWidth="0.7"/>
        <path d="M 70,10 Q 92,26 95,50"  fill="none" stroke="rgba(130,150,180,0.12)" strokeWidth="0.7"/>
        <path d="M 5,50  Q 8,26  30,10"  fill="none" stroke="rgba(130,150,180,0.12)" strokeWidth="0.7"/>
      </g>

      {/* ── 3. Neon circuit traces ── */}
      <g filter="url(#rb-neon)" stroke="#1a90ff" strokeWidth="0.75" fill="none" strokeLinecap="square">
        {/* Horizontal bridge from sensor to lens area */}
        <path d="M 36,50 L 42,50"/>
        <path d="M 36,46 L 39,46 L 39,42 L 44,42"/>
        {/* Upper branch */}
        <path d="M 46,37 L 46,32 L 52,32 L 52,36"/>
        <path d="M 54,32 L 58,32 L 58,36"/>
        {/* Lower branch */}
        <path d="M 46,63 L 46,68 L 52,68 L 52,64"/>
        <path d="M 54,68 L 58,68 L 58,64"/>
        {/* Right side micro traces */}
        <path d="M 56,39 L 60,36 L 66,36"/>
        <path d="M 56,61 L 60,64 L 66,64"/>
        {/* Junction dots */}
        <circle cx="52" cy="32" r="1.1" fill="#1a90ff" stroke="none"/>
        <circle cx="58" cy="32" r="0.9" fill="#1a90ff" stroke="none"/>
        <circle cx="52" cy="68" r="1.1" fill="#1a90ff" stroke="none"/>
        <circle cx="58" cy="68" r="0.9" fill="#1a90ff" stroke="none"/>
        <circle cx="39" cy="46" r="0.9" fill="#1a90ff" stroke="none"/>
        <circle cx="46" cy="42" r="0.9" fill="#1a90ff" stroke="none"/>
        <circle cx="66" cy="36" r="0.9" fill="#1a90ff" stroke="none"/>
        <circle cx="66" cy="64" r="0.9" fill="#1a90ff" stroke="none"/>
      </g>

      {/* ── 4. Small side sensor (left) ── */}
      <circle cx="27" cy="50" r="11" fill="url(#rb-sensor)"/>
      <circle cx="27" cy="50" r="11" fill="none" stroke="#1a2840" strokeWidth="1.8"/>
      <circle cx="27" cy="50" r="7.5" fill="none" stroke="#243258" strokeWidth="1"/>
      <circle cx="27" cy="50" r="4.5" fill="#0c1220"/>
      <circle cx="27" cy="50" r="4.5" fill="none" stroke="#304878" strokeWidth="0.6"/>
      <circle cx="24.5" cy="47.5" r="1.8" fill="rgba(140,180,230,0.45)"/>

      {/* ── 5. Main camera lens ── */}
      {/* Outer housing ring */}
      <circle cx="62" cy="50" r="21" fill="url(#rb-lens-housing)"/>
      <circle cx="62" cy="50" r="21" fill="none" stroke="#1e2530" strokeWidth="2.2"/>
      {/* Bolt/rivet details at 8 positions */}
      {([0,45,90,135,180,225,270,315] as const).map((deg, i) => {
        const r = (deg * Math.PI) / 180
        return <circle key={i} cx={62 + 19.5 * Math.cos(r)} cy={50 + 19.5 * Math.sin(r)} r="0.9" fill="#2e3848"/>
      })}
      {/* Step-down ring */}
      <circle cx="62" cy="50" r="16.5" fill="#0a0d14"/>
      <circle cx="62" cy="50" r="16.5" fill="none" stroke="#182038" strokeWidth="1.4"/>
      {/* Iris */}
      <circle cx="62" cy="50" r="13" fill="url(#rb-iris)"/>
      <circle cx="62" cy="50" r="13" fill="none" stroke="#0e3080" strokeWidth="0.6"/>
      {/* Inner bright ring — glowing */}
      <circle cx="62" cy="50" r="8.5" fill="#050e28"/>
      <circle cx="62" cy="50" r="8.5" fill="none" stroke="#2060e8" strokeWidth="1.2"
        style={{ animation: 'rb-lens-pulse 2s ease-in-out infinite' }} filter="url(#rb-glow)"/>
      {/* Core glow */}
      <circle cx="62" cy="50" r="5.5" fill="url(#rb-core)"
        style={{ animation: 'rb-lens-pulse 2s ease-in-out infinite' }}/>
      {/* Micro core */}
      <circle cx="62" cy="50" r="2.2" fill="#c8e8ff" opacity="0.9"/>
      {/* Lens specular highlight */}
      <ellipse cx="57.5" cy="44.5" rx="3" ry="1.8"
        fill="rgba(210,235,255,0.55)" transform="rotate(-22,57.5,44.5)"/>

      {/* ── 6. Top specular highlight ── */}
      <ellipse cx="36" cy="24" rx="22" ry="13"
        fill="url(#rb-spec)" transform="rotate(-18,36,24)" clipPath="url(#rb-clip)"/>

      {/* ── 7. Rim light (thin bright arc at top-left) ── */}
      <circle cx="50" cy="50" r="46" fill="none"
        stroke="rgba(80,120,200,0.22)" strokeWidth="1.2" clipPath="url(#rb-clip)"/>
      <path d="M 14,28 Q 8,50 14,72" fill="none"
        stroke="rgba(100,150,230,0.18)" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

// ─── Holographic Dashboard ─────────────────────────────────────────────────────
function DashboardMock() {
  // Timeline (total ≈ 3.1s):
  //  t=0→0.72s  puck falls and lands
  //  t=0.82s    ball births at lens
  //  t=0.82→1.6s ball rises to screen centre, holds
  //  t=1.65s    shockwave rings fire
  //  t=1.97s    ball snaps hidden — screen erupts simultaneously
  //  t=1.97→2.62s screen circle-expand
  //  t=2.7s     side cards + connectors appear

  const BALL_DELAY   = 0.82
  const BALL_DUR     = 1.15
  // Screen starts at 1.80s — ball is still at ~30% opacity, but screen ease starts
  // so slowly (p1x=0.04) that the circle is essentially invisible until ball fully fades.
  // This eliminates the hard-cut glitch between ball-gone and screen-start.
  const SCREEN_DELAY = 1.80
  const SCREEN_DUR   = 0.72
  const SCREEN_EASE  = [0.04, 0.92, 0.20, 1] as [number,number,number,number]

  return (
    // Outer wrapper: transparent container — ball can live here and always be visible.
    // The frame background/shadow is a SEPARATE child layer that only appears at SCREEN_DELAY,
    // so nothing white/grey shows before the ball explodes.
    <div
      style={{
        position: 'relative',
        padding: 2,
        borderRadius: 'clamp(10px, 1vw, 16px)',
        zIndex: 4,
      }}
    >
      {/* Frame layer — background + border glow, hidden until ball explodes */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.12, delay: SCREEN_DELAY }}
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          borderRadius: 'inherit',
          background: 'linear-gradient(180deg, rgba(36,59,110,0.55) 0%, rgba(27,46,90,0.22) 50%, rgba(36,59,110,0.10) 100%)',
          boxShadow:
            '0 0 0 1px rgba(36,59,110,0.28),' +
            '0 0 40px 10px rgba(27,46,90,0.16),' +
            '0 0 80px 24px rgba(36,59,110,0.09),' +
            '0 24px 50px rgba(15,27,61,0.15)',
        }}
      />

      {/* Projection energy burst: intense border glow when screen content fires up */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: SCREEN_DUR * 1.3, delay: SCREEN_DELAY, times: [0, 0.05, 0.35, 1], ease: 'easeInOut' }}
        style={{
          position: 'absolute', inset: -4, pointerEvents: 'none',
          borderRadius: 'clamp(14px, 1.3vw, 20px)',
          boxShadow: '0 0 0 3px rgba(70,120,230,0.75), 0 0 28px 14px rgba(40,70,160,0.55), 0 0 60px 28px rgba(27,46,90,0.28)',
          zIndex: 10,
        }}
      />

      {/* ===== ROBOT BALL =====
          Rises from puck → stops at screen centre → screen BURSTS from ball position.
          Opacity stays 1 the whole time; snaps to 0 the instant screen appears. */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{
          scale:   [0,    1,    1,    1,    1   ],
          opacity: [0,    1,    1,    0,    0   ],
          y:       [64,   58,  -230, -230, -230 ],
        }}
        transition={{
          duration: BALL_DUR,
          delay: BALL_DELAY,
          // 0→0.05: pop in; 0.05→0.70: smooth throw; 0.70→0.86: gentle opacity fade; 0.86→1: gone
          times: [0, 0.05, 0.70, 0.86, 1.0],
          ease: ['easeOut', [0.33, 1, 0.68, 1], 'easeIn', 'linear'],
        }}
        style={{
          position: 'absolute',
          bottom: -6,
          left: '50%',
          x: '-50%',
          zIndex: 30,
          pointerEvents: 'none',
          /* glow corona around the robot ball */
          filter:
            'drop-shadow(0 0 10px rgba(100,180,255,0.95)) ' +
            'drop-shadow(0 0 22px rgba(60,120,220,0.70)) ' +
            'drop-shadow(0 0 44px rgba(36,80,160,0.40))',
        }}
      >
        <RobotBall />
      </motion.div>

      {/* ── Charging rings: 3 staggered pulses as ball powers up ── */}
      {([
        { t: 0, color: 'rgba(160,215,255,0.95)', glow: 'rgba(100,180,255,0.55)' },
        { t: 0.07, color: 'rgba(120,190,255,0.80)', glow: 'rgba(80,150,240,0.40)' },
        { t: 0.14, color: 'rgba(80,155,240,0.65)', glow: 'rgba(60,120,220,0.28)' },
      ] as const).map(({ t, color, glow }, i) => (
        <motion.div
          key={`ring-${i}`}
          initial={{ scale: 0, opacity: 0 }}
          animate={{
            scale:   [0,    0,    0,    0.7,  3.2,  5.5 ],
            opacity: [0,    0,    0,    0.9,  0.25, 0   ],
          }}
          transition={{
            duration: BALL_DUR,
            delay: BALL_DELAY + t,
            times: [0, 0.62, 0.68, 0.74, 0.90, 1.0],
            ease: 'easeOut',
          }}
          style={{
            position: 'absolute', bottom: -6, left: '50%',
            x: '-50%', y: -230,
            width: 90, height: 90, borderRadius: '50%',
            border: `1.5px solid ${color}`,
            boxShadow: `0 0 10px 4px ${glow}`,
            zIndex: 29, pointerEvents: 'none',
          }}
        />
      ))}


      {/* Screen container — no background; everything inside is revealed by the circle */}
      <div style={{
        position: 'relative',
        width: 'min(800px, 72vw)',
        aspectRatio: '16 / 10',
        borderRadius: 'clamp(8px, 0.8vw, 14px)',
        overflow: 'hidden',
        display: 'flex',
      }}>
        {/* Dashboard content + dark bg — ALL revealed together by the circle expand */}
        <motion.div
          initial={{ clipPath: 'circle(0px at 50% 52%)' }}
          animate={{ clipPath: 'circle(150% at 50% 52%)' }}
          transition={{ duration: SCREEN_DUR, delay: SCREEN_DELAY, ease: SCREEN_EASE }}
          style={{
            position: 'absolute', inset: 0, display: 'flex',
            background: 'linear-gradient(180deg, #0d1726 0%, #080f1a 100%)',
          }}
        >
          {/* Top-edge reflective highlight */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(36,59,110,0.6), rgba(255,255,255,0.3), rgba(36,59,110,0.6), transparent)', zIndex: 10 }} />

          {/* Ambient scanline sweep */}
          <div style={{
            position: 'absolute', left: 0, right: 0, height: '4%',
            background: 'linear-gradient(to bottom, transparent, rgba(36,59,110,0.04), transparent)',
            animation: 'pp-scan 4s linear infinite',
            pointerEvents: 'none', zIndex: 8,
          }} />

          {/* Bottom blue tint */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '30%', background: 'linear-gradient(to top, rgba(27,46,90,0.07), transparent)', pointerEvents: 'none', zIndex: 9 }} />

          {/* Sidebar */}
          <div style={{ width: '19%', background: '#060c16', borderRight: '1px solid rgba(36,59,110,0.08)', padding: '10px 7px', display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 5px', marginBottom: 10 }}>
              <div style={{ width: 14, height: 14, borderRadius: 3, background: 'linear-gradient(135deg, #1b2e5a, #0f2456)', flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ height: 4, width: '75%', background: 'rgba(255,255,255,0.7)', borderRadius: 1 }} />
                <div style={{ height: 3, width: '50%', background: 'rgba(255,255,255,0.25)', borderRadius: 1 }} />
              </div>
            </div>
            {SIDEBAR_ITEMS.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 5px', background: item.active ? 'rgba(27,46,90,0.4)' : 'transparent', borderRadius: 3, borderLeft: `2px solid ${item.active ? item.color : 'transparent'}`, marginBottom: 2 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: item.color, flexShrink: 0, boxShadow: item.active ? `0 0 6px ${item.color}` : 'none' }} />
                <div style={{ height: 3, flex: 1, background: item.active ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.22)', borderRadius: 1 }} />
              </div>
            ))}
          </div>

          {/* Main content */}
          <div style={{ flex: 1, padding: '9px 12px', display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={TX('rgba(255,255,255,0.9)', 9, 600)}>AI Agent Orchestrator</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(46,79,140,0.12)', border: '1px solid rgba(46,79,140,0.28)', borderRadius: 100, padding: '2px 8px' }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 5px #4ade80' }} />
                  <span style={TX('rgba(46,79,140,0.9)', 7, 600)}>5 Agents Running</span>
                </div>
              </div>
              <span style={TX('rgba(255,255,255,0.3)', 7)}>Live Sync</span>
            </div>

            {/* Orchestrator card */}
            <div style={{ background: 'rgba(139,92,246,0.09)', border: '1px solid rgba(139,92,246,0.45)', borderRadius: 8, padding: '8px 12px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.18), transparent 65%)', pointerEvents: 'none' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <RobotIcon color="#a78bfa" size={26} />
                  <div style={{ position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 2 }}>
                    {[0,1,2].map(i => <div key={i} style={{ width: 2, height: i === 1 ? 4 : 3, background: '#a78bfa', borderRadius: 1 }} />)}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ ...TX('#a78bfa', 9, 700), textTransform: 'uppercase', letterSpacing: '0.12em' }}>Orchestrator</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 5px #4ade80' }} />
                      <span style={TX('rgba(46,79,140,0.85)', 7, 500)}>Decision Engine Active</span>
                    </div>
                  </div>
                  <span style={TX('rgba(255,255,255,0.35)', 6.5)}>Aggregating sub-agent reports • Taking cross-system decisions</span>
                </div>
                <div style={{ background: 'rgba(139,92,246,0.18)', border: '1px solid rgba(139,92,246,0.4)', borderRadius: 5, padding: '3px 8px', flexShrink: 0 }}>
                  <span style={TX('#c4b5fd', 6.5, 600)}>⟳ Analyzing…</span>
                </div>
              </div>
              <div style={{ marginTop: 7, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 5, padding: '4px 9px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={TX('rgba(139,92,246,0.7)', 6.5, 600)}>DECISION</span>
                <span style={TX('rgba(255,255,255,0.7)', 7)}>Increase Q2 inventory 18%</span>
                <span style={{ ...TX('rgba(255,255,255,0.2)', 7), margin: '0 2px' }}>•</span>
                <span style={TX('rgba(255,255,255,0.7)', 7)}>Approve ₹32L payroll</span>
                <span style={{ ...TX('rgba(255,255,255,0.2)', 7), margin: '0 2px' }}>•</span>
                <span style={TX('rgba(255,255,255,0.7)', 7)}>Flag 3 CRM leads</span>
                <span style={{ ...TX('rgba(255,255,255,0.2)', 7), margin: '0 2px' }}>•</span>
                <span style={TX('rgba(255,255,255,0.7)', 7)}>Reschedule 2 sprints</span>
              </div>
              <div style={{ marginTop: 6, display: 'flex', gap: 5 }}>
                {AGENTS.map(a => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 4, background: `${a.color}15`, border: `1px solid ${a.color}40`, borderRadius: 100, padding: '2px 8px' }}>
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: a.color, boxShadow: `0 0 4px ${a.color}` }} />
                    <span style={TX(a.color, 6.5, 600)}>{a.source} ✓</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Connector lines */}
            <div style={{ position: 'relative', height: 24, flexShrink: 0 }}>
              <svg width="100%" height="24" style={{ display: 'block', overflow: 'visible' }}>
                {AGENTS.map((agent, idx) => {
                  const pct = 10 + idx * 20
                  const x = `${pct}%`
                  return (
                    <g key={agent.id}>
                      <line x1={x} y1="0" x2={x} y2="24" stroke="rgba(255,255,255,0.05)" strokeWidth="1.5" />
                      <line x1={x} y1="24" x2={x} y2="3" stroke={agent.color} strokeWidth="1.5" strokeDasharray="5 4" strokeLinecap="round" opacity="0.7"
                        style={{ animation: `data-flow-up ${0.9 + idx * 0.18}s linear infinite` }} />
                      <polygon points={`${pct - 2}%,6 ${pct + 2}%,6 ${pct}%,0`} fill={agent.color} opacity="0.85" />
                    </g>
                  )
                })}
                <line x1="10%" y1="0" x2="90%" y2="0" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
              </svg>
            </div>

            {/* Sub-agent cards */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5, minHeight: 0 }}>
              {AGENTS.map(agent => (
                <div key={agent.id} style={{ background: `${agent.color}0a`, border: `1px solid ${agent.color}30`, borderTop: `3px solid ${agent.color}`, borderRadius: '0 0 7px 7px', padding: '6px 7px', display: 'flex', flexDirection: 'column', gap: 3, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 0%, ${agent.color}15, transparent 65%)`, pointerEvents: 'none' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <RobotIcon color={agent.color} size={18} />
                    <div>
                      <span style={{ ...TX(agent.color, 7, 700), textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block' }}>Agent {agent.id}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 1 }}>
                        <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 4px #4ade80' }} />
                        <span style={TX('rgba(46,79,140,0.8)', 6)}>Active</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 3 }}>
                    <div style={{ width: 5, height: 5, borderRadius: 1, background: agent.color, flexShrink: 0 }} />
                    <span style={TX(agent.color, 7, 600)}>{agent.source}</span>
                  </div>
                  <span style={TX('rgba(255,255,255,0.88)', 7, 700)}>{agent.metric1}</span>
                  <span style={TX(`${agent.color}cc`, 6)}>{agent.metric2}</span>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 10, marginTop: 1 }}>
                    {agent.bars.map((h, bi) => (
                      <div key={bi} style={{ flex: 1, height: `${h * 100}%`, background: bi === agent.bars.length - 1 ? `${agent.color}ee` : `${agent.color}44`, borderRadius: '1px 1px 0 0' }} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ flex: 1, height: 2, background: 'rgba(255,255,255,0.07)', borderRadius: 1, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${agent.progress}%`, background: `linear-gradient(90deg, ${agent.color}60, ${agent.color})`, borderRadius: 1 }} />
                    </div>
                    <span style={TX('rgba(255,255,255,0.3)', 6)}>{agent.progress}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Flash burst — white-core bloom radiating from ball's resting point */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0, 1, 0.5, 0] }}
          transition={{ duration: 0.45, delay: SCREEN_DELAY, times: [0, 0.01, 0.06, 0.20, 1], ease: 'easeOut' }}
          style={{
            position: 'absolute',
            top: '20%', bottom: '20%', left: '15%', right: '15%',
            background:
              'radial-gradient(ellipse at 50% 50%, ' +
              'rgba(220,238,255,0.80) 0%, ' +
              'rgba(120,170,255,0.35) 30%, ' +
              'rgba(50,90,200,0.10) 60%, ' +
              'transparent 100%)',
            pointerEvents: 'none',
            zIndex: 22,
          }}
        />
      </div>
    </div>
  )
}

// ─── Light cone — static, appears after screen is fully born ──────────────────
function LightCone() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, delay: 2.7, ease: 'easeIn' }}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3 }}
    >
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none"
        style={{ display: 'block', animation: 'pp-cone-breath 3.5s ease-in-out infinite' }}>
        <defs>
          <linearGradient id="pp-cone-core" x1="50" y1="90" x2="50" y2="68" gradientUnits="userSpaceOnUse">
            <stop offset="0%"  stopColor="rgba(46,79,140,0.65)" />
            <stop offset="30%" stopColor="rgba(36,59,110,0.30)" />
            <stop offset="100%" stopColor="rgba(27,46,90,0.06)" />
          </linearGradient>
          <linearGradient id="pp-cone-wide" x1="50" y1="90" x2="50" y2="65" gradientUnits="userSpaceOnUse">
            <stop offset="0%"  stopColor="rgba(36,59,110,0.40)" />
            <stop offset="50%" stopColor="rgba(27,46,90,0.15)" />
            <stop offset="100%" stopColor="rgba(15,27,61,0.03)" />
          </linearGradient>
          <linearGradient id="pp-ray-l" x1="50" y1="90" x2="17" y2="68" gradientUnits="userSpaceOnUse">
            <stop offset="0%"  stopColor="rgba(96,130,190,1)" />
            <stop offset="45%" stopColor="rgba(46,79,140,0.65)" />
            <stop offset="100%" stopColor="rgba(27,46,90,0.18)" />
          </linearGradient>
          <linearGradient id="pp-ray-r" x1="50" y1="90" x2="83" y2="68" gradientUnits="userSpaceOnUse">
            <stop offset="0%"  stopColor="rgba(96,130,190,1)" />
            <stop offset="45%" stopColor="rgba(46,79,140,0.65)" />
            <stop offset="100%" stopColor="rgba(27,46,90,0.18)" />
          </linearGradient>
          <radialGradient id="pp-src-halo" cx="50" cy="90" r="10" gradientUnits="userSpaceOnUse">
            <stop offset="0%"  stopColor="rgba(140,180,240,0.90)" />
            <stop offset="40%" stopColor="rgba(46,79,140,0.55)" />
            <stop offset="100%" stopColor="rgba(15,27,61,0.00)" />
          </radialGradient>
          <linearGradient id="pp-screen-glow" x1="17" y1="68" x2="83" y2="68" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="rgba(27,46,90,0.00)" />
            <stop offset="20%"  stopColor="rgba(36,59,110,0.45)" />
            <stop offset="50%"  stopColor="rgba(46,79,140,0.65)" />
            <stop offset="80%"  stopColor="rgba(36,59,110,0.45)" />
            <stop offset="100%" stopColor="rgba(27,46,90,0.00)" />
          </linearGradient>
          <filter id="pp-f-soft"  x="-30%" y="-15%" width="160%" height="145%"><feGaussianBlur stdDeviation="2 1.2" /></filter>
          <filter id="pp-f-wide"  x="-50%" y="-15%" width="200%" height="145%"><feGaussianBlur stdDeviation="6 3.5" /></filter>
          <filter id="pp-f-ray"   x="-200%" y="-30%" width="500%" height="160%"><feGaussianBlur stdDeviation="0.6 0.3" /></filter>
          <filter id="pp-f-glow"  x="-200%" y="-30%" width="500%" height="160%"><feGaussianBlur stdDeviation="1.5 0.8" /></filter>
          <filter id="pp-f-edge"  x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="0.8 2.5" /></filter>
          <filter id="pp-f-halo"  x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="3 2" /></filter>
        </defs>
        <polygon points="50,90 2,68 98,68" fill="url(#pp-cone-wide)" filter="url(#pp-f-wide)" opacity="0.7" />
        <polygon points="50,90 17,68 83,68" fill="url(#pp-cone-core)" filter="url(#pp-f-soft)" />
        <polygon points="50,90 36,68 64,68" fill="url(#pp-cone-core)" filter="url(#pp-f-soft)" opacity="0.6" />
        <line x1="50" y1="90" x2="17" y2="68" stroke="url(#pp-ray-l)" strokeWidth="0.5" filter="url(#pp-f-ray)" />
        <line x1="50" y1="90" x2="17" y2="68" stroke="url(#pp-ray-l)" strokeWidth="3" filter="url(#pp-f-glow)" opacity="0.6" />
        <line x1="50" y1="90" x2="83" y2="68" stroke="url(#pp-ray-r)" strokeWidth="0.5" filter="url(#pp-f-ray)" />
        <line x1="50" y1="90" x2="83" y2="68" stroke="url(#pp-ray-r)" strokeWidth="3" filter="url(#pp-f-glow)" opacity="0.6" />
        <ellipse cx="50" cy="90" rx="8" ry="3" fill="url(#pp-src-halo)" filter="url(#pp-f-halo)" />
        <line x1="17" y1="68" x2="83" y2="68" stroke="url(#pp-screen-glow)" strokeWidth="1.2" filter="url(#pp-f-edge)" />
        <circle cx="17" cy="68" r="1.5" fill="rgba(36,59,110,0.6)" filter="url(#pp-f-soft)" />
        <circle cx="83" cy="68" r="1.5" fill="rgba(36,59,110,0.6)" filter="url(#pp-f-soft)" />
      </svg>
    </motion.div>
  )
}

// ─── Projector puck ────────────────────────────────────────────────────────────
function Projector() {
  return (
    <>
      <style>{PROJECTOR_STYLES}</style>
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        style={{
          position: 'relative',
          width: 'clamp(180px, 24vw, 300px)',
          aspectRatio: '10 / 4.2',
          zIndex: 5,
          animation: 'pp-float 5.5s ease-in-out infinite',
          filter:
            'drop-shadow(0 32px 48px rgba(0,0,0,0.85)) ' +
            'drop-shadow(0 0 60px rgba(36,59,110,0.30))',
        }}
      >
        {/* Cylinder side body */}
        <div style={{
          position: 'absolute',
          top: '22%', left: 0, right: 0, bottom: 0,
          background: 'linear-gradient(to bottom, #1c1c24 0%, #111118 30%, #08080e 70%, #040408 100%)',
          borderRadius: '0 0 50% 50% / 0 0 24% 24%',
          boxShadow:
            'inset 8px 0 24px rgba(255,255,255,0.05),' +
            'inset -8px 0 24px rgba(0,0,0,0.5),' +
            'inset 0 -14px 30px rgba(0,0,0,0.8),' +
            'inset 0 3px 8px rgba(255,255,255,0.03)',
          overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '10%', background: 'linear-gradient(to right, rgba(255,255,255,0.08), transparent)' }} />
          <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: '10%', background: 'linear-gradient(to left, rgba(0,0,0,0.4), transparent)' }} />
          {[25, 50, 72].map(pct => (
            <div key={pct} style={{ position: 'absolute', left: '8%', right: '8%', top: `${pct}%`, height: 1, background: 'rgba(255,255,255,0.04)' }} />
          ))}
        </div>

        {/* Top face ellipse */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, height: '44%',
          background: 'radial-gradient(ellipse at 46% 36%, #28282e 0%, #181820 45%, #0c0c14 80%, #060610 100%)',
          borderRadius: '50%',
          zIndex: 2,
          boxShadow:
            'inset 0 10px 24px rgba(255,255,255,0.06),' +
            'inset 0 -6px 16px rgba(0,0,0,0.7),' +
            '0 8px 24px rgba(0,0,0,0.7)',
        }}>
          <div style={{ position: 'absolute', top: '6%', left: '6%', right: '6%', bottom: '6%', borderRadius: '50%', boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.06), inset 0 0 12px rgba(0,0,0,0.7)' }} />
          <div style={{ position: 'absolute', top: '18%', left: '18%', right: '18%', bottom: '18%', borderRadius: '50%', background: 'radial-gradient(ellipse at 50% 42%, #1a1a22 0%, #0a0a12 100%)', boxShadow: 'inset 0 6px 16px rgba(0,0,0,0.95), inset 0 0 0 1px rgba(255,255,255,0.03)' }} />
          <div style={{ position: 'absolute', top: '22%', left: '22%', right: '22%', bottom: '22%', borderRadius: '50%', background: 'transparent', animation: 'pp-lens-glow 2.6s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', top: '22%', left: '22%', right: '22%', bottom: '22%', borderRadius: '50%', boxShadow: '0 0 0 2px rgba(27,46,90,0.5)', animation: 'pp-ring-out 2.6s ease-out infinite', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: '22%', left: '22%', right: '22%', bottom: '22%', borderRadius: '50%', boxShadow: '0 0 0 1.5px rgba(27,46,90,0.3)', animation: 'pp-ring-out 2.6s ease-out 1.3s infinite', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: '30%', left: '30%', right: '30%', bottom: '30%', borderRadius: '50%', background: 'radial-gradient(circle at 44% 38%, #c8d8f0 0%, #6080b0 14%, #243b6e 38%, #1b2e5a 65%, #0f1b3d 100%)', boxShadow: 'inset 0 0 14px rgba(0,0,0,0.6)' }} />
          <div style={{ position: 'absolute', top: '40%', left: '40%', right: '40%', bottom: '40%', borderRadius: '50%', background: 'radial-gradient(circle, #ffffff 0%, #c8d8f8 45%, transparent 100%)', animation: 'pp-hotspot 2.6s ease-in-out infinite' }} />
        </div>

        {/* Ground shadow */}
        <div style={{ position: 'absolute', bottom: '-10%', left: '15%', right: '15%', height: '14%', borderRadius: '50%', background: 'rgba(0,0,0,0.7)', filter: 'blur(16px)', zIndex: 0 }} />
      </motion.div>
    </>
  )
}

// ─── Side agent cards (float left / right of the screen) ──────────────────────
const SIDE_LEFT = [
  {
    source: 'B2B CRM', color: '#3b82f6',
    metric1: '342 Leads', metric2: '₹12.4M pipeline',
    desc: 'Scoring inbound leads & auto-assigning follow-ups based on deal size',
    activity: 'Flagged 3 high-value leads for Q2 review',
    bars: [0.5,0.7,0.55,0.85,0.65] as number[], progress: 87,
  },
  {
    source: 'Fin. Accounting', color: '#10b981',
    metric1: '₹84.2L Revenue', metric2: '100% GST filed',
    desc: 'Reconciling transactions, filing GST returns & projecting cash flow',
    activity: 'Auto-reconciled 218 entries · ₹2.1L variance resolved',
    bars: [0.4,0.65,0.8,0.9,0.75] as number[], progress: 94,
  },
]
const SIDE_RIGHT = [
  {
    source: 'HRMS', color: '#8b5cf6',
    metric1: '284 Employees', metric2: '98% Attendance',
    desc: 'Tracking attendance, running payroll & surfacing compliance alerts',
    activity: 'Payroll processed for 284 employees · 2 alerts pending',
    bars: [0.6,0.75,0.65,0.7,0.9] as number[], progress: 91,
  },
  {
    source: 'Projects', color: '#06b6d4',
    metric1: '47 Active Projects', metric2: '12 Due this week',
    desc: 'Monitoring sprint health, detecting blockers & reallocating bandwidth',
    activity: 'Rescheduled 2 sprints · 4 blockers auto-escalated',
    bars: [0.45,0.6,0.8,0.55,0.75] as number[], progress: 68,
  },
]

function SideAgentCard({ source, color, metric1, metric2, desc, activity, bars, progress }: typeof SIDE_LEFT[0]) {
  return (
    <div style={{
      background: 'linear-gradient(160deg, #0d1726 0%, #080f1a 100%)',
      border: `1px solid ${color}45`,
      borderTop: `2px solid ${color}`,
      borderRadius: '0 0 10px 10px',
      padding: '12px 14px',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: `0 4px 24px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.03)`,
    }}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 0%, ${color}15, transparent 60%)`, pointerEvents: 'none' }} />

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <RobotIcon color={color} size={20} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ ...TX(color, 8, 700), textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block' }}>{source}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 5px #4ade80', flexShrink: 0 }} />
            <span style={TX('rgba(74,222,128,0.8)', 7)}>Agent Active</span>
          </div>
        </div>
      </div>

      {/* Description */}
      <p style={{ ...TX('rgba(255,255,255,0.5)', 7), margin: '0 0 10px', lineHeight: 1.5 }}>{desc}</p>

      {/* Metrics */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, background: `rgba(255,255,255,0.05)`, border: `1px solid ${color}35`, borderRadius: 6, padding: '5px 8px' }}>
          <span style={{ ...TX('rgba(255,255,255,0.95)', 10, 700), display: 'block' }}>{metric1}</span>
          <span style={{ ...TX(`${color}cc`, 6.5), display: 'block', marginTop: 1 }}>Primary KPI</span>
        </div>
        <div style={{ flex: 1, background: `rgba(255,255,255,0.05)`, border: `1px solid ${color}35`, borderRadius: 6, padding: '5px 8px' }}>
          <span style={{ ...TX('rgba(255,255,255,0.95)', 9, 700), display: 'block' }}>{metric2}</span>
          <span style={{ ...TX(`${color}cc`, 6.5), display: 'block', marginTop: 1 }}>Status</span>
        </div>
      </div>

      {/* Mini bar chart */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 16, marginBottom: 8 }}>
        {bars.map((h, bi) => (
          <div key={bi} style={{ flex: 1, height: `${h * 100}%`, background: bi === bars.length - 1 ? `${color}ee` : `${color}50`, borderRadius: '2px 2px 0 0' }} />
        ))}
      </div>

      {/* Progress bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: `linear-gradient(90deg, ${color}60, ${color})`, borderRadius: 2 }} />
        </div>
        <span style={{ ...TX(`${color}dd`, 7, 600), flexShrink: 0 }}>{progress}%</span>
      </div>

      {/* Latest activity */}
      <div style={{ background: 'rgba(0,0,0,0.25)', border: `1px solid ${color}20`, borderRadius: 6, padding: '6px 8px', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}`, marginTop: 2, flexShrink: 0 }} />
        <span style={{ ...TX('rgba(255,255,255,0.6)', 7), lineHeight: 1.4 }}>{activity}</span>
      </div>
    </div>
  )
}

// ─── Floor glow ────────────────────────────────────────────────────────────────
function FloorGlow() {
  return (
    <>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 280, background: 'radial-gradient(ellipse 65% 100% at 50% 100%, rgba(27,46,90,0.07), transparent 70%)', pointerEvents: 'none', zIndex: 1, animation: 'pp-floor-pulse 3.5s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 'min(280px, 36%)', height: 70, background: 'radial-gradient(ellipse at 50% 100%, rgba(27,46,90,0.14), transparent 65%)', pointerEvents: 'none', zIndex: 2, animation: 'pp-floor-pulse 3.5s ease-in-out 0.7s infinite' }} />
      {/* Landing impact burst */}
      <motion.div
        initial={{ opacity: 0, scaleX: 0.1 }}
        animate={{ opacity: [0, 0, 0.9, 0], scaleX: [0.1, 0.1, 1.4, 2.2] }}
        transition={{ duration: 0.6, delay: 0.7, times: [0, 0.01, 0.22, 1], ease: 'easeOut' }}
        style={{
          position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: 'min(340px, 44%)', height: 50,
          background: 'radial-gradient(ellipse at 50% 100%, rgba(46,79,140,0.55), rgba(27,46,90,0.20) 50%, transparent 75%)',
          pointerEvents: 'none', zIndex: 3,
          transformOrigin: 'center bottom',
        }}
      />
    </>
  )
}

// ─── Headline ──────────────────────────────────────────────────────────────────
function Headline() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      style={{ textAlign: 'center', position: 'relative', zIndex: 3, maxWidth: 860, margin: '0 auto' }}
    >
      <h1 style={{ margin: 0, fontFamily: '"Palatino Linotype","Book Antiqua",Palatino,Georgia,serif', fontStyle: 'italic', lineHeight: 1.15, letterSpacing: '-0.01em' }}>
        <motion.span initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          style={{ display: 'block', fontSize: 'clamp(22px, 2.8vw, 40px)', fontWeight: 700, color: '#0f1b3d' }}>
          Intelligent agents
        </motion.span>
        <motion.span initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          style={{ display: 'block', fontSize: 'clamp(19px, 2.5vw, 36px)', fontWeight: 700, color: '#1b2e5a' }}>
          driving{' '}
          <span style={{ color: '#1b2e5a' }}>influential</span>
          {' '}decisions
        </motion.span>
        <motion.span initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          style={{ display: 'block', fontSize: 'clamp(12px, 1.4vw, 20px)', fontWeight: 400, color: '#64748b', marginTop: 'clamp(3px, 0.4vw, 6px)' }}>
          across interconnected applications
        </motion.span>
      </h1>

      <motion.div
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.55, ease: 'easeOut' }}
        style={{ width: 40, height: 1, borderRadius: 1, background: 'linear-gradient(90deg, transparent, rgba(36,59,110,0.5), transparent)', margin: 'clamp(10px, 1.5vw, 16px) auto 0' }}
      />
    </motion.div>
  )
}

// ─── CTAs ──────────────────────────────────────────────────────────────────────
function HeroCTAs({ onBookDemo }: { onBookDemo?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.45, ease: 'easeOut' }}
      style={{ display: 'flex', gap: 12, marginTop: 20, position: 'relative', zIndex: 6, justifyContent: 'center', flexWrap: 'wrap' }}
    >
      <button
        onClick={onBookDemo}
        style={{ background: 'linear-gradient(135deg, #1b2e5a, #0f1b3d)', color: '#fff', border: '1px solid rgba(36,59,110,0.3)', borderRadius: 10, padding: '11px 28px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 8px 24px rgba(15,27,61,0.35), 0 0 0 1px rgba(36,59,110,0.1)', transition: 'transform 0.15s ease, box-shadow 0.15s ease' }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 14px 32px rgba(15,27,61,0.5), 0 0 20px rgba(36,59,110,0.2)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 24px rgba(15,27,61,0.35), 0 0 0 1px rgba(36,59,110,0.1)' }}
      >
        Book a Demo
      </button>
      <button
        style={{ background: 'transparent', color: '#1b2e5a', border: '1.5px solid rgba(27,46,90,0.35)', borderRadius: 10, padding: '11px 24px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s ease, border-color 0.15s ease' }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(27,46,90,0.06)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(27,46,90,0.65)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(27,46,90,0.35)' }}
      >
        Learn More
      </button>
    </motion.div>
  )
}

// ─── Main export ───────────────────────────────────────────────────────────────
export function PetpoojaHeroSection({ onBookDemo }: { onBookDemo?: () => void }) {
  const PUCK_H = 'clamp(76px, 10.1vw, 126px)'

  return (
    <section
      style={{
        position: 'relative',
        width: '100%',
        minHeight: 680,
        background: '#ffffff',
        color: '#0f172a',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
        overflowX: 'clip',
        overflowY: 'visible',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: 'clamp(96px, 11vh, 124px)',
        paddingBottom: 32,
        paddingLeft: 24,
        paddingRight: 24,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '50%', background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(36,59,110,0.06), transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      <FloorGlow />
      <Headline />

      {/* ── Full row: [left cards] [screen] [right cards] ── */}
      <div style={{
        position: 'relative',
        marginTop: 'clamp(12px, 2vh, 28px)',
        width: '100%',
        maxWidth: 1320,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'center',
      }}>
        {/* ── LEFT card column ── */}
        <motion.div
          initial={{ opacity: 0, x: -22 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 2.75, ease: [0.22, 1, 0.36, 1] }}
          style={{
            width: 'clamp(150px, 14vw, 200px)',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            paddingTop: 'clamp(80px, 10vw, 130px)',
            zIndex: 5,
          }}
        >
          {SIDE_LEFT.map(card => (
            <SideAgentCard key={card.source} {...card} />
          ))}
        </motion.div>

        {/* ── CENTER column: screen + light cone + puck spacer ── */}
        <div style={{
          flex: '1 1 auto',
          minWidth: 0,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'clamp(8px, 1.5vw, 16px)',
        }}>
          {/* SVG connector overlay — covers entire row via absolute positioning on container */}
          <DashboardMock />
          <LightCone />
          <div style={{ width: 'clamp(180px, 24vw, 300px)', height: PUCK_H, flexShrink: 0 }} />
        </div>

        {/* ── RIGHT card column ── */}
        <motion.div
          initial={{ opacity: 0, x: 22 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 2.85, ease: [0.22, 1, 0.36, 1] }}
          style={{
            width: 'clamp(150px, 14vw, 200px)',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            paddingTop: 'clamp(80px, 10vw, 130px)',
            zIndex: 5,
          }}
        >
          {SIDE_RIGHT.map(card => (
            <SideAgentCard key={card.source} {...card} />
          ))}
        </motion.div>

        {/* ── SVG connector paths ── drawn after cards appear ── */}
        <motion.svg
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 2.72 }}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 4,
            overflow: 'visible',
          }}
          viewBox="0 0 1320 620"
          preserveAspectRatio="none"
        >
          <defs>
            {/* Glows */}
            <filter id="conn-glow-blue"   x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            <filter id="conn-glow-green"  x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            <filter id="conn-glow-purple" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            <filter id="conn-glow-cyan"   x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>

          {/* ── B2B CRM → screen (left card 1) ── */}
          <motion.path d="M 200,220 C 230,220 248,298 260,308"
            stroke="#3b82f6" strokeWidth="5" fill="none" strokeOpacity="0.18"
            pathLength={1} strokeDasharray={1}
            initial={{ strokeDashoffset: 1 }} animate={{ strokeDashoffset: 0 }}
            transition={{ duration: 0.6, delay: 2.85, ease: [0.22, 1, 0.36, 1] }}
          />
          <motion.path d="M 200,220 C 230,220 248,298 260,308"
            stroke="#3b82f6" strokeWidth="1.5" fill="none" strokeOpacity="0.7"
            pathLength={1} strokeDasharray={1}
            initial={{ strokeDashoffset: 1 }} animate={{ strokeDashoffset: 0 }}
            transition={{ duration: 0.6, delay: 2.85, ease: [0.22, 1, 0.36, 1] }}
          />
          <motion.path d="M 200,220 C 230,220 248,298 260,308"
            stroke="#3b82f6" strokeWidth="1" fill="none" strokeOpacity="0.45"
            strokeDasharray="4 8"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.1, delay: 3.45 }}
            style={{ animation: 'conn-flow 1.4s linear 3.45s infinite' }}
          />
          <motion.circle cx="200" cy="220" r="4.5" fill="#3b82f6" opacity="0.9"
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 0.9 }}
            transition={{ duration: 0.3, delay: 2.8, type: 'spring', stiffness: 300 }}
          />
          <motion.circle cx="260" cy="308" r="3.5" fill="#3b82f6" opacity="0.7"
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 0.7 }}
            transition={{ duration: 0.3, delay: 3.45 }}
          />

          {/* ── Fin. Accounting → screen (left card 2) ── */}
          <motion.path d="M 200,410 C 230,410 248,398 260,408"
            stroke="#10b981" strokeWidth="5" fill="none" strokeOpacity="0.18"
            pathLength={1} strokeDasharray={1}
            initial={{ strokeDashoffset: 1 }} animate={{ strokeDashoffset: 0 }}
            transition={{ duration: 0.6, delay: 2.95, ease: [0.22, 1, 0.36, 1] }}
          />
          <motion.path d="M 200,410 C 230,410 248,398 260,408"
            stroke="#10b981" strokeWidth="1.5" fill="none" strokeOpacity="0.7"
            pathLength={1} strokeDasharray={1}
            initial={{ strokeDashoffset: 1 }} animate={{ strokeDashoffset: 0 }}
            transition={{ duration: 0.6, delay: 2.95, ease: [0.22, 1, 0.36, 1] }}
          />
          <motion.path d="M 200,410 C 230,410 248,398 260,408"
            stroke="#10b981" strokeWidth="1" fill="none" strokeOpacity="0.45"
            strokeDasharray="4 8"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.1, delay: 3.55 }}
            style={{ animation: 'conn-flow 1.6s linear 3.55s infinite' }}
          />
          <motion.circle cx="200" cy="410" r="4.5" fill="#10b981" opacity="0.9"
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 0.9 }}
            transition={{ duration: 0.3, delay: 2.9, type: 'spring', stiffness: 300 }}
          />
          <motion.circle cx="260" cy="408" r="3.5" fill="#10b981" opacity="0.7"
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 0.7 }}
            transition={{ duration: 0.3, delay: 3.55 }}
          />

          {/* ── screen → HRMS (right card 1) ── */}
          <motion.path d="M 1060,308 C 1072,298 1090,220 1120,220"
            stroke="#8b5cf6" strokeWidth="5" fill="none" strokeOpacity="0.18"
            pathLength={1} strokeDasharray={1}
            initial={{ strokeDashoffset: 1 }} animate={{ strokeDashoffset: 0 }}
            transition={{ duration: 0.6, delay: 2.9, ease: [0.22, 1, 0.36, 1] }}
          />
          <motion.path d="M 1060,308 C 1072,298 1090,220 1120,220"
            stroke="#8b5cf6" strokeWidth="1.5" fill="none" strokeOpacity="0.7"
            pathLength={1} strokeDasharray={1}
            initial={{ strokeDashoffset: 1 }} animate={{ strokeDashoffset: 0 }}
            transition={{ duration: 0.6, delay: 2.9, ease: [0.22, 1, 0.36, 1] }}
          />
          <motion.path d="M 1060,308 C 1072,298 1090,220 1120,220"
            stroke="#8b5cf6" strokeWidth="1" fill="none" strokeOpacity="0.45"
            strokeDasharray="4 8"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.1, delay: 3.5 }}
            style={{ animation: 'conn-flow 1.5s linear 3.5s infinite' }}
          />
          <motion.circle cx="1060" cy="308" r="3.5" fill="#8b5cf6" opacity="0.7"
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 0.7 }}
            transition={{ duration: 0.3, delay: 3.5 }}
          />
          <motion.circle cx="1120" cy="220" r="4.5" fill="#8b5cf6" opacity="0.9"
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 0.9 }}
            transition={{ duration: 0.3, delay: 2.85, type: 'spring', stiffness: 300 }}
          />

          {/* ── screen → Projects (right card 2) ── */}
          <motion.path d="M 1060,408 C 1072,398 1090,410 1120,410"
            stroke="#06b6d4" strokeWidth="5" fill="none" strokeOpacity="0.18"
            pathLength={1} strokeDasharray={1}
            initial={{ strokeDashoffset: 1 }} animate={{ strokeDashoffset: 0 }}
            transition={{ duration: 0.6, delay: 3.0, ease: [0.22, 1, 0.36, 1] }}
          />
          <motion.path d="M 1060,408 C 1072,398 1090,410 1120,410"
            stroke="#06b6d4" strokeWidth="1.5" fill="none" strokeOpacity="0.7"
            pathLength={1} strokeDasharray={1}
            initial={{ strokeDashoffset: 1 }} animate={{ strokeDashoffset: 0 }}
            transition={{ duration: 0.6, delay: 3.0, ease: [0.22, 1, 0.36, 1] }}
          />
          <motion.path d="M 1060,408 C 1072,398 1090,410 1120,410"
            stroke="#06b6d4" strokeWidth="1" fill="none" strokeOpacity="0.45"
            strokeDasharray="4 8"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.1, delay: 3.6 }}
            style={{ animation: 'conn-flow 1.7s linear 3.6s infinite' }}
          />
          <motion.circle cx="1060" cy="408" r="3.5" fill="#06b6d4" opacity="0.7"
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 0.7 }}
            transition={{ duration: 0.3, delay: 3.6 }}
          />
          <motion.circle cx="1120" cy="410" r="4.5" fill="#06b6d4" opacity="0.9"
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 0.9 }}
            transition={{ duration: 0.3, delay: 2.95, type: 'spring', stiffness: 300 }}
          />
        </motion.svg>
      </div>

      {/* Puck — falls from above the section */}
      <motion.div
        initial={{ y: '-105vh' }}
        animate={{ y: 0 }}
        transition={{
          y: { type: 'spring', stiffness: 280, damping: 36, mass: 1.4, restDelta: 0.5 },
        }}
        style={{
          position: 'absolute',
          bottom: 32,
          left: '50%',
          x: '-50%',
          zIndex: 10,
        }}
      >
        <Projector />
      </motion.div>

    </section>
  )
}
