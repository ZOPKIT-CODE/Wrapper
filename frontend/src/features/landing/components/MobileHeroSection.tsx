// Mobile hero — pixel-perfect desktop composition (1440×1280) scaled to mobile width.
// Ported from the design file: 4 corner agent cards, central white monitor, serif headline.

const HD_W = 1440;
const HD_H = 1280;

const T = {
  ink: '#13204A',
  inkSoft: '#3A4674',
  muted: '#7C84A0',
  borderLight: 'rgba(19,32,74,0.08)',
  panelLight: '#F5F7FA',
  cardLight: '#FFFFFF',
  green: '#4DC18A',
};

const AGENTS = [
  { label: 'B2B CRM',    accent: '#5B8DEF', kpi: '342 Leads',     status: '₹12.4M pipeline', pct: 87 },
  { label: 'Finance',    accent: '#4DC18A', kpi: '₹84.2L Rev',    status: '100% GST filed',  pct: 94 },
  { label: 'Operations', accent: '#E9A24B', kpi: '1,247 SKUs',    status: '34 Orders today', pct: 72 },
  { label: 'HRMS',       accent: '#9B7BE0', kpi: '284 Employees', status: '98% Attendance',  pct: 91 },
  { label: 'Projects',   accent: '#4ED4D4', kpi: '47 Projects',   status: '12 Due this week',pct: 68 },
];

interface SideCardProps {
  label: string; accent: string; kpi: string; status: string; pct: number;
  top: number; left?: number; right?: number;
}

const SIDE_CARDS: SideCardProps[] = [
  { label: 'B2B CRM',  accent: '#5B8DEF', kpi: '342 Leads',      status: '₹12.4M pipeline',  pct: 87, top: 440, left: 20 },
  { label: 'Finance',  accent: '#4DC18A', kpi: '₹84.2L Revenue', status: '100% GST filed',   pct: 94, top: 810, left: 20 },
  { label: 'HRMS',     accent: '#9B7BE0', kpi: '284 Employees',  status: '98% Attendance',   pct: 91, top: 440, right: 20 },
  { label: 'Projects', accent: '#4ED4D4', kpi: '47 Projects',    status: '12 Due this week', pct: 68, top: 810, right: 20 },
];

const DESC: Record<string, string> = {
  'B2B CRM':  'Scoring inbound leads & auto-assigning follow-ups based on deal size',
  'Finance':  'Reconciling transactions, filing GST returns & projecting cash flow',
  'HRMS':     'Tracking attendance, running payroll & surfacing compliance alerts',
  'Projects': 'Monitoring sprint health, detecting blockers & reallocating bandwidth',
};

const NOTE: Record<string, string> = {
  'B2B CRM':  'Flagged 3 high-value leads for Q2 review',
  'Finance':  'Auto-reconciled 218 entries · ₹2.1L variance resolved',
  'HRMS':     'Payroll processed for 284 employees · 2 alerts pending',
  'Projects': 'Rescheduled 2 sprints · 4 blockers auto-escalated',
};

function HDHeadline() {
  return (
    <div style={{ position: 'absolute', top: 90, left: 0, right: 0, textAlign: 'center' }}>
      <h1 style={{
        fontFamily: '"Cormorant Garamond", "Palatino Linotype", Palatino, Georgia, serif',
        fontStyle: 'italic', fontWeight: 500, fontSize: 96,
        lineHeight: 1.05, color: T.ink, margin: 0, letterSpacing: '-0.02em',
      }}>
        Intelligent agents<br />
        driving influential decisions
      </h1>
      <p style={{
        fontFamily: '"Cormorant Garamond", "Palatino Linotype", Palatino, Georgia, serif',
        fontStyle: 'italic', fontSize: 36, color: T.inkSoft,
        margin: '18px 0 0', fontWeight: 400,
      }}>
        across interconnected applications
      </p>
    </div>
  );
}

