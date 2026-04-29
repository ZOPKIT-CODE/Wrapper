import { motion } from 'framer-motion'

// App's consistent deep-blue palette
const DEEP = {
  darkest: '#0F1B3D',  // darkest navy
  dark:    '#1B2E5A',  // primary brand navy
  mid:     '#243B6E',  // medium navy
  light:   '#2E4F8C',  // lighter navy
}

// ─── Headline ─────────────────────────────────────────────────────────────────
function Headline() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      style={{ textAlign: 'center', position: 'relative', zIndex: 3, maxWidth: 980, margin: '0 auto' }}
    >
      {/* Elegant overline */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 38 }}
      >
        <span style={{ display: 'block', width: 36, height: 1, background: `rgba(27,46,90,0.3)` }} />
        <span style={{
          fontSize: '10.5px',
          fontWeight: 600,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: `rgba(27,46,90,0.5)`,
          fontFamily: '"Helvetica Neue", "Inter", Arial, sans-serif',
        }}>
          Zopkit Business OS
        </span>
        <span style={{ display: 'block', width: 36, height: 1, background: `rgba(27,46,90,0.3)` }} />
      </motion.div>

      {/* Main italic headline */}
      <h1 style={{
        margin: 0,
        fontFamily: '"Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif',
        fontStyle: 'italic',
        lineHeight: 1.15,
        letterSpacing: '-0.01em',
      }}>
        {/* Line 1 — largest, darkest */}
        <motion.span
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          style={{
            display: 'block',
            fontSize: 'clamp(28px, 3.6vw, 52px)',
            fontWeight: 700,
            color: DEEP.darkest,
          }}
        >
          Intelligent agents
        </motion.span>

        {/* Line 2 — medium, "influential" in brand blue */}
        <motion.span
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          style={{
            display: 'block',
            fontSize: 'clamp(24px, 3.2vw, 46px)',
            fontWeight: 700,
            color: DEEP.dark,
          }}
        >
          driving{' '}
          <span style={{ color: DEEP.light }}>influential</span>
          {' '}decisions
        </motion.span>

        {/* Line 3 — lightest weight, muted */}
        <motion.span
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          style={{
            display: 'block',
            fontSize: 'clamp(15px, 1.8vw, 26px)',
            fontWeight: 400,
            color: '#64748b',
            marginTop: 'clamp(4px, 0.6vw, 8px)',
          }}
        >
          across interconnected applications
        </motion.span>
      </h1>

      {/* Subtle divider */}
      <motion.div
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.55, ease: 'easeOut' }}
        style={{
          marginTop: 'clamp(20px, 3vw, 36px)',
          width: 56,
          height: 2,
          borderRadius: 2,
          background: `linear-gradient(90deg, transparent, ${DEEP.mid}, transparent)`,
          margin: 'clamp(20px, 3vw, 36px) auto 0',
        }}
      />
    </motion.div>
  )
}

// ─── Agent data (5 agents, each fetching from one source) ─────────────────────
const AGENTS = [
  {
    id: 1, label: 'Agent 1', source: 'B2B CRM',
    color: '#3b82f6',
    metric1: '342 Leads', metric2: '₹12.4M pipeline',
    bars: [0.5, 0.7, 0.55, 0.85, 0.65],
    progress: 87,
  },
  {
    id: 2, label: 'Agent 2', source: 'Financial Accounting',
    color: '#10b981',
    metric1: '₹84.2L Rev', metric2: '100% GST filed',
    bars: [0.4, 0.65, 0.8, 0.9, 0.75],
    progress: 94,
  },
  {
    id: 3, label: 'Agent 3', source: 'Operations Mgmt',
    color: '#f59e0b',
    metric1: '1,247 SKUs', metric2: '34 Orders today',
    bars: [0.7, 0.5, 0.85, 0.6, 0.45],
    progress: 72,
  },
  {
    id: 4, label: 'Agent 4', source: 'HRMS',
    color: '#8b5cf6',
    metric1: '284 Employees', metric2: '98% Attendance',
    bars: [0.6, 0.75, 0.65, 0.7, 0.9],
    progress: 91,
  },
  {
    id: 5, label: 'Agent 5', source: 'Project Mgmt',
    color: '#06b6d4',
    metric1: '47 Projects', metric2: '12 Due this week',
    bars: [0.45, 0.6, 0.8, 0.55, 0.75],
    progress: 68,
  },
] as const

