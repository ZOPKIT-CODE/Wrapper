import { config } from '@/lib/config'
import { landingFonts } from '../landing-typography'

const BLUE = '#4dc8ff'

const INK = {
  base: 'rgba(220, 245, 255, 0.94)',
  soft: 'rgba(94, 231, 255, 0.62)',
  muted: 'rgba(148, 200, 255, 0.48)',
  faint: 'rgba(94, 231, 255, 0.22)',
  border: 'rgba(94, 231, 255, 0.14)',
  borderMd: 'rgba(94, 231, 255, 0.26)',
  wash: 'rgba(94, 231, 255, 0.05)',
  washMd: 'rgba(94, 231, 255, 0.09)',
}

const TX = (color: string, size: number, weight = 500) => ({
  fontSize: size,
  fontWeight: weight,
  color,
  fontFamily: landingFonts.mono,
  lineHeight: 1.3,
  letterSpacing: '0.02em',
})

const AGENTS = [
  {
    id: 1,
    source: 'B2B CRM',
    color: BLUE,
    metric1: '~340 leads',
    metric2: 'Pipeline overview',
  },
  {
    id: 2,
    source: 'Finance',
    color: BLUE,
    metric1: 'Revenue summary',
    metric2: 'GST filing status',
  },
  {
    id: 3,
    source: 'Operations',
    color: BLUE,
    metric1: 'SKU catalog',
    metric2: 'Orders today',
  },
] as const

const HERO_MORE_AGENTS = 2
const HERO_AGENT_COLUMN_PCTS = [14, 42, 70] as const

const AGENT_FEEDS = [
  ['Lead scored: sample account', 'Pipeline updated (sample)'],
  ['GST return filed (sample)', 'Invoice reconciled'],
  ['Purchase order approved', 'Low stock alert'],
] as const

const AGENT_INTEGRATIONS = [
  [
    { label: 'CRM', c: BLUE },
    { label: 'Email', c: BLUE },
  ],
  [
    { label: 'Tally', c: BLUE },
    { label: 'GST Portal', c: BLUE },
  ],
  [
    { label: 'POS', c: BLUE },
    { label: 'Inventory', c: BLUE },
  ],
] as const

const SIDEBAR_ITEMS = [
  { color: BLUE, active: false },
  { color: BLUE, active: false },
  { color: BLUE, active: true },
  { color: BLUE, active: false },
  { color: BLUE, active: false },
  { color: BLUE, active: false },
]

function RobotIcon({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ display: 'block', flexShrink: 0 }}
      aria-hidden="true"
    >
      <line
        x1="12"
        y1="1.5"
        x2="12"
        y2="4.2"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="12" cy="1.2" r="1.2" fill={color} />
      <rect
        x="3"
        y="4.2"
        width="18"
        height="13.5"
        rx="3.2"
        fill="#0d1120"
        stroke={color}
        strokeWidth="1"
      />
      <rect
        x="1"
        y="8"
        width="2"
        height="5"
        rx="1"
        fill={color}
        opacity="0.45"
      />
      <rect
        x="21"
        y="8"
        width="2"
        height="5"
        rx="1"
        fill={color}
        opacity="0.45"
      />
      <rect
        x="5"
        y="6.8"
        width="14"
        height="5.5"
        rx="1.5"
        fill={color}
        fillOpacity="0.1"
        stroke={color}
        strokeWidth="0.5"
        strokeOpacity="0.5"
      />
      <polyline
        points="6.5,9.5 8,9.5 9,7.6 10.2,11.5 11.4,8.2 12.5,10.5 13.6,9.5 17.5,9.5"
        stroke={color}
        fill="none"
        strokeWidth="0.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="9"
        y="14.8"
        width="6"
        height="1.2"
        rx="0.6"
        fill={color}
        opacity="0.4"
      />
    </svg>
  )
}

