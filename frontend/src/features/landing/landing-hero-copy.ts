/** Shared hero copy — desktop + mobile stay in sync. */

export const landingHeroCopy = {
  headlineLine1: 'CRM, finance, and ops agents',
  headlineLine2: 'on one shared workspace',
  subtext: 'Shared identity, records, and billing across every module.',
} as const

/** Layout breakpoints for hero stage (px). */
export const landingHeroLayout = {
  sideRailMin: 1100,
  compactMax: 1199,
} as const

// ─── Act 1 — ball arrives center + scan flash ─────────────────────────────────

const act1 = {
  ballCenterDelay: 0,
  ballCenterFallDur: 0.8,
  scanFlashDelay: 0.68,
  scanFlashDur: 0.5,
} as const

const ACT1_END = act1.scanFlashDelay + act1.scanFlashDur

// ─── Act 2 — hero copy + CTAs ────────────────────────────────────────────────

const act2 = {
  line1: ACT1_END + 0.04,
  line2: ACT1_END + 0.14,
  subtext: ACT1_END + 0.28,
  divider: ACT1_END + 0.4,
  cta: ACT1_END + 0.5,
  headlineDur: 0.75,
  lineDur: 0.62,
  subtextDur: 0.52,
  dividerDur: 0.42,
  ctaDur: 0.48,
} as const

const ACT2_END = act2.cta + act2.ctaDur + 0.14

// ─── Act 3 — ball descends → puck morph ──────────────────────────────────────

const act3 = {
  ballDescentDelay: ACT2_END,
  ballDescentDur: 0.9,
  puckMorphDur: 0.48,
} as const

const puckDelay = act3.ballDescentDelay + act3.ballDescentDur
const ACT3_END = puckDelay + act3.puckMorphDur

// ─── Act 4 — beam → screen → side cards ─────────────────────────────────────

const act4 = {
  coneDur: 0.78,
  screenDur: 0.74,
  sideDur: 0.5,
  sideStagger: 0.06,
  connLead: 0.14,
} as const

const coneDelay = ACT3_END
const screenDelay = coneDelay + act4.coneDur
const sideLeft = screenDelay + act4.screenDur
const sideRight = sideLeft + act4.sideStagger
const connectors = sideRight + act4.connLead

const conn = (offset: number) => connectors + offset

/** Staged 4-act hero choreography (time-based on load). */
export const landingHeroMotion = {
  act1,
  act1End: ACT1_END,
  act2,
  act2End: ACT2_END,
  act3,
  act3End: ACT3_END,
  act4,

  /** @deprecated use act2 — kept for headline components */
  scene1: { ...act2, end: ACT2_END },

  ballCenterDelay: act1.ballCenterDelay,
  ballCenterFallDur: act1.ballCenterFallDur,
  scanFlashDelay: act1.scanFlashDelay,
  scanFlashDur: act1.scanFlashDur,

  ballDescentDelay: act3.ballDescentDelay,
  ballDescentDur: act3.ballDescentDur,
  puckDelay,
  puckMorphDur: act3.puckMorphDur,

  coneDelay,
  coneDur: act4.coneDur,
  screenDelay,
  screenDur: act4.screenDur,
  sideLeft,
  sideRight,
  sideDur: act4.sideDur,
  connectors,

  floorBurst: coneDelay + 0.1,

  conn: {
    crmDot: conn(0.08),
    crmPath: conn(0.16),
    crmFlow: conn(0.5),
    crmEnd: conn(0.5),
    finDot: conn(0.2),
    finPath: conn(0.28),
    finFlow: conn(0.56),
    finEnd: conn(0.56),
    hrmsDot: conn(0.16),
    hrmsPath: conn(0.24),
    hrmsFlow: conn(0.52),
    hrmsEnd: conn(0.52),
    projDot: conn(0.24),
    projPath: conn(0.32),
    projFlow: conn(0.6),
    projEnd: conn(0.6),
  },
} as const
