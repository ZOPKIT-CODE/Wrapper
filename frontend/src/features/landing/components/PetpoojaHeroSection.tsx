import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

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

// ─── Shared keyframes ──────────────────────────────────────────────────────────
const PROJECTOR_STYLES = `
  @keyframes data-flow-up   { to { stroke-dashoffset: 9; } }
  @keyframes pp-float       { 0%,100%{ transform:translateY(0px) }  50%{ transform:translateY(-4px) } }
  @keyframes pp-lens-pulse  { 0%,100%{ opacity:0.85 } 50%{ opacity:1 } }
  @keyframes pp-hotspot     { 0%,100%{ opacity:0.85; transform:scale(1) } 50%{ opacity:1; transform:scale(1.15) } }
  @keyframes zk-caret       { 50% { opacity:0 } }
  @keyframes zk-cone-in     { from { opacity:0 } to { opacity:1 } }
@media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  }
`

// ─── Typewriter for "Welcome to Zopkit" ───────────────────────────────────────
const WELCOME_TEXT = 'Welcome to Zopkit'

function WelcomeTypewriter({ isMobile }: { isMobile: boolean }) {
  const [text, setText] = useState('')
  const done = text.length >= WELCOME_TEXT.length

  useEffect(() => {
    let i = 0
    const id = setInterval(() => {
      i++
      setText(WELCOME_TEXT.slice(0, i))
      if (i >= WELCOME_TEXT.length) clearInterval(id)
    }, 55)
    return () => clearInterval(id)
  }, [])

  return (
    <span style={{
      fontFamily: '"Palatino Linotype","Book Antiqua",Palatino,Georgia,serif',
      fontStyle: 'italic',
      fontWeight: 500,
      fontSize: isMobile ? 'clamp(20px, 5vw, 26px)' : 'clamp(28px, 3.6vw, 48px)',
      color: '#1b2e5a',
      letterSpacing: '-0.01em',
      lineHeight: 1.1,
      whiteSpace: 'nowrap',
    }}>
      {text}
      {!done && (
        <span style={{
          borderRight: '0.06em solid #1b2e5a',
          marginLeft: '0.05em',
          display: 'inline-block',
          verticalAlign: 'text-bottom',
          height: '0.82em',
          animation: 'zk-caret 0.75s step-start infinite',
        }} />
      )}
    </span>
  )
}

// ─── Agent data ────────────────────────────────────────────────────────────────
const BLUE = '#1b2e5a'

const AGENTS = [
  { id: 1, source: 'B2B CRM',     color: BLUE, metric1: '342 Leads',     metric2: '₹12.4M pipeline', bars: [0.5,0.7,0.55,0.85,0.65], progress: 87 },
  { id: 2, source: 'Finance',     color: BLUE, metric1: '₹84.2L Rev',    metric2: '100% GST filed',  bars: [0.4,0.65,0.8,0.9,0.75],  progress: 94 },
  { id: 3, source: 'Operations',  color: BLUE, metric1: '1,247 SKUs',    metric2: '34 Orders today', bars: [0.7,0.5,0.85,0.6,0.45],  progress: 72 },
  { id: 4, source: 'HRMS',        color: BLUE, metric1: '284 Employees', metric2: '98% Attendance',  bars: [0.6,0.75,0.65,0.7,0.9],  progress: 91 },
  { id: 5, source: 'Projects',    color: BLUE, metric1: '47 Projects',   metric2: '12 Due this week',bars: [0.45,0.6,0.8,0.55,0.75], progress: 68 },
] as const

const AGENT_FEEDS = [
  ['Lead scored: Sharma & Co ₹8.4L', 'Follow-up queued: 12 accts', 'Pipeline updated: +18%'],
  ['GST R1 filed: Aug 2025', 'Invoice #1247 reconciled', 'Cash flow projection synced'],
  ['PO #847 approved: ₹2.3L', 'SKU-224 low stock alert', 'Vendor pmt queued: 3 items'],
  ['Payroll: 284 emp processed', 'Leave approved: 7 requests', 'Compliance check: Clear'],
  ['Sprint 14: 3 blockers fixed', 'Alpha delivery: updated ETA', 'Budget utilised: 82%'],
] as const

const AGENT_INTEGRATIONS = [
  [{ label: 'CRM', c: BLUE }, { label: 'Email', c: BLUE }, { label: 'WhatsApp', c: BLUE }],
  [{ label: 'Tally', c: BLUE }, { label: 'GST Portal', c: BLUE }, { label: 'Banking', c: BLUE }],
  [{ label: 'POS', c: BLUE }, { label: 'Inventory', c: BLUE }, { label: 'Warehouse', c: BLUE }],
  [{ label: 'ESIC', c: BLUE }, { label: 'PF Portal', c: BLUE }, { label: 'Attendance', c: BLUE }],
  [{ label: 'Tasks', c: BLUE }, { label: 'Git', c: BLUE }, { label: 'Time Track', c: BLUE }],
] as const