function HDConnectors() {
  return (
    <svg width={HD_W} height={HD_H} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <defs>
        <linearGradient id="mhc1" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#5B8DEF" stopOpacity="0.85"/>
          <stop offset="100%" stopColor="#5B8DEF" stopOpacity="0.15"/>
        </linearGradient>
        <linearGradient id="mhc2" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#4DC18A" stopOpacity="0.85"/>
          <stop offset="100%" stopColor="#4DC18A" stopOpacity="0.15"/>
        </linearGradient>
        <linearGradient id="mhc3" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0%" stopColor="#9B7BE0" stopOpacity="0.85"/>
          <stop offset="100%" stopColor="#9B7BE0" stopOpacity="0.15"/>
        </linearGradient>
        <linearGradient id="mhc4" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0%" stopColor="#4ED4D4" stopOpacity="0.85"/>
          <stop offset="100%" stopColor="#4ED4D4" stopOpacity="0.15"/>
        </linearGradient>
      </defs>
      {/* TL card → monitor */}
      <path d="M 220 540 C 280 540 300 600 340 600" stroke="url(#mhc1)" strokeWidth="2.5" fill="none"/>
      {/* BL card → monitor */}
      <path d="M 220 910 C 280 910 300 850 340 850" stroke="url(#mhc2)" strokeWidth="2.5" fill="none"/>
      {/* TR card → monitor */}
      <path d="M 1220 540 C 1160 540 1140 600 1100 600" stroke="url(#mhc3)" strokeWidth="2.5" fill="none"/>
      {/* BR card → monitor */}
      <path d="M 1220 910 C 1160 910 1140 850 1100 850" stroke="url(#mhc4)" strokeWidth="2.5" fill="none"/>
      <circle cx="220" cy="540" r="4" fill="#5B8DEF"/>
      <circle cx="220" cy="910" r="4" fill="#4DC18A"/>
      <circle cx="1220" cy="540" r="4" fill="#9B7BE0"/>
      <circle cx="1220" cy="910" r="4" fill="#4ED4D4"/>
    </svg>
  );
}

function HDSideCard({ label, accent, kpi, status, pct, top, left, right }: SideCardProps) {
  const desc = DESC[label] ?? '';
  const note = NOTE[label] ?? '';
  return (
    <div style={{
      position: 'absolute', top, left, right,
      width: 200, height: 290,
      background: T.cardLight, borderRadius: 14, padding: '14px 16px',
      border: `1px solid ${T.borderLight}`,
      borderTopWidth: 3, borderTopColor: accent,
      boxShadow: '0 24px 60px -20px rgba(19,32,74,0.18), 0 1px 3px rgba(19,32,74,0.04)',
      overflow: 'hidden',
    }}>
      {/* accent radial glow */}
      <div style={{
        position: 'absolute', top: -50, right: -50, width: 160, height: 160, borderRadius: '50%',
        background: `radial-gradient(circle, ${accent}1F, transparent 70%)`,
      }}/>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 22, height: 22, borderRadius: 5,
          background: `${accent}28`, border: `1px solid ${accent}55`,
          display: 'grid', placeItems: 'center',
        }}>
          <svg width="12" height="12" viewBox="0 0 14 14">
            <rect x="2" y="3" width="10" height="7" rx="1.5" fill="none" stroke={accent} strokeWidth="1.3"/>
            <circle cx="5" cy="6.5" r="0.8" fill={accent}/>
            <circle cx="9" cy="6.5" r="0.8" fill={accent}/>
            <path d="M7 1v2" stroke={accent} strokeWidth="1.3"/>
          </svg>
        </div>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700,
          color: T.ink, letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>{label}</div>
      </div>
      {/* agent status */}
      <div style={{
        fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#2E9B6A',
        display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, marginLeft: 30,
      }}>
        <span style={{ width: 5, height: 5, borderRadius: 99, background: T.green, display: 'inline-block' }}/>
        Agent Active
      </div>
      {/* description */}
      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: T.inkSoft, marginTop: 10, lineHeight: 1.45 }}>{desc}</div>
      {/* KPI */}
      <div style={{ background: T.panelLight, border: `1px solid ${T.borderLight}`, borderRadius: 7, padding: '8px 10px', marginTop: 10 }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700, color: T.ink }}>{kpi}</div>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: T.muted, marginTop: 1 }}>Primary KPI</div>
      </div>
      {/* Status */}
      <div style={{ background: T.panelLight, border: `1px solid ${T.borderLight}`, borderRadius: 7, padding: '8px 10px', marginTop: 6 }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700, color: T.ink }}>{status}</div>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: T.muted, marginTop: 1 }}>Status</div>
      </div>
      {/* segmented progress bar */}
      <div style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', gap: 3, height: 6 }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} style={{
              flex: 1, borderRadius: 1.5,
              background: (i + 1) / 12 * 100 <= pct ? accent : 'rgba(19,32,74,0.08)',
            }}/>
          ))}
        </div>
        <div style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: accent, marginTop: 4, fontWeight: 700 }}>{pct}%</div>
      </div>
      {/* activity note */}
      <div style={{
        marginTop: 8, padding: '7px 9px',
        background: T.panelLight, borderRadius: 6, border: `1px solid ${T.borderLight}`,
        display: 'flex', gap: 6, alignItems: 'flex-start',
        fontFamily: 'JetBrains Mono, monospace', fontSize: 9.5, lineHeight: 1.4, color: T.inkSoft,
      }}>
        <span style={{ color: accent, marginTop: 3, fontSize: 7 }}>●</span>
        <span>{note}</span>
      </div>
    </div>
  );
}