// ─── Inline robot SVG icon ─────────────────────────────────────────────────────
function RobotIcon({ color, size = 28 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: 'block', flexShrink: 0 }}>
      {/* Antenna */}
      <line x1="12" y1="1.5" x2="12" y2="4.2" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="12" cy="1.2" r="1.2" fill={color} />
      {/* Head */}
      <rect x="3" y="4.2" width="18" height="13.5" rx="3.2" fill="#0d1120" stroke={color} strokeWidth="1" />
      {/* Ear bumps */}
      <rect x="1" y="8" width="2" height="5" rx="1" fill={color} opacity="0.45" />
      <rect x="21" y="8" width="2" height="5" rx="1" fill={color} opacity="0.45" />
      {/* Visor */}
      <rect x="5" y="6.8" width="14" height="5.5" rx="1.5" fill={color} fillOpacity="0.1" stroke={color} strokeWidth="0.5" strokeOpacity="0.5" />
      {/* Pulse line inside visor */}
      <polyline
        points="6.5,9.5 8,9.5 9,7.6 10.2,11.5 11.4,8.2 12.5,10.5 13.6,9.5 17.5,9.5"
        stroke={color} fill="none" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round"
      />
      {/* Mouth */}
      <rect x="9" y="14.8" width="6" height="1.2" rx="0.6" fill={color} opacity="0.4" />
    </svg>
  )
}

const SIDEBAR_ITEMS = [
  { color: '#3b82f6', active: false }, // Agent 1 CRM
  { color: '#10b981', active: false }, // Agent 2 Finance
  { color: '#f59e0b', active: false }, // Agent 3 Ops
  { color: '#8b5cf6', active: true  }, // Agent 4 HRMS (active)
  { color: '#06b6d4', active: false }, // Agent 5 Projects
  { color: '#6366f1', active: false }, // Agent 6 Flowtilla
  { color: '#ec4899', active: false },
  { color: '#14b8a6', active: false },
  { color: '#f97316', active: false },
  { color: '#ef4444', active: false },
  { color: '#a3e635', active: false },
]

const EXTRA_APPS = ['ESOP', 'B2C CRM', 'Academy', 'ITSM', 'Affiliates']
const EXTRA_WIDTHS = [28, 38, 42, 26, 50]

// shared tiny-text style for the mock UI
const TX = (color = 'rgba(255,255,255,0.85)', size = 8, weight = 500) => ({
  fontSize: size,
  fontWeight: weight,
  color,
  fontFamily: '"SF Mono","Fira Code","Fira Mono","Roboto Mono",monospace',
  lineHeight: 1.3,
  letterSpacing: '0.02em',
})