const SIDEBAR_ITEMS = [
  { color: BLUE, active: false },
  { color: BLUE, active: false },
  { color: BLUE, active: false },
  { color: BLUE, active: true  },
  { color: BLUE, active: false },
  { color: BLUE, active: false },
  { color: BLUE, active: false },
  { color: BLUE, active: false },
  { color: BLUE, active: false },
  { color: BLUE, active: false },
  { color: BLUE, active: false },
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

// ─── Holographic Dashboard ─────────────────────────────────────────────────────
function DashboardMock({ isMobile, mobileScale = 1 }: { isMobile: boolean; mobileScale?: number }) {
  return (
    <div style={{ position: 'relative', padding: 2, borderRadius: 'clamp(10px, 1vw, 16px)', zIndex: 4, width: isMobile ? '100%' : 'min(760px, 100%)' }}>
      {/* Welcome typewriter — sits in the dashboard space, fades out as dashboard projects in */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: 3.0, delay: 0, times: [0, 0.04, 0.78, 1], ease: 'easeInOut' }}
        style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 20, pointerEvents: 'none',
        }}
      >
        <WelcomeTypewriter isMobile={isMobile} />
      </motion.div>

      {/* Frame glow */}
      <div
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 'inherit',
          background: 'transparent',
          boxShadow: '0 0 0 1px rgba(19,32,74,0.08), 0 8px 32px rgba(19,32,74,0.10), 0 24px 50px rgba(19,32,74,0.06)',
        }}
      />

      {/* Screen */}
      <div style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16 / 10',
        borderRadius: 'clamp(8px, 0.8vw, 14px)',
        overflow: 'hidden',
        display: 'flex',
        background: '#FFFFFF',
      }}>
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 3.0, ease: [0.22, 1, 0.36, 1] }}
          style={{ position: 'absolute', top: 0, left: 0, width: isMobile ? 800 : '100%', height: isMobile ? 500 : '100%', display: 'flex', background: '#FFFFFF', ...(isMobile ? { zoom: mobileScale } : {}) }}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(19,32,74,0.12), rgba(19,32,74,0.06), rgba(19,32,74,0.12), transparent)', zIndex: 10 }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '30%', background: 'linear-gradient(to top, rgba(27,46,90,0.07), transparent)', pointerEvents: 'none', zIndex: 9 }} />

          {/* Sidebar */}
          <div style={{ width: '19%', background: '#F5F7FA', borderRight: '1px solid rgba(19,32,74,0.08)', padding: '10px 7px', display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={{ padding: '4px 5px', marginBottom: 10, display: 'flex', justifyContent: 'center' }}>
              <img src="https://res.cloudinary.com/dr9vzaa7u/image/upload/v1771698937/Zopkit-full_n7lm0f.png" alt="Zopkit" style={{ height: 30, width: 'auto', display: 'block' }} />
            </div>
            {SIDEBAR_ITEMS.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 5px', background: item.active ? 'rgba(19,32,74,0.08)' : 'transparent', borderRadius: 3, borderLeft: `2px solid ${item.active ? item.color : 'transparent'}`, marginBottom: 2 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: item.color, flexShrink: 0, boxShadow: item.active ? `0 0 6px ${item.color}` : 'none' }} />
                <div style={{ height: 3, flex: 1, background: item.active ? 'rgba(19,32,74,0.7)' : 'rgba(19,32,74,0.18)', borderRadius: 1 }} />
              </div>
            ))}
          </div>

          {/* Main content */}
          <div style={{ flex: 1, padding: '9px 12px', display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={TX('#13204A', 9, 600)}>AI Agent Orchestrator</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(19,32,74,0.06)', border: '1px solid rgba(19,32,74,0.15)', borderRadius: 100, padding: '2px 8px' }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#1b2e5a' }} />
                  <span style={TX('rgba(46,79,140,0.9)', 7, 600)}>5 Agents Running</span>
                </div>
              </div>
              <span style={TX('rgba(19,32,74,0.35)', 7)}>Live Sync</span>
            </div>

            {/* Orchestrator card */}
            <div style={{ background: 'rgba(27,71,180,0.06)', border: '1px solid rgba(27,71,180,0.22)', borderRadius: 8, padding: '8px 12px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(27,71,180,0.10), transparent 65%)', pointerEvents: 'none' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <RobotIcon color={BLUE} size={26} />
                  <div style={{ position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 2 }}>
                    {[0,1,2].map(i => <div key={i} style={{ width: 2, height: i === 1 ? 4 : 3, background: BLUE, borderRadius: 1 }} />)}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ ...TX(BLUE, 9, 700), textTransform: 'uppercase', letterSpacing: '0.12em' }}>Orchestrator</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#1b2e5a' }} />
                      <span style={TX('rgba(27,71,180,0.75)', 7, 500)}>Decision Engine Active</span>
                    </div>
                  </div>
                  <span style={TX('rgba(19,32,74,0.45)', 6.5)}>Aggregating sub-agent reports • Taking cross-system decisions</span>
                </div>
                <div style={{ background: 'rgba(27,71,180,0.10)', border: `1px solid rgba(27,71,180,0.28)`, borderRadius: 5, padding: '3px 8px', flexShrink: 0 }}>
                  <span style={TX(BLUE, 6.5, 600)}>⟳ Analyzing…</span>
                </div>
              </div>
              <div style={{ marginTop: 7, background: 'rgba(19,32,74,0.04)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 5, padding: '4px 9px', display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                <span style={TX('rgba(139,92,246,0.7)', 6.5, 600)}>DECISION</span>
                <span style={TX('#13204A', 7)}>Increase Q2 inventory 18%</span>
                <span style={{ ...TX('rgba(19,32,74,0.3)', 7), margin: '0 2px' }}>•</span>
                <span style={TX('#13204A', 7)}>Approve ₹32L payroll</span>
                <span style={{ ...TX('rgba(19,32,74,0.3)', 7), margin: '0 2px' }}>•</span>
                <span style={TX('#13204A', 7)}>Flag 3 CRM leads</span>
              </div>
            </div>

            {/* App labels + Connector lines */}
            <div style={{ position: 'relative', height: 44, flexShrink: 0, marginTop: 6 }}>
              {/* App name label chips — one above each column */}
              {AGENTS.map((agent, idx) => {
                const pct = 10 + idx * 20
                return (
                  <div key={agent.id} style={{
                    position: 'absolute', left: `${pct}%`, transform: 'translateX(-50%)',
                    top: 0, display: 'inline-flex', alignItems: 'center', gap: 3,
                    background: `${BLUE}0f`, border: `1px solid ${BLUE}30`,
                    borderRadius: 100, padding: '2px 7px', whiteSpace: 'nowrap',
                  }}>
                    <div style={{ width: 3.5, height: 3.5, borderRadius: '50%', background: '#1b2e5a', flexShrink: 0 }} />
                    <span style={{ ...TX(BLUE, 6, 600) }}>{agent.source} ✓</span>
                  </div>
                )
              })}
              {/* Connector lines */}
              <svg width="100%" height="20" style={{ display: 'block', overflow: 'visible', position: 'absolute', bottom: 0 }}>
                {AGENTS.map((agent, idx) => {
                  const pct = 10 + idx * 20
                  const x = `${pct}%`
                  return (
                    <g key={agent.id}>
                      <line x1={x} y1="0" x2={x} y2="20" stroke={BLUE} strokeWidth="1.2" strokeDasharray="4 3" strokeLinecap="round" opacity="0.45" />
                      <polygon points={`${pct - 1.2}%,4 ${pct + 1.2}%,4 ${pct}%,0`} fill={BLUE} opacity="0.55" />
                    </g>
                  )
                })}
              </svg>
            </div>

            {/* Sub-agent cards */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5, minHeight: 0 }}>
              {AGENTS.map((agent, agentIdx) => (
                <div key={agent.id} style={{ background: `#FFFFFF`, border: `1px solid ${agent.color}25`, borderTop: `3px solid ${agent.color}`, borderRadius: '0 0 7px 7px', padding: '6px 7px', display: 'flex', flexDirection: 'column', gap: 3, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 0%, ${agent.color}08, transparent 55%)`, pointerEvents: 'none' }} />
                  {/* Agent header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <RobotIcon color={agent.color} size={18} />
                    <div>
                      <span style={{ ...TX(agent.color, 7, 700), textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block' }}>Agent {agent.id}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 1 }}>
                        <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#1b2e5a' }} />
                        <span style={TX('rgba(19,32,74,0.55)', 6)}>Active</span>
                      </div>
                    </div>
                  </div>
                  {/* Source + primary metrics */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, borderTop: '1px solid rgba(19,32,74,0.07)', paddingTop: 3 }}>
                    <div style={{ width: 5, height: 5, borderRadius: 1, background: agent.color, flexShrink: 0 }} />
                    <span style={TX(agent.color, 7, 600)}>{agent.source}</span>
                  </div>
                  <span style={TX('#13204A', 7, 700)}>{agent.metric1}</span>
                  <span style={TX(`${agent.color}bb`, 6)}>{agent.metric2}</span>
                  {/* Mini bar chart */}
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 10, marginTop: 1 }}>
                    {agent.bars.map((h, bi) => (
                      <div key={bi} style={{ flex: 1, height: `${h * 100}%`, background: bi === agent.bars.length - 1 ? `${agent.color}ee` : `${agent.color}44`, borderRadius: '1px 1px 0 0' }} />
                    ))}
                  </div>
                  {/* Progress bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ flex: 1, height: 2, background: 'rgba(19,32,74,0.07)', borderRadius: 1, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${agent.progress}%`, background: `linear-gradient(90deg, ${agent.color}60, ${agent.color})`, borderRadius: 1 }} />
                    </div>
                    <span style={TX('rgba(19,32,74,0.4)', 6)}>{agent.progress}%</span>
                  </div>
                  {/* Live activity feed */}
                  <div style={{ borderTop: '1px solid rgba(19,32,74,0.07)', paddingTop: 4, marginTop: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 4 }}>
                      <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#1b2e5a' }} />
                      <span style={{ ...TX('rgba(19,32,74,0.35)', 5.5, 600), textTransform: 'uppercase', letterSpacing: '0.08em' }}>Live Feed</span>
                    </div>
                    {AGENT_FEEDS[agentIdx].map((item, fi) => (
                      <div key={fi} style={{ display: 'flex', alignItems: 'flex-start', gap: 4, marginBottom: 3 }}>
                        <div style={{ width: 3, height: 3, borderRadius: '50%', background: agent.color, opacity: 1 - fi * 0.25, flexShrink: 0, marginTop: 2 }} />
                        <span style={{ ...TX('rgba(19,32,74,0.6)', 5.5), lineHeight: 1.35 }}>{item}</span>
                      </div>
                    ))}
                  </div>
                  {/* Connected integrations */}
                  <div style={{ borderTop: '1px solid rgba(19,32,74,0.07)', paddingTop: 4, marginTop: 1 }}>
                    <span style={{ ...TX('rgba(19,32,74,0.35)', 5.5, 600), textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>Integrations</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                      {AGENT_INTEGRATIONS[agentIdx].map((intg, ii) => (
                        <div key={ii} style={{ display: 'flex', alignItems: 'center', gap: 2.5, background: `${intg.c}10`, border: `1px solid ${intg.c}30`, borderRadius: 3, padding: '1.5px 5px' }}>
                          <div style={{ width: 3.5, height: 3.5, borderRadius: '50%', background: intg.c, flexShrink: 0 }} />
                          <span style={{ ...TX(intg.c, 5.5, 600) }}>{intg.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  )
}

// ─── Light cone ────────────────────────────────────────────────────────────────
function LightCone() {
  return (
    <div
      style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2,
        opacity: 0,
        animation: 'zk-cone-in 0.55s ease-in 0.9s forwards',
      }}
    >
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none"
        style={{ display: 'block' }}>
        <defs>
          <linearGradient id="pp-cone-core" x1="50" y1="100" x2="50" y2="68" gradientUnits="userSpaceOnUse">
            <stop offset="0%"  stopColor="rgba(46,79,140,0.80)" />
            <stop offset="30%" stopColor="rgba(36,59,110,0.42)" />
            <stop offset="100%" stopColor="rgba(27,46,90,0.08)" />
          </linearGradient>
          <linearGradient id="pp-cone-wide" x1="50" y1="100" x2="50" y2="65" gradientUnits="userSpaceOnUse">
            <stop offset="0%"  stopColor="rgba(36,59,110,0.55)" />
            <stop offset="50%" stopColor="rgba(27,46,90,0.22)" />
            <stop offset="100%" stopColor="rgba(15,27,61,0.04)" />
          </linearGradient>
          <linearGradient id="pp-ray-l" x1="50" y1="100" x2="12" y2="68" gradientUnits="userSpaceOnUse">
            <stop offset="0%"  stopColor="rgba(120,160,220,1)" />
            <stop offset="45%" stopColor="rgba(46,79,140,0.75)" />
            <stop offset="100%" stopColor="rgba(27,46,90,0.20)" />
          </linearGradient>
          <linearGradient id="pp-ray-r" x1="50" y1="100" x2="88" y2="68" gradientUnits="userSpaceOnUse">
            <stop offset="0%"  stopColor="rgba(120,160,220,1)" />
            <stop offset="45%" stopColor="rgba(46,79,140,0.75)" />
            <stop offset="100%" stopColor="rgba(27,46,90,0.20)" />
          </linearGradient>
          <radialGradient id="pp-src-halo" cx="50" cy="100" r="12" gradientUnits="userSpaceOnUse">
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
        {/* Outer wide ambient cone */}
        <polygon points="50,100 10,68 90,68"  fill="url(#pp-cone-wide)" filter="url(#pp-f-wide)" opacity="0.85" />
        {/* Core beam */}
        <polygon points="50,100 20,68 80,68" fill="url(#pp-cone-core)" filter="url(#pp-f-soft)" opacity="0.9" />
        <polygon points="50,100 33,68 67,68" fill="url(#pp-cone-core)" filter="url(#pp-f-soft)" opacity="0.75" />
        {/* Inner bright center column */}
        <polygon points="50,100 43,68 57,68" fill="url(#pp-cone-core)" filter="url(#pp-f-soft)" opacity="0.9" />
        {/* Edge rays */}
        <line x1="50" y1="100" x2="20" y2="68" stroke="url(#pp-ray-l)" strokeWidth="0.7" filter="url(#pp-f-ray)" />
        <line x1="50" y1="100" x2="20" y2="68" stroke="url(#pp-ray-l)" strokeWidth="4"   filter="url(#pp-f-glow)" opacity="0.75" />
        <line x1="50" y1="100" x2="80" y2="68" stroke="url(#pp-ray-r)" strokeWidth="0.7" filter="url(#pp-f-ray)" />
        <line x1="50" y1="100" x2="80" y2="68" stroke="url(#pp-ray-r)" strokeWidth="4"   filter="url(#pp-f-glow)" opacity="0.75" />
        {/* Source halo at projector lens */}
        <ellipse cx="50" cy="100" rx="7" ry="2.5" fill="url(#pp-src-halo)" filter="url(#pp-f-halo)" />
        {/* Screen edge glow where beam hits dashboard bottom */}
        <line x1="20" y1="68" x2="80" y2="68" stroke="url(#pp-screen-glow)" strokeWidth="1.5" filter="url(#pp-f-edge)" />
        <circle cx="20" cy="68" r="1.5" fill="rgba(36,59,110,0.7)" filter="url(#pp-f-soft)" />
        <circle cx="80" cy="68" r="1.5" fill="rgba(36,59,110,0.7)" filter="url(#pp-f-soft)" />
      </svg>
    </div>
  )
}

// ─── Projector puck ────────────────────────────────────────────────────────────
function Projector({ isMobile }: { isMobile: boolean }) {
  return (
    <>
      <style>{PROJECTOR_STYLES}</style>
      <div
        style={{
          position: 'relative',
          width: isMobile ? 'clamp(120px, 36vw, 180px)' : 'clamp(110px, 14vw, 175px)',
          aspectRatio: '10 / 4.2',
          zIndex: 5,
          animation: isMobile ? 'none' : 'pp-float 5.5s ease-in-out infinite',
          filter: 'drop-shadow(0 16px 32px rgba(0,0,0,0.55)) drop-shadow(0 0 20px rgba(36,59,110,0.22))',
          willChange: 'transform',
          transform: 'translateZ(0)',
        }}
      >
        <div style={{ position: 'absolute', top: '22%', left: 0, right: 0, bottom: 0, background: 'linear-gradient(to bottom, #1c1c24 0%, #111118 30%, #08080e 70%, #040408 100%)', borderRadius: '0 0 50% 50% / 0 0 24% 24%', boxShadow: 'inset 8px 0 24px rgba(255,255,255,0.05),inset -8px 0 24px rgba(0,0,0,0.5),inset 0 -14px 30px rgba(0,0,0,0.8),inset 0 3px 8px rgba(255,255,255,0.03)', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '10%', background: 'linear-gradient(to right, rgba(255,255,255,0.08), transparent)' }} />
          <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: '10%', background: 'linear-gradient(to left, rgba(0,0,0,0.4), transparent)' }} />
          {[25, 50, 72].map(pct => <div key={pct} style={{ position: 'absolute', left: '8%', right: '8%', top: `${pct}%`, height: 1, background: 'rgba(255,255,255,0.04)' }} />)}
        </div>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '44%', background: 'radial-gradient(ellipse at 46% 36%, #28282e 0%, #181820 45%, #0c0c14 80%, #060610 100%)', borderRadius: '50%', zIndex: 2, boxShadow: 'inset 0 10px 24px rgba(255,255,255,0.06),inset 0 -6px 16px rgba(0,0,0,0.7),0 8px 24px rgba(0,0,0,0.7)' }}>
          <div style={{ position: 'absolute', top: '6%', left: '6%', right: '6%', bottom: '6%', borderRadius: '50%', boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.06), inset 0 0 12px rgba(0,0,0,0.7)' }} />
          <div style={{ position: 'absolute', top: '18%', left: '18%', right: '18%', bottom: '18%', borderRadius: '50%', background: 'radial-gradient(ellipse at 50% 42%, #1a1a22 0%, #0a0a12 100%)', boxShadow: 'inset 0 6px 16px rgba(0,0,0,0.95), inset 0 0 0 1px rgba(255,255,255,0.03)' }} />
          <div style={{ position: 'absolute', top: '22%', left: '22%', right: '22%', bottom: '22%', borderRadius: '50%', background: 'transparent', animation: 'pp-lens-pulse 2.6s ease-in-out infinite', willChange: 'opacity' }} />
          <div style={{ position: 'absolute', top: '30%', left: '30%', right: '30%', bottom: '30%', borderRadius: '50%', background: 'radial-gradient(circle at 44% 38%, #c8d8f0 0%, #6080b0 14%, #243b6e 38%, #1b2e5a 65%, #0f1b3d 100%)', boxShadow: 'inset 0 0 14px rgba(0,0,0,0.6)' }} />
          <div style={{ position: 'absolute', top: '40%', left: '40%', right: '40%', bottom: '40%', borderRadius: '50%', background: 'radial-gradient(circle, #ffffff 0%, #c8d8f8 45%, transparent 100%)', animation: 'pp-hotspot 2.6s ease-in-out infinite', willChange: 'opacity, transform' }} />
        </div>
        <div style={{ position: 'absolute', bottom: '-10%', left: '15%', right: '15%', height: '14%', borderRadius: '50%', background: 'rgba(0,0,0,0.7)', filter: 'blur(16px)', zIndex: 0 }} />
      </div>
    </>
  )
}

// ─── Side agent cards ──────────────────────────────────────────────────────────
const SIDE_LEFT = [
  {
    source: 'B2B CRM Agent', color: BLUE,
    feeds: ['Lead scored: Sharma & Co ₹8.4L', 'Follow-up queued: 12 accts', 'Pipeline updated: +18%'],
    integrations: ['CRM', 'Email', 'WApp', 'LinkedIn'],
  },
  {
    source: 'Finance Agent', color: BLUE,
    feeds: ['GST R1 filed: Aug 2025', 'Invoice #1247 reconciled', 'Cash flow: on track'],
    integrations: ['Tally', 'GST', 'Banking', 'RazorPay'],
  },
]
const SIDE_RIGHT = [
  {
    source: 'HRMS Agent', color: BLUE,
    feeds: ['Payroll: 284 emp processed', 'Leave approved: 7 requests', 'Compliance check: Clear'],
    integrations: ['ESIC', 'PF', 'Attd', 'Slack'],
  },
  {
    source: 'Projects Agent', color: BLUE,
    feeds: ['Sprint 14: 3 blockers fixed', 'Alpha delivery: updated ETA', 'Budget utilised: 82%'],
    integrations: ['Tasks', 'Git', 'Time', 'Jira'],
  },
]

type SideCard = { source: string; color: string; feeds: string[]; integrations: string[] }

function SideAgentCard({ source, color, feeds, integrations, isMobile = false }: SideCard & { isMobile?: boolean }) {
  if (isMobile) {
    return (
      <div style={{ background: '#FFFFFF', border: `1px solid ${color}25`, borderTop: `2px solid ${color}`, borderRadius: '0 0 8px 8px', padding: '4px 5px', overflow: 'hidden' }}>
        <span style={{ ...TX(color, 4.5, 700), textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 3 }}>{source}</span>
        {feeds.slice(0, 2).map((f, i) => (
          <div key={i} style={{ display: 'flex', gap: 2, marginBottom: 1.5 }}>
            <span style={{ ...TX(`${color}cc`, 4), flexShrink: 0 }}>■</span>
            <span style={{ ...TX('rgba(19,32,74,0.6)', 4), lineHeight: 1.3 }}>{f}</span>
          </div>
        ))}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginTop: 3 }}>
          {integrations.slice(0, 3).map((tag, i) => (
            <span key={i} style={{ ...TX(color, 4, 600), border: `1px solid ${color}35`, borderRadius: 3, padding: '1px 3px', background: `${color}08` }}>{tag}</span>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: '#FFFFFF', border: `1px solid ${color}20`, borderTop: `2px solid ${color}`, borderRadius: '0 0 12px 12px', padding: '10px 12px', overflow: 'hidden', boxShadow: '0 2px 20px rgba(19,32,74,0.08)' }}>
      {/* Card title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 9 }}>
        <div style={{ width: 20, height: 20, borderRadius: 5, overflow: 'hidden', flexShrink: 0 }}>
          <img src="https://res.cloudinary.com/dr9vzaa7u/image/upload/v1765126845/Zopkit_Simple_Logo_glohfr.jpg" alt="Zopkit" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
        <span style={{ ...TX(color, 8, 700), textTransform: 'uppercase', letterSpacing: '0.07em', flex: 1 }}>{source}</span>
      </div>

      {/* LIVE FEED */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
          <span style={{ ...TX('rgba(19,32,74,0.38)', 6, 600), textTransform: 'uppercase', letterSpacing: '0.10em' }}>Live Feed</span>
        </div>
        {feeds.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 5, marginBottom: i < feeds.length - 1 ? 4 : 0 }}>
            <span style={{ ...TX(`${color}bb`, 7.5, 700), flexShrink: 0, lineHeight: 1.4 }}>■</span>
            <span style={{ ...TX('rgba(19,32,74,0.62)', 7.5), lineHeight: 1.4 }}>{item}</span>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(19,32,74,0.07)', margin: '0 0 8px' }} />

      {/* INTEGRATIONS */}
      <div>
        <span style={{ ...TX('rgba(19,32,74,0.38)', 6, 600), textTransform: 'uppercase', letterSpacing: '0.10em', display: 'block', marginBottom: 5 }}>Integrations</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {integrations.map((tag, i) => (
            <span key={i} style={{ ...TX(color, 7, 600), border: `1px solid ${color}35`, borderRadius: 4, padding: '2px 7px', background: `${color}08`, letterSpacing: '0.03em' }}>{tag}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Floor glow ────────────────────────────────────────────────────────────────
function FloorGlow() {
  return (
    <>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 280, background: 'radial-gradient(ellipse 65% 100% at 50% 100%, rgba(27,46,90,0.07), transparent 70%)', pointerEvents: 'none', zIndex: 1 }} />
      <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 'min(280px, 36%)', height: 70, background: 'radial-gradient(ellipse at 50% 100%, rgba(27,46,90,0.14), transparent 65%)', pointerEvents: 'none', zIndex: 2 }} />
      <motion.div
        initial={{ opacity: 0, scaleX: 0.1 }}
        animate={{ opacity: [0, 0, 0.9, 0], scaleX: [0.1, 0.1, 1.4, 2.2] }}
        transition={{ duration: 0.6, delay: 0.8, times: [0, 0.01, 0.22, 1], ease: 'easeOut' }}
        style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 'min(340px, 44%)', height: 50, background: 'radial-gradient(ellipse at 50% 100%, rgba(46,79,140,0.55), rgba(27,46,90,0.20) 50%, transparent 75%)', pointerEvents: 'none', zIndex: 3, transformOrigin: 'center bottom' }}
      />
    </>
  )
}

// ─── Headline ──────────────────────────────────────────────────────────────────
function Headline({ isMobile }: { isMobile: boolean }) {
  return (
    <div style={{ textAlign: 'center', position: 'relative', zIndex: 3, maxWidth: 880, margin: '0 auto', width: '100%' }}>
      {/* Main headline */}
      <h1 style={{ margin: 0, fontFamily: '"Palatino Linotype","Book Antiqua",Palatino,Georgia,serif', fontStyle: 'italic', lineHeight: isMobile ? 1.1 : 1.15, letterSpacing: '-0.01em' }}>
        <motion.span initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
          style={{ display: 'block', fontSize: isMobile ? 'clamp(20px, 5.5vw, 26px)' : 'clamp(26px, 5vw, 40px)', fontWeight: 700, color: '#0f1b3d' }}>
          Intelligent agents
        </motion.span>
        <motion.span initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
          style={{ display: 'block', fontSize: isMobile ? 'clamp(17px, 4.8vw, 22px)' : 'clamp(22px, 4.5vw, 36px)', fontWeight: 700, color: '#1b2e5a' }}>
          driving influential decisions
        </motion.span>
        <motion.span initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.38, ease: [0.22, 1, 0.36, 1] }}
          style={{ display: 'block', fontSize: isMobile ? 'clamp(11px, 3vw, 13px)' : 'clamp(13px, 2.5vw, 20px)', fontWeight: 400, color: '#64748b', marginTop: isMobile ? 4 : 'clamp(4px, 0.6vw, 8px)' }}>
          across interconnected applications
        </motion.span>
      </h1>

      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.5, delay: 0.6, ease: 'easeOut' }}
        style={{ width: 40, height: 1, borderRadius: 1, background: 'linear-gradient(90deg, transparent, rgba(36,59,110,0.5), transparent)', margin: isMobile ? '12px auto 0' : 'clamp(12px, 1.5vw, 20px) auto 0' }}
      />
    </div>
  )
}