function HDMonitor() {
  return (
    <div style={{
      position: 'absolute', top: 420, left: '50%', transform: 'translateX(-50%)',
      width: 760, height: 580,
      background: T.cardLight, borderRadius: 22, padding: 4,
      boxShadow: '0 60px 100px -30px rgba(19,32,74,0.22), 0 0 0 1px rgba(19,32,74,0.04)',
      border: `4px solid ${T.panelLight}`,
    }}>
      <div style={{
        width: '100%', height: '100%', borderRadius: 18,
        background: T.cardLight, position: 'relative', overflow: 'hidden',
        padding: '18px 20px', border: `1px solid ${T.borderLight}`,
      }}>
        {/* header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 15, fontWeight: 700, color: T.ink }}>AI Agent Orchestrator</div>
            <div style={{
              padding: '3px 9px', borderRadius: 999,
              background: 'rgba(77,193,138,0.14)',
              fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#2E9B6A',
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: 99, background: T.green, display: 'inline-block' }}/>
              5 Agents Running
            </div>
          </div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: T.muted }}>Live Sync</div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 16, height: 'calc(100% - 50px)' }}>
          {/* sidebar */}
          <div style={{
            width: 120, background: T.panelLight,
            borderRadius: 9, border: `1px solid ${T.borderLight}`,
            padding: '12px 9px', display: 'flex', flexDirection: 'column', gap: 11,
          }}>
            <div style={{ height: 12, borderRadius: 3, background: 'rgba(19,32,74,0.10)' }}/>
            <div style={{ height: 1, background: T.borderLight }}/>
            {['#5B8DEF','#4DC18A','#E9A24B','#9B7BE0','#4ED4D4','#F47878','#7AE0B0'].map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 5, height: 5, borderRadius: 99, background: c }}/>
                <div style={{ flex: 1, height: 8, borderRadius: 2.5, background: i === 1 ? 'rgba(19,32,74,0.18)' : 'rgba(19,32,74,0.07)' }}/>
              </div>
            ))}
          </div>

          {/* main panel */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* orchestrator card */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(155,123,224,0.10), rgba(91,141,239,0.06))',
              border: '1px solid rgba(155,123,224,0.30)', borderRadius: 11, padding: '12px 14px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 7,
                    background: 'rgba(155,123,224,0.16)', border: '1px solid rgba(155,123,224,0.40)',
                    display: 'grid', placeItems: 'center',
                  }}>
                    <svg width="18" height="18" viewBox="0 0 20 20">
                      <rect x="3" y="6" width="14" height="10" rx="2" fill="none" stroke="#7B5FC8" strokeWidth="1.4"/>
                      <circle cx="7" cy="11" r="1.2" fill="#7B5FC8"/>
                      <circle cx="13" cy="11" r="1.2" fill="#7B5FC8"/>
                      <path d="M10 2v4" stroke="#7B5FC8" strokeWidth="1.4"/>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700, color: '#7B5FC8', letterSpacing: '0.1em' }}>
                      ORCHESTRATOR
                      <span style={{ color: '#2E9B6A', marginLeft: 9, fontSize: 10, fontWeight: 500, letterSpacing: '0.04em' }}>● Decision Engine Active</span>
                    </div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: T.muted, marginTop: 4 }}>
                      Aggregating sub-agent reports · Taking cross-system decisions
                    </div>
                  </div>
                </div>
                <div style={{
                  padding: '4px 9px', borderRadius: 5,
                  background: 'rgba(155,123,224,0.16)', border: '1px solid rgba(155,123,224,0.30)',
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#7B5FC8',
                }}>◔ Analyzing…</div>
              </div>
              <div style={{
                marginTop: 10, padding: '7px 11px',
                background: T.panelLight, borderRadius: 5, border: `1px solid ${T.borderLight}`,
                fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: T.inkSoft,
                display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center',
              }}>
                <span style={{ color: '#C77E1F', fontWeight: 700 }}>DECISION</span>
                <span>Increase Q2 inventory 18%</span>
                <span style={{ opacity: 0.4 }}>·</span>
                <span>Approve ₹32L payroll</span>
                <span style={{ opacity: 0.4 }}>·</span>
                <span>Flag 3 CRM leads</span>
              </div>
            </div>

            {/* agent chip row */}
            <div style={{ display: 'flex', gap: 14 }}>
              {AGENTS.map(a => (
                <div key={a.label} style={{
                  flex: 1, padding: '5px 8px', borderRadius: 5,
                  background: `${a.accent}14`, border: `1px solid ${a.accent}55`,
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: T.ink, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 5, height: 5, borderRadius: 99, background: a.accent, display: 'inline-block' }}/>
                    {a.label}
                  </span>
                  <svg width="9" height="9" viewBox="0 0 10 10">
                    <path d="M2 5l2 2 4-4" stroke={a.accent} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              ))}
            </div>

            {/* dotted vertical connectors */}
            <div style={{ display: 'flex', gap: 18, height: 12 }}>
              {AGENTS.map(a => (
                <div key={a.label} style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                  <div style={{
                    width: 1, height: 12,
                    backgroundImage: `linear-gradient(to bottom, ${a.accent}, ${a.accent} 3px, transparent 3px, transparent 6px)`,
                    backgroundSize: '1px 6px',
                  }}/>
                </div>
              ))}
            </div>

            {/* 5 agent panel grid (second screen) */}
            <div style={{
              flex: 1, display: 'flex', gap: 18, padding: 12,
              background: T.panelLight, border: `1px solid ${T.borderLight}`, borderRadius: 10,
            }}>
              {AGENTS.map((a, i) => (
                <div key={a.label} style={{
                  flex: 1, background: T.cardLight,
                  border: `1px solid ${T.borderLight}`, borderTop: `2px solid ${a.accent}`,
                  borderRadius: 9, padding: '9px 9px 10px',
                  display: 'flex', flexDirection: 'column',
                  boxShadow: '0 1px 2px rgba(19,32,74,0.04)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 16, height: 16, borderRadius: 3, background: `${a.accent}1F`, border: `1px solid ${a.accent}66`, display: 'grid', placeItems: 'center' }}>
                      <div style={{ width: 5, height: 5, borderRadius: 1, background: a.accent }}/>
                    </div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fontWeight: 700, color: T.ink, letterSpacing: '0.05em' }}>AGENT {i + 1}</div>
                  </div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8, color: '#2E9B6A', marginTop: 2, marginLeft: 21, display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ width: 3, height: 3, borderRadius: 99, background: T.green, display: 'inline-block' }}/>Active
                  </div>
                  <div style={{ height: 1, background: T.borderLight, margin: '8px 0' }}/>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 7, height: 7, borderRadius: 1.5, background: a.accent, display: 'inline-block' }}/>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 700, color: T.ink }}>{a.label}</span>
                  </div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700, color: T.ink, marginTop: 5 }}>{a.kpi}</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: T.muted, marginTop: 1 }}>{a.status}</div>
                  <div style={{ flex: 1 }}/>
                  <div style={{ display: 'flex', gap: 1.5, height: 5, marginTop: 7 }}>
                    {Array.from({ length: 10 }).map((_, j) => (
                      <div key={j} style={{ flex: 1, borderRadius: 1, background: (j + 1) / 10 * 100 <= a.pct ? a.accent : 'rgba(19,32,74,0.08)' }}/>
                    ))}
                  </div>
                  <div style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontSize: 8, color: a.accent, marginTop: 3, fontWeight: 700 }}>{a.pct}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HDSpeaker() {
  return (
    <div style={{ position: 'absolute', bottom: 60, left: '50%', transform: 'translateX(-50%)' }}>
      <div style={{
        position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)',
        width: 480, height: 130, borderRadius: '50%',
        border: '1px solid rgba(91,141,239,0.10)', pointerEvents: 'none',
      }}/>
      <div style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: 360, height: 100, borderRadius: '50%',
        border: '1px solid rgba(91,141,239,0.18)', pointerEvents: 'none',
      }}/>
      <div style={{
        position: 'relative', width: 240, height: 80, borderRadius: '50%',
        background: 'radial-gradient(circle at 50% 25%, #1a2540 0%, #0a0e1f 65%, #000 100%)',
        boxShadow: '0 24px 50px rgba(0,0,0,0.4), inset 0 -8px 18px rgba(0,0,0,0.6)',
      }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 84, height: 26, borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(180,210,255,0.85), rgba(91,141,239,0.4) 50%, transparent 80%)',
          filter: 'blur(2px)',
        }}/>
      </div>
    </div>
  );
}

function HeroComposition() {
  return (
    <div style={{
      width: HD_W, height: HD_H,
      background: '#FFFFFF',
      position: 'relative', overflow: 'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif',
    }}>
      <HDHeadline />
      <HDConnectors />
      {SIDE_CARDS.map(card => (
        <HDSideCard key={card.label} {...card} />
      ))}
      <HDMonitor />
      <HDSpeaker />
    </div>
  );
}

// Visible content ends at y≈1240 (speaker base bottom). Clip dead space below.
const HD_VISIBLE_H = 1240;
// Fixed navbar height — keeps the composition below the pill navbar (matches original hero paddingTop).
const NAV_OFFSET = 96;

export function MobileHeroSection() {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 390;
  const scale = vw / HD_W;
  const scaledContentH = Math.round(HD_VISIBLE_H * scale);
  return (
    <div style={{
      width: '100%',
      height: scaledContentH + NAV_OFFSET,
      position: 'relative',
      overflow: 'hidden',
      background: '#FFFFFF',
    }}>
      <div style={{
        width: HD_W, height: HD_H,
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        position: 'absolute',
        top: NAV_OFFSET,
        left: 0,
      }}>
        <HeroComposition />
      </div>
    </div>
  );
}