/** Div-built orchestrator HUD — cinematic glass projection screen. */
export function HeroOrchestratorDashboard() {
  return (
    <>
      <div
        className="landing-hero-glass-window landing-hero-glass-window--sidebar"
        style={{
          width: '19%',
          padding: '10px 7px',
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
        }}
      >
        <div
          style={{
            padding: '6px 4px 10px',
            marginBottom: 8,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            borderBottom: `1px solid ${INK.border}`,
          }}
        >
          <img
            src={config.FULL_LOGO_URL}
            alt="Zopkit"
            style={{
              display: 'block',
              height: 26,
              width: 'auto',
              maxWidth: '100%',
              objectFit: 'contain',
              filter:
                'brightness(0) invert(1) opacity(0.94) drop-shadow(0 0 8px rgba(94, 231, 255, 0.3))',
            }}
          />
        </div>
        {SIDEBAR_ITEMS.map((item, i) => (
          <div
            key={i}
            className={
              item.active ? 'landing-hero-glass-nav-item--active' : undefined
            }
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 5px',
              borderRadius: 3,
              borderLeft: `2px solid ${item.active ? item.color : 'transparent'}`,
              marginBottom: 2,
            }}
          >
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: item.active ? item.color : 'transparent',
                flexShrink: 0,
                boxShadow: item.active ? `0 0 5px ${item.color}55` : 'none',
              }}
            />
            <div
              style={{
                height: 3,
                flex: 1,
                background: item.active ? 'rgba(94,231,255,0.45)' : INK.faint,
                borderRadius: 1,
              }}
            />
          </div>
        ))}
      </div>

      <div
        style={{
          flex: 1,
          padding: '9px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 7,
          }}
        >
          <span style={TX(INK.base, 9, 600)}>AI Agent Orchestrator</span>
          <span style={TX(INK.muted, 6.5)}>Sample workspace</span>
        </div>

        <div
          className="landing-hero-glass-window"
          style={{
            borderRadius: 8,
            padding: '8px 12px',
            position: 'relative',
          }}
        >
          <div
            className="landing-hero-glass-window__glow"
            style={{
              position: 'absolute',
              inset: 0,
              background: `radial-gradient(ellipse at 50% 0%, ${INK.washMd}, transparent 65%)`,
              pointerEvents: 'none',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <RobotIcon color={BLUE} size={26} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  ...TX(BLUE, 9, 700),
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  display: 'block',
                }}
              >
                Orchestrator
              </span>
              <span style={TX(INK.soft, 6.5)}>Cross-app decision engine</span>
            </div>
          </div>
          <div
            className="landing-hero-glass-chip"
            style={{
              marginTop: 7,
              borderRadius: 5,
              padding: '5px 9px',
            }}
          >
            <span style={TX(INK.base, 7)}>
              Sample queue: inventory, payroll, and CRM review
            </span>
          </div>
        </div>

        <div
          style={{
            position: 'relative',
            height: 44,
            flexShrink: 0,
            marginTop: 6,
          }}
        >
          {AGENTS.map((agent, idx) => {
            const pct = HERO_AGENT_COLUMN_PCTS[idx]
            return (
              <div
                key={agent.id}
                className="landing-hero-glass-chip"
                style={{
                  position: 'absolute',
                  left: `${pct}%`,
                  transform: 'translateX(-50%)',
                  top: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  borderRadius: 100,
                  padding: '2px 7px',
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ ...TX(BLUE, 6, 600) }}>{agent.source}</span>
              </div>
            )
          })}
          <div
            className="landing-hero-glass-chip"
            style={{
              position: 'absolute',
              left: '90%',
              transform: 'translateX(-50%)',
              top: 0,
              borderRadius: 100,
              padding: '2px 7px',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ ...TX(INK.muted, 6, 600) }}>
              +{HERO_MORE_AGENTS} agents
            </span>
          </div>
          <svg
            width="100%"
            height="20"
            style={{
              display: 'block',
              overflow: 'visible',
              position: 'absolute',
              bottom: 0,
            }}
            aria-hidden="true"
          >
            {AGENTS.map((agent, idx) => {
              const pct = HERO_AGENT_COLUMN_PCTS[idx]
              const x = `${pct}%`
              return (
                <g key={agent.id}>
                  <line
                    x1={x}
                    y1="0"
                    x2={x}
                    y2="20"
                    stroke={BLUE}
                    strokeWidth="1.2"
                    strokeDasharray="4 3"
                    strokeLinecap="round"
                    opacity="0.38"
                  />
                  <polygon
                    points={`${pct - 1.2}%,4 ${pct + 1.2}%,4 ${pct}%,0`}
                    fill={BLUE}
                    opacity="0.48"
                  />
                </g>
              )
            })}
          </svg>
        </div>

        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr) minmax(68px, 0.55fr)',
            gap: 5,
            minHeight: 0,
          }}
        >
          {AGENTS.map((agent, agentIdx) => (
            <div
              key={agent.id}
              className="landing-hero-glass-window landing-hero-glass-window--agent"
              style={{
                borderTopColor: agent.color,
                padding: '6px 7px',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                position: 'relative',
                minWidth: 0,
              }}
            >
              <div
                className="landing-hero-glass-window__glow"
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: `radial-gradient(ellipse at 50% 0%, ${agent.color}06, transparent 55%)`,
                  pointerEvents: 'none',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <RobotIcon color={agent.color} size={18} />
                <span
                  style={{
                    ...TX(agent.color, 7, 700),
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {agent.source}
                </span>
              </div>
              <span style={TX(INK.base, 7, 700)}>{agent.metric1}</span>
              <span style={{ ...TX(`${agent.color}bb`, 6) }}>
                {agent.metric2}
              </span>
              <div
                style={{
                  borderTop: `1px solid ${INK.border}`,
                  paddingTop: 4,
                }}
              >
                <span
                  style={{
                    ...TX(INK.muted, 5.5, 600),
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    display: 'block',
                    marginBottom: 4,
                  }}
                >
                  Activity
                </span>
                {AGENT_FEEDS[agentIdx].map((item, fi) => (
                  <div key={fi} style={{ marginBottom: fi === 0 ? 3 : 0 }}>
                    <span style={{ ...TX(INK.soft, 5.5), lineHeight: 1.35 }}>
                      {item}
                    </span>
                  </div>
                ))}
              </div>
              <div
                style={{
                  borderTop: `1px solid ${INK.border}`,
                  paddingTop: 4,
                }}
              >
                <span
                  style={{
                    ...TX(INK.muted, 5.5, 600),
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    display: 'block',
                    marginBottom: 4,
                  }}
                >
                  Integrations
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {AGENT_INTEGRATIONS[agentIdx].map((intg, ii) => (
                    <div
                      key={ii}
                      className="landing-hero-glass-tag"
                      style={{ borderRadius: 4, padding: '1.5px 5px' }}
                    >
                      <span style={{ ...TX(intg.c, 5.5, 600) }}>
                        {intg.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
          <div
            className="landing-hero-glass-window landing-hero-glass-window--agent"
            style={{
              borderTopColor: INK.borderMd,
              padding: '8px 6px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              textAlign: 'center',
            }}
          >
            <span style={{ ...TX(INK.muted, 6, 600) }}>
              +{HERO_MORE_AGENTS}
            </span>
            <span
              style={{
                ...TX(INK.soft, 5.5, 600),
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                lineHeight: 1.35,
              }}
            >
              agents
            </span>
          </div>
        </div>
      </div>
    </>
  )
}