// ─── Agent Orchestrator Dashboard mock ───────────────────────────────────────
function DashboardMock() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 120 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1.1, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: 'relative',
        width: 'min(720px, 70vw)',
        aspectRatio: '16 / 10',
        borderRadius: 'clamp(8px, 0.8vw, 14px)',
        background: 'linear-gradient(180deg, #0d1726 0%, #0a1018 100%)',
        boxShadow:
          `0 30px 80px rgba(15,27,61,0.22),` +
          `0 0 0 1px rgba(27,46,90,0.5),` +
          `0 0 60px rgba(27,46,90,0.15),` +
          `0 0 120px rgba(27,46,90,0.08)`,
        overflow: 'hidden',
        display: 'flex',
        zIndex: 4,
      }}
    >
      {/* Top reflective edge */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)',
        zIndex: 5,
      }} />

      {/* Sidebar */}
      <div style={{
        width: '19%',
        background: '#070b13',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        padding: '10px 7px',
        display: 'flex', flexDirection: 'column', gap: 0,
      }}>
        {/* Logo row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 5px', marginBottom: 10 }}>
          <div style={{ width: 14, height: 14, borderRadius: 3, background: `linear-gradient(135deg, ${DEEP.mid}, ${DEEP.darkest})`, flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ height: 4, width: '75%', background: 'rgba(255,255,255,0.8)', borderRadius: 1 }} />
            <div style={{ height: 3, width: '50%', background: 'rgba(255,255,255,0.3)', borderRadius: 1 }} />
          </div>
        </div>
        {/* Nav rows */}
        {SIDEBAR_ITEMS.map((item, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '4px 5px',
            background: item.active ? 'rgba(27,46,90,0.4)' : 'transparent',
            borderRadius: 3,
            borderLeft: `2px solid ${item.active ? item.color : 'transparent'}`,
            marginBottom: 2,
          }}>
            <div style={{
              width: 5, height: 5, borderRadius: '50%',
              background: item.color, flexShrink: 0,
              boxShadow: item.active ? `0 0 6px ${item.color}` : 'none',
            }} />
            <div style={{
              height: 3, flex: 1,
              background: item.active ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.28)',
              borderRadius: 1,
            }} />
          </div>
        ))}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, padding: '9px 12px', display: 'flex', flexDirection: 'column', gap: 0 }}>

        {/* Header bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={TX('rgba(255,255,255,0.9)', 9, 600)}>AI Agent Orchestrator</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.28)', borderRadius: 100, padding: '2px 8px' }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 5px #4ade80' }} />
              <span style={TX('rgba(74,222,128,0.9)', 7, 600)}>5 Agents Running</span>
            </div>
          </div>
          <span style={TX('rgba(255,255,255,0.3)', 7)}>Live Sync</span>
        </div>

        {/* ── ORCHESTRATOR CARD (top, full width) ── */}
        <div style={{
          background: 'rgba(139,92,246,0.09)',
          border: '1px solid rgba(139,92,246,0.45)',
          borderRadius: 8,
          padding: '8px 12px',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.20), transparent 65%)', pointerEvents: 'none' }} />
          {/* Top row: icon + name + status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Orchestrator icon — larger, purple */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <RobotIcon color="#a78bfa" size={28} />
              {/* crown accent */}
              <div style={{ position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)', width: 10, height: 4, display: 'flex', gap: 2, justifyContent: 'center' }}>
                {[0,1,2].map(i => <div key={i} style={{ width: 2, height: i === 1 ? 4 : 3, background: '#a78bfa', borderRadius: 1 }} />)}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ ...TX('#a78bfa', 9, 700), textTransform: 'uppercase', letterSpacing: '0.12em' }}>Orchestrator</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 5px #4ade80' }} />
                  <span style={TX('rgba(74,222,128,0.85)', 7, 500)}>Decision Engine Active</span>
                </div>
              </div>
              <span style={TX('rgba(255,255,255,0.35)', 6.5)}>Aggregating sub-agent reports • Taking cross-system decisions</span>
            </div>
            {/* Decision badge */}
            <div style={{ background: 'rgba(139,92,246,0.18)', border: '1px solid rgba(139,92,246,0.4)', borderRadius: 5, padding: '3px 8px', flexShrink: 0 }}>
              <span style={TX('#c4b5fd', 6.5, 600)}>⟳ Analyzing…</span>
            </div>
          </div>
          {/* Decision output row */}
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
          {/* Agent status pills */}
          <div style={{ marginTop: 6, display: 'flex', gap: 5 }}>
            {AGENTS.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 4, background: `${a.color}15`, border: `1px solid ${a.color}40`, borderRadius: 100, padding: '2px 8px' }}>
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: a.color, boxShadow: `0 0 4px ${a.color}` }} />
                <span style={TX(a.color, 6.5, 600)}>{a.source} ✓</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Vertical connector lines (5 sub-agents report UP to orchestrator) ── */}
        <div style={{ position: 'relative', height: 28, flexShrink: 0 }}>
          <svg width="100%" height="28" style={{ display: 'block', overflow: 'visible' }}>
            {/* 5 vertical lines positioned at centre of each sub-agent column: 10%,30%,50%,70%,90% */}
            {AGENTS.map((agent, idx) => {
              const pct = 10 + idx * 20
              const x = `${pct}%`
              return (
                <g key={agent.id}>
                  {/* faint track */}
                  <line x1={x} y1="0" x2={x} y2="28" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
                  {/* animated upward flow */}
                  <line x1={x} y1="28" x2={x} y2="3"
                    stroke={agent.color} strokeWidth="1.5" strokeDasharray="5 4" strokeLinecap="round"
                    opacity="0.7"
                    style={{ animation: `data-flow-up ${0.9 + idx * 0.18}s linear infinite` }}
                  />
                  {/* upward arrowhead */}
                  <polygon
                    points={`${pct - 2}%,6 ${pct + 2}%,6 ${pct}%,0`}
                    fill={agent.color} opacity="0.85"
                  />
                </g>
              )
            })}
            {/* Horizontal branch connecting the 5 lines */}
            <line x1="10%" y1="0" x2="90%" y2="0" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          </svg>
        </div>

        {/* ── 5 Sub-agent cards ── */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5, minHeight: 0 }}>
          {AGENTS.map((agent, idx) => (
            <div key={agent.id} style={{
              background: `${agent.color}0a`,
              border: `1px solid ${agent.color}30`,
              borderTop: `3px solid ${agent.color}`,
              borderRadius: '0 0 7px 7px',
              padding: '6px 7px',
              display: 'flex', flexDirection: 'column', gap: 3,
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 0%, ${agent.color}18, transparent 65%)`, pointerEvents: 'none' }} />

              {/* Agent identity */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <RobotIcon color={agent.color} size={20} />
                <div>
                  <span style={{ ...TX(agent.color, 7.5, 700), textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block' }}>Agent {agent.id}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 1 }}>
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 4px #4ade80' }} />
                    <span style={TX('rgba(74,222,128,0.8)', 6.5)}>Active</span>
                  </div>
                </div>
              </div>

              {/* Source label */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 4 }}>
                <div style={{ width: 5, height: 5, borderRadius: 1, background: agent.color, flexShrink: 0 }} />
                <span style={{ ...TX(agent.color, 7.5, 600) }}>{agent.source}</span>
              </div>

              {/* Metrics */}
              <span style={TX('rgba(255,255,255,0.88)', 7.5, 700)}>{agent.metric1}</span>
              <span style={TX(`${agent.color}cc`, 6)}>{agent.metric2}</span>

              {/* Mini bar chart */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 10, marginTop: 1 }}>
                {agent.bars.map((h, bi) => (
                  <div key={bi} style={{
                    flex: 1, height: `${h * 100}%`,
                    background: bi === agent.bars.length - 1 ? `${agent.color}ee` : `${agent.color}48`,
                    borderRadius: '1px 1px 0 0',
                  }} />
                ))}
              </div>

              {/* Progress */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ flex: 1, height: 2, background: 'rgba(255,255,255,0.07)', borderRadius: 1, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${agent.progress}%`, background: `linear-gradient(90deg, ${agent.color}60, ${agent.color})`, borderRadius: 1 }} />
                </div>
                <span style={TX('rgba(255,255,255,0.35)', 6)}>{agent.progress}%</span>
              </div>

              {/* Reporting tag */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={TX('rgba(255,255,255,0.25)', 6)}>↑ Reporting to Orchestrator</span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </motion.div>
  )
}

// ─── Shared keyframes ──────────────────────────────────────────────────────────
const PROJECTOR_STYLES = `
  @keyframes data-flow      { to { stroke-dashoffset: -9; } }
  @keyframes data-flow-up   { to { stroke-dashoffset:  9; } }
  @keyframes pp-float       { 0%,100%{ transform:translateY(0px) }  50%{ transform:translateY(-6px) } }
  @keyframes pp-lens-glow   {
    0%,100%{ box-shadow:0 0 0 3px rgba(36,59,110,0.95), 0 0 18px 5px rgba(46,79,140,0.9), 0 0 44px 10px rgba(36,59,110,0.6), 0 0 90px 20px rgba(27,46,90,0.35) }
    50%{     box-shadow:0 0 0 3px rgba(60,105,190,1),   0 0 28px 9px rgba(60,105,190,0.95), 0 0 68px 16px rgba(46,79,140,0.75), 0 0 140px 28px rgba(36,59,110,0.5) }
  }
  @keyframes pp-hotspot     { 0%,100%{ opacity:0.9; filter:blur(1.5px); transform:scale(1) } 50%{ opacity:1; filter:blur(0.5px); transform:scale(1.22) } }
  @keyframes pp-ring-out    { 0%{ transform:scale(0.5); opacity:0.75 } 100%{ transform:scale(3.8); opacity:0 } }
  @keyframes pp-cone-breath { 0%,100%{ opacity:1 } 50%{ opacity:0.78 } }
  @keyframes pp-floor-pulse { 0%,100%{ opacity:0.7 } 50%{ opacity:1 } }
  @keyframes pp-band        { 0%{ top:-4%; opacity:0 } 8%{ opacity:1 } 92%{ opacity:0.4 } 100%{ top:106%; opacity:0 } }
  @keyframes pp-drift {
    0%   { transform:translateY(0px)   translateX(0px)            scale(1);   opacity:0 }
    10%  { opacity:var(--pp-op) }
    50%  { transform:translateY(-80px) translateX(var(--pp-dx))   scale(1.15) }
    90%  { opacity:var(--pp-op) }
    100% { transform:translateY(-210px) translateX(calc(var(--pp-dx)*1.6)) scale(0.5); opacity:0 }
  }
`

// ─── Projector — 3-D cylindrical puck ─────────────────────────────────────────
function Projector() {
  return (
    <>
      <style>{PROJECTOR_STYLES}</style>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.35, ease: 'easeOut' }}
        style={{
          position: 'relative',
          width: 'clamp(220px, 30vw, 340px)',
          aspectRatio: '10 / 3.5',
          zIndex: 5,
          animation: 'pp-float 5.5s ease-in-out infinite',
          filter: 'drop-shadow(0 28px 44px rgba(0,0,0,0.42)) drop-shadow(0 0 80px rgba(27,46,90,0.35))',
        }}
      >
        {/* ── CYLINDER SIDE ────────────────────────────────────────── */}
        <div style={{
          position: 'absolute',
          top: '20%', left: 0, right: 0, bottom: 0,
          background:
            'linear-gradient(to bottom, #212128 0%, #161620 28%, #0d0d14 65%, #070710 100%)',
          borderRadius: '0 0 50% 50% / 0 0 22% 22%',
          boxShadow:
            'inset 7px 0 22px rgba(255,255,255,0.045),' +  // left edge specular
            'inset -7px 0 22px rgba(0,0,0,0.45),' +         // right wrap-shadow
            'inset 0 -12px 28px rgba(0,0,0,0.75),' +        // bottom depth
            'inset 0 3px 8px rgba(255,255,255,0.035)',       // top edge catch
          overflow: 'hidden',
        }}>
          {/* Left specular streak */}
          <div style={{
            position: 'absolute', top: 0, bottom: 0, left: 0, width: '9%',
            background: 'linear-gradient(to right, rgba(255,255,255,0.07), transparent)',
          }} />
          {/* Right shadow streak */}
          <div style={{
            position: 'absolute', top: 0, bottom: 0, right: 0, width: '9%',
            background: 'linear-gradient(to left, rgba(0,0,0,0.35), transparent)',
          }} />
        </div>

        {/* ── TOP FACE ─────────────────────────────────────────────── */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: '40%',
          background:
            'radial-gradient(ellipse at 48% 38%, #2c2c38 0%, #1a1a26 50%, #0e0e18 82%, #08080f 100%)',
          borderRadius: '50%',
          zIndex: 2,
          boxShadow:
            'inset 0 9px 22px rgba(255,255,255,0.055),' + // top specular
            'inset 0 -5px 14px rgba(0,0,0,0.65),' +        // depth
            '0 7px 22px rgba(0,0,0,0.65)',                  // shadow onto side body
        }}>
          {/* Outer groove ring */}
          <div style={{
            position: 'absolute',
            top: '7%', left: '7%', right: '7%', bottom: '7%',
            borderRadius: '50%',
            boxShadow:
              'inset 0 0 0 1.5px rgba(255,255,255,0.055),' +
              'inset 0 0 10px rgba(0,0,0,0.6)',
          }} />

          {/* Middle recessed ring */}
          <div style={{
            position: 'absolute',
            top: '20%', left: '20%', right: '20%', bottom: '20%',
            borderRadius: '50%',
            background:
              'radial-gradient(ellipse at 50% 42%, #1e1e2a 0%, #0c0c14 100%)',
            boxShadow:
              'inset 0 5px 14px rgba(0,0,0,0.95),' +
              'inset 0 0 0 1px rgba(255,255,255,0.035)',
          }} />

          {/* Glow ring — animated breathing box-shadow ring */}
          <div style={{
            position: 'absolute',
            top: '24%', left: '24%', right: '24%', bottom: '24%',
            borderRadius: '50%',
            background: 'transparent',
            animation: 'pp-lens-glow 2.8s ease-in-out infinite',
          }} />

          {/* Pulse ring 1 */}
          <div style={{
            position: 'absolute',
            top: '24%', left: '24%', right: '24%', bottom: '24%',
            borderRadius: '50%',
            boxShadow: '0 0 0 1.5px rgba(60,105,200,0.5)',
            animation: 'pp-ring-out 2.8s ease-out infinite',
            pointerEvents: 'none',
          }} />
          {/* Pulse ring 2 staggered */}
          <div style={{
            position: 'absolute',
            top: '24%', left: '24%', right: '24%', bottom: '24%',
            borderRadius: '50%',
            boxShadow: '0 0 0 1.5px rgba(60,105,200,0.3)',
            animation: 'pp-ring-out 2.8s ease-out 1.4s infinite',
            pointerEvents: 'none',
          }} />

          {/* Lens bowl */}
          <div style={{
            position: 'absolute',
            top: '32%', left: '32%', right: '32%', bottom: '32%',
            borderRadius: '50%',
            background: `radial-gradient(circle at 44% 38%, #d0e4ff 0%, #88aef0 14%, ${DEEP.mid} 36%, ${DEEP.dark} 64%, ${DEEP.darkest} 100%)`,
            boxShadow: 'inset 0 0 12px rgba(0,0,0,0.75)',
          }} />

          {/* Hot-spot */}
          <div style={{
            position: 'absolute',
            top: '42%', left: '42%', right: '42%', bottom: '42%',
            borderRadius: '50%',
            background: 'radial-gradient(circle, #fff 0%, #d2e8ff 55%, transparent 100%)',
            animation: 'pp-hotspot 2.8s ease-in-out infinite',
          }} />
        </div>

        {/* Ground contact shadow */}
        <div style={{
          position: 'absolute',
          bottom: '-9%', left: '18%', right: '18%', height: '12%',
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.55)',
          filter: 'blur(14px)',
          zIndex: 0,
        }} />
      </motion.div>
    </>
  )
}