// ─── CTAs ──────────────────────────────────────────────────────────────────────
function HeroCTAs({ onBookDemo }: { onBookDemo?: () => void }) {
  return (
    <motion.div
      initial={{ y: 14 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, delay: 0.5, ease: 'easeOut' }}
      style={{ display: 'flex', gap: 12, marginTop: 20, position: 'relative', zIndex: 6, justifyContent: 'center', flexWrap: 'wrap' }}
    >
      <button
        onClick={onBookDemo}
        style={{ background: 'linear-gradient(135deg, #1b2e5a, #0f1b3d)', color: '#fff', border: '1px solid rgba(36,59,110,0.3)', borderRadius: 10, padding: '12px 28px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 8px 24px rgba(15,27,61,0.35)', transition: 'transform 0.15s ease, box-shadow 0.15s ease' }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 14px 32px rgba(15,27,61,0.5)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 24px rgba(15,27,61,0.35)' }}
      >
        Book a Demo
      </button>
      <button
        style={{ background: 'transparent', color: '#1b2e5a', border: '1.5px solid rgba(27,46,90,0.35)', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s ease, border-color 0.15s ease' }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(27,46,90,0.06)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(27,46,90,0.65)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(27,46,90,0.35)' }}
      >
        Learn More
      </button>
    </motion.div>
  )
}

// ─── Main export ───────────────────────────────────────────────────────────────
export function PetpoojaHeroSection({ onBookDemo: _onBookDemo }: { onBookDemo?: () => void }) {
  const isMobile = useMobile()
  const PUCK_H = isMobile ? 'clamp(50px, 14vw, 80px)' : 'clamp(40px, 5vw, 60px)'
  const dashboardScale = isMobile && typeof window !== 'undefined'
    ? Math.max(0.18, (window.innerWidth - 8 - 2 * Math.min(130, Math.max(80, 0.22 * window.innerWidth))) / 800)
    : 1

  return (
    <section
      style={{
        position: 'relative',
        width: '100%',
        minHeight: isMobile ? 'auto' : 480,
        background: '#ffffff',
        color: '#0f172a',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
        overflowX: 'clip',
        overflowY: 'visible',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: isMobile ? 'clamp(80px, 11vh, 104px)' : 'clamp(100px, 11vh, 124px)',
        paddingBottom: isMobile ? 40 : 90,
        paddingLeft: isMobile ? 4 : 24,
        paddingRight: isMobile ? 4 : 24,
        boxSizing: 'border-box',
        gap: isMobile ? 10 : 0,
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '50%', background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(36,59,110,0.06), transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      <FloorGlow />

      {/* Headline */}
      <div style={{ paddingLeft: isMobile ? 16 : 0, paddingRight: isMobile ? 16 : 0, width: '100%' }}>
        <Headline isMobile={isMobile} />
      </div>

      {/* ── [left cards] [screen] [right cards] — same layout on all screens ── */}
      <div style={{
        position: 'relative',
        marginTop: isMobile ? 8 : 'clamp(6px, 1vh, 14px)',
        width: '100%',
        maxWidth: 1320,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'center',
        gap: isMobile ? 8 : 64,
        paddingLeft: isMobile ? 4 : 0,
        paddingRight: isMobile ? 4 : 0,
        boxSizing: 'border-box',
      }}>
        {/* LEFT cards */}
        <motion.div
          initial={{ opacity: 0, x: -22 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 1.4, ease: [0.22, 1, 0.36, 1] }}
          style={{
            width: isMobile ? 'clamp(80px, 22vw, 130px)' : 'clamp(175px, 14vw, 210px)',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: isMobile ? 5 : 14,
            paddingTop: isMobile ? 'clamp(16px, 4vw, 32px)' : 'clamp(36px, 4vw, 56px)',
            zIndex: 5,
          }}
        >
          {SIDE_LEFT.map(card => <SideAgentCard key={card.source} {...card} isMobile={isMobile} />)}
        </motion.div>

        {/* CENTER — LightCone before DashboardMock so z-index stacking is clean */}
        <div style={{ flex: '1 1 auto', minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isMobile ? 8 : 'clamp(8px, 1.5vw, 16px)' }}>
          <LightCone />
          <DashboardMock isMobile={isMobile} mobileScale={dashboardScale} />
          <div style={{ width: isMobile ? 'clamp(90px, 22vw, 160px)' : 'clamp(180px, 24vw, 300px)', height: PUCK_H, flexShrink: 0 }} />
        </div>

        {/* RIGHT cards */}
        <motion.div
          initial={{ opacity: 0, x: 22 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 1.5, ease: [0.22, 1, 0.36, 1] }}
          style={{
            width: isMobile ? 'clamp(80px, 22vw, 130px)' : 'clamp(175px, 14vw, 210px)',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: isMobile ? 5 : 14,
            paddingTop: isMobile ? 'clamp(16px, 4vw, 32px)' : 'clamp(36px, 4vw, 56px)',
            zIndex: 5,
          }}
        >
          {SIDE_RIGHT.map(card => <SideAgentCard key={card.source} {...card} isMobile={isMobile} />)}
        </motion.div>

        {/* SVG connectors — desktop only */}
        {!isMobile && (
          <motion.svg
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 1.4 }}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 4, overflow: 'visible' }}
            viewBox="0 0 1320 720" preserveAspectRatio="none"
          >
            <defs />
            {/* B2B CRM Agent (top-left) → dashboard left edge */}
            <motion.path d="M 175,190 C 230,190 258,220 279,220" stroke={BLUE} strokeWidth="5" fill="none" strokeOpacity="0.10" pathLength={1} strokeDasharray={1} initial={{ strokeDashoffset: 1 }} animate={{ strokeDashoffset: 0 }} transition={{ duration: 0.6, delay: 1.5, ease: [0.22, 1, 0.36, 1] }} />
            <motion.path d="M 175,190 C 230,190 258,220 279,220" stroke={BLUE} strokeWidth="1.5" fill="none" strokeOpacity="0.55" pathLength={1} strokeDasharray={1} initial={{ strokeDashoffset: 1 }} animate={{ strokeDashoffset: 0 }} transition={{ duration: 0.6, delay: 1.5, ease: [0.22, 1, 0.36, 1] }} />
            <motion.path d="M 175,190 C 230,190 258,220 279,220" stroke={BLUE} strokeWidth="1" fill="none" strokeOpacity="0.30" strokeDasharray="4 8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 1.65 }} />
            <motion.circle cx="175" cy="190" r="4.5" fill={BLUE} opacity="0.9" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 0.9 }} transition={{ duration: 0.3, delay: 1.45, type: 'spring', stiffness: 300 }} />
            <motion.circle cx="279" cy="220" r="3.5" fill={BLUE} opacity="0.65" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 0.65 }} transition={{ duration: 0.3, delay: 1.65 }} />
            {/* Finance Agent (bottom-left) → dashboard left edge */}
            <motion.path d="M 175,355 C 230,355 258,370 279,370" stroke={BLUE} strokeWidth="5" fill="none" strokeOpacity="0.08" pathLength={1} strokeDasharray={1} initial={{ strokeDashoffset: 1 }} animate={{ strokeDashoffset: 0 }} transition={{ duration: 0.6, delay: 1.55, ease: [0.22, 1, 0.36, 1] }} />
            <motion.path d="M 175,355 C 230,355 258,370 279,370" stroke={BLUE} strokeWidth="1.5" fill="none" strokeOpacity="0.45" pathLength={1} strokeDasharray={1} initial={{ strokeDashoffset: 1 }} animate={{ strokeDashoffset: 0 }} transition={{ duration: 0.6, delay: 1.55, ease: [0.22, 1, 0.36, 1] }} />
            <motion.path d="M 175,355 C 230,355 258,370 279,370" stroke={BLUE} strokeWidth="1" fill="none" strokeOpacity="0.25" strokeDasharray="4 8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 1.7 }} />
            <motion.circle cx="175" cy="355" r="4.5" fill={BLUE} opacity="0.82" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 0.82 }} transition={{ duration: 0.3, delay: 1.5, type: 'spring', stiffness: 300 }} />
            <motion.circle cx="279" cy="370" r="3.5" fill={BLUE} opacity="0.58" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 0.58 }} transition={{ duration: 0.3, delay: 1.7 }} />
            {/* HRMS Agent (top-right) → dashboard right edge */}
            <motion.path d="M 1039,220 C 1060,220 1090,190 1145,190" stroke={BLUE} strokeWidth="5" fill="none" strokeOpacity="0.10" pathLength={1} strokeDasharray={1} initial={{ strokeDashoffset: 1 }} animate={{ strokeDashoffset: 0 }} transition={{ duration: 0.6, delay: 1.5, ease: [0.22, 1, 0.36, 1] }} />
            <motion.path d="M 1039,220 C 1060,220 1090,190 1145,190" stroke={BLUE} strokeWidth="1.5" fill="none" strokeOpacity="0.55" pathLength={1} strokeDasharray={1} initial={{ strokeDashoffset: 1 }} animate={{ strokeDashoffset: 0 }} transition={{ duration: 0.6, delay: 1.5, ease: [0.22, 1, 0.36, 1] }} />
            <motion.path d="M 1039,220 C 1060,220 1090,190 1145,190" stroke={BLUE} strokeWidth="1" fill="none" strokeOpacity="0.30" strokeDasharray="4 8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 1.65 }} />
            <motion.circle cx="1039" cy="220" r="3.5" fill={BLUE} opacity="0.65" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 0.65 }} transition={{ duration: 0.3, delay: 1.65 }} />
            <motion.circle cx="1145" cy="190" r="4.5" fill={BLUE} opacity="0.9" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 0.9 }} transition={{ duration: 0.3, delay: 1.45, type: 'spring', stiffness: 300 }} />
            {/* Projects Agent (bottom-right) → dashboard right edge */}
            <motion.path d="M 1039,370 C 1060,370 1090,355 1145,355" stroke={BLUE} strokeWidth="5" fill="none" strokeOpacity="0.08" pathLength={1} strokeDasharray={1} initial={{ strokeDashoffset: 1 }} animate={{ strokeDashoffset: 0 }} transition={{ duration: 0.6, delay: 1.6, ease: [0.22, 1, 0.36, 1] }} />
            <motion.path d="M 1039,370 C 1060,370 1090,355 1145,355" stroke={BLUE} strokeWidth="1.5" fill="none" strokeOpacity="0.45" pathLength={1} strokeDasharray={1} initial={{ strokeDashoffset: 1 }} animate={{ strokeDashoffset: 0 }} transition={{ duration: 0.6, delay: 1.6, ease: [0.22, 1, 0.36, 1] }} />
            <motion.path d="M 1039,370 C 1060,370 1090,355 1145,355" stroke={BLUE} strokeWidth="1" fill="none" strokeOpacity="0.25" strokeDasharray="4 8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 1.75 }} />
            <motion.circle cx="1039" cy="370" r="3.5" fill={BLUE} opacity="0.58" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 0.58 }} transition={{ duration: 0.3, delay: 1.75 }} />
            <motion.circle cx="1145" cy="355" r="4.5" fill={BLUE} opacity="0.82" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 0.82 }} transition={{ duration: 0.3, delay: 1.55, type: 'spring', stiffness: 300 }} />
          </motion.svg>
        )}
      </div>

      {/* Puck — fades in after headline is read */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.45, delay: 0.6, ease: 'easeOut' }}
        style={{
          position: 'absolute',
          bottom: isMobile ? 16 : 18,
          left: '50%',
          x: '-50%',
          zIndex: 10,
          willChange: 'opacity, transform',
        }}
      >
        <Projector isMobile={isMobile} />
      </motion.div>

    </section>
  )
}