// ─── Light rays from projector lens to dashboard bottom corners ───────────────
// Layout percentages (in 0-100 viewBox = % of container):
//   dashboard bottom corners ≈ (17, 69) and (83, 69)
//   projector lens center    ≈ (50, 87)
function LightCone() {
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      zIndex: 3,
    }}>
      <svg
        width="100%" height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ display: 'block', animation: 'pp-cone-breath 3.8s ease-in-out infinite' }}
      >
        <defs>
          {/* Cone fill — bright at projector source, transparent at dashboard */}
          <linearGradient id="pp-cone-fill" x1="50" y1="87" x2="50" y2="69" gradientUnits="userSpaceOnUse">
            <stop offset="0%"  stopColor="rgba(46,79,140,0.52)" />
            <stop offset="35%" stopColor="rgba(36,59,110,0.22)" />
            <stop offset="100%" stopColor="rgba(27,46,90,0.03)" />
          </linearGradient>

          {/* Left edge ray — bright at source, fades at dashboard */}
          <linearGradient id="pp-ray-l" x1="50" y1="87" x2="17" y2="69" gradientUnits="userSpaceOnUse">
            <stop offset="0%"  stopColor="rgba(90,145,235,0.85)" />
            <stop offset="70%" stopColor="rgba(60,100,210,0.30)" />
            <stop offset="100%" stopColor="rgba(40,70,180,0.10)" />
          </linearGradient>

          {/* Right edge ray */}
          <linearGradient id="pp-ray-r" x1="50" y1="87" x2="83" y2="69" gradientUnits="userSpaceOnUse">
            <stop offset="0%"  stopColor="rgba(90,145,235,0.85)" />
            <stop offset="70%" stopColor="rgba(60,100,210,0.30)" />
            <stop offset="100%" stopColor="rgba(40,70,180,0.10)" />
          </linearGradient>

          {/* Source halo at lens */}
          <radialGradient id="pp-src" cx="50" cy="87" r="9" gradientUnits="userSpaceOnUse">
            <stop offset="0%"  stopColor="rgba(120,175,255,0.60)" />
            <stop offset="100%" stopColor="rgba(30,55,130,0.00)" />
          </radialGradient>

          {/* Dashboard-edge glow where rays connect */}
          <linearGradient id="pp-edge-glow" x1="17" y1="69" x2="83" y2="69" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="rgba(60,100,210,0.00)" />
            <stop offset="20%"  stopColor="rgba(60,100,210,0.18)" />
            <stop offset="50%"  stopColor="rgba(60,100,210,0.08)" />
            <stop offset="80%"  stopColor="rgba(60,100,210,0.18)" />
            <stop offset="100%" stopColor="rgba(60,100,210,0.00)" />
          </linearGradient>

          <filter id="pp-f-soft"   x="-25%" y="-10%" width="150%" height="130%"><feGaussianBlur stdDeviation="2.5 1.5" /></filter>
          <filter id="pp-f-wide"   x="-40%" y="-10%" width="180%" height="130%"><feGaussianBlur stdDeviation="5 3"     /></filter>
          <filter id="pp-f-ray"    x="-150%" y="-20%" width="400%" height="140%"><feGaussianBlur stdDeviation="0.9 0.5" /></filter>
          <filter id="pp-f-edge"   x="-10%" y="-100%" width="120%" height="300%"><feGaussianBlur stdDeviation="1 2"     /></filter>
        </defs>

        {/* Outer soft ambient diffusion — wide trapezoid */}
        <polygon
          points="50,87 6,69 94,69"
          fill="url(#pp-cone-fill)"
          filter="url(#pp-f-wide)"
          opacity="0.55"
        />

        {/* Primary cone fill */}
        <polygon
          points="50,87 17,69 83,69"
          fill="url(#pp-cone-fill)"
          filter="url(#pp-f-soft)"
        />

        {/* Left edge ray — sharp bright line */}
        <line x1="50" y1="87" x2="17" y2="69"
          stroke="url(#pp-ray-l)" strokeWidth="0.7"
          filter="url(#pp-f-ray)"
        />
        {/* Left edge ray — soft glow duplicate */}
        <line x1="50" y1="87" x2="17" y2="69"
          stroke="url(#pp-ray-l)" strokeWidth="2.5"
          filter="url(#pp-f-soft)" opacity="0.45"
        />

        {/* Right edge ray — sharp */}
        <line x1="50" y1="87" x2="83" y2="69"
          stroke="url(#pp-ray-r)" strokeWidth="0.7"
          filter="url(#pp-f-ray)"
        />
        {/* Right edge ray — soft glow duplicate */}
        <line x1="50" y1="87" x2="83" y2="69"
          stroke="url(#pp-ray-r)" strokeWidth="2.5"
          filter="url(#pp-f-soft)" opacity="0.45"
        />

        {/* Source halo at projector lens */}
        <ellipse cx="50" cy="87" rx="7" ry="2.5" fill="url(#pp-src)" />

        {/* Dashboard bottom-edge illumination where rays land */}
        <line x1="17" y1="69" x2="83" y2="69"
          stroke="url(#pp-edge-glow)" strokeWidth="0.8"
          filter="url(#pp-f-edge)"
        />
      </svg>
    </div>
  )
}

// ─── Floor glow — pulsing ──────────────────────────────────────────────────────
function FloorGlow() {
  return (
    <>
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0, height: 240,
        background: `radial-gradient(ellipse 60% 100% at 50% 100%, rgba(27,46,90,0.10), transparent 70%)`,
        pointerEvents: 'none', zIndex: 1,
        animation: 'pp-floor-pulse 3.8s ease-in-out infinite',
      }} />
      {/* Tight caustic spot directly under beam */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(320px, 42%)', height: 80,
        background: `radial-gradient(ellipse at 50% 100%, rgba(36,59,110,0.18), transparent 68%)`,
        pointerEvents: 'none', zIndex: 2,
        animation: 'pp-floor-pulse 3.8s ease-in-out 0.6s infinite',
      }} />
    </>
  )
}


// ─── CTAs ──────────────────────────────────────────────────────────────────────
function HeroCTAs({ onBookDemo }: { onBookDemo?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.45, ease: 'easeOut' }}
      style={{ display: 'flex', gap: 14, marginTop: 32, position: 'relative', zIndex: 6, justifyContent: 'center', flexWrap: 'wrap' }}
    >
      <button
        onClick={onBookDemo}
        style={{
          background: DEEP.dark,
          color: '#fff',
          border: 'none',
          borderRadius: 10,
          padding: '14px 32px',
          fontSize: 15,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
          boxShadow: `0 10px 28px rgba(15,27,61,0.30)`,
          transition: 'transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLButtonElement
          el.style.transform = 'translateY(-2px)'
          el.style.boxShadow = `0 16px 36px rgba(15,27,61,0.40)`
          el.style.background = DEEP.darkest
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLButtonElement
          el.style.transform = 'translateY(0)'
          el.style.boxShadow = `0 10px 28px rgba(15,27,61,0.30)`
          el.style.background = DEEP.dark
        }}
      >
        Book a Demo
      </button>
      <button
        style={{
          background: 'transparent',
          color: DEEP.dark,
          border: `1.5px solid rgba(27,46,90,0.4)`,
          borderRadius: 10,
          padding: '14px 28px',
          fontSize: 15,
          fontWeight: 500,
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'background 0.15s ease, border-color 0.15s ease',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLButtonElement
          el.style.background = `rgba(27,46,90,0.06)`
          el.style.borderColor = `rgba(27,46,90,0.7)`
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLButtonElement
          el.style.background = 'transparent'
          el.style.borderColor = `rgba(27,46,90,0.4)`
        }}
      >
        Learn More
      </button>
    </motion.div>
  )
}

// ─── Main export ───────────────────────────────────────────────────────────────
export function PetpoojaHeroSection({ onBookDemo }: { onBookDemo?: () => void }) {
  return (
    <section
      style={{
        position: 'relative',
        width: '100%',
        minHeight: 720,
        background: '#ffffff',
        color: '#0f172a',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: 'clamp(100px, 12vh, 140px)',
        paddingBottom: 80,
        paddingLeft: 24,
        paddingRight: 24,
        boxSizing: 'border-box',
      }}
    >
      {/* Subtle deep-blue top wash */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, height: '55%',
        background: `radial-gradient(ellipse 70% 50% at 50% 0%, rgba(27,46,90,0.06), transparent 70%)`,
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      <FloorGlow />

      <Headline />

      <div style={{
        position: 'relative',
        marginTop: 'clamp(24px, 4vh, 56px)',
        width: '100%',
        maxWidth: 1100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'clamp(16px, 3vw, 28px)',
      }}>
        <DashboardMock />
        <LightCone />
        <Projector />
      </div>

      <HeroCTAs onBookDemo={onBookDemo} />
    </section>
  )
}
