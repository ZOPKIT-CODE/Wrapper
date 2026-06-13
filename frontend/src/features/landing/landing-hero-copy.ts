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

// ─── Ch1 — ball enters from top to center ─────────────────────────────────────

const ch1 = {
  enterDelay: 0,
  enterDur: 0.65,
} as const

const CH1_END = ch1.enterDelay + ch1.enterDur

// ─── Ch2 — ball projects hero copy (steady cone, line-by-line) ───────────────

const ch2 = {
  copyBeamOn: CH1_END,
  line1: CH1_END,
  line2: CH1_END + 0.22,
  subtext: CH1_END + 0.44,
  divider: CH1_END + 0.66,
  cta: CH1_END + 0.88,
  lineDur: 0.32,
  subtextDur: 0.28,
  dividerDur: 0.24,
  ctaDur: 0.32,
  copyBeamOff: CH1_END + 1.05,
  copyBeamRetractDur: 0.22,
  copyBeamGrowDur: 0.18,
} as const

const CH2_END = ch2.copyBeamOff + ch2.copyBeamRetractDur

// ─── Ch3 — straight descent + upward tilt ────────────────────────────────────

const ch3 = {
  travelDelay: CH2_END + 0.06,
  travelDur: 0.85,
  tiltDeg: 24,
  /** Fraction into travel when rotateX begins (0–1). */
  tiltStartFrac: 0.38,
} as const

const TRAVEL_END = ch3.travelDelay + ch3.travelDur

// ─── Ch4 — ball morphs into puck ─────────────────────────────────────────────

const ch4 = {
  puckMorphDelay: TRAVEL_END,
  puckMorphDur: 0.42,
} as const

const puckDelay = ch4.puckMorphDelay
const CH4_END = puckDelay + ch4.puckMorphDur

// ─── Ch5 — puck projects orchestrator + side rails ───────────────────────────

const ch5 = {
  coneDelay: CH4_END + 0.05,
  coneDur: 0.55,
  screenDur: 0.52,
  sideDur: 0.38,
  sideStagger: 0.04,
  connLead: 0.1,
} as const

const screenDelay = ch5.coneDelay + ch5.coneDur
const sideLeft = screenDelay + ch5.screenDur
const sideRight = sideLeft + ch5.sideStagger
const connectors = sideRight + ch5.sideDur + ch5.connLead

const conn = (offset: number) => connectors + offset

/** Staged hero story — robo-ball projects copy, morphs to puck, projects HUD. */
export const landingHeroMotion = {
  ch1,
  ch1End: CH1_END,
  ch2,
  ch2End: CH2_END,
  ch3,
  ch3End: TRAVEL_END,
  ch4,
  ch4End: CH4_END,
  ch5,

  /** @deprecated use ch2 */
  act2: ch2,
  act2End: CH2_END,

  ballCenterDelay: ch1.enterDelay,
  ballCenterFallDur: ch1.enterDur,

  /** @deprecated scan flash removed — copy cone replaces it */
  scanFlashDelay: CH1_END - 0.18,
  scanFlashDur: 0.28,

  ballDescentDelay: ch3.travelDelay,
  ballDescentDur: ch3.travelDur,
  puckDelay,
  puckMorphDur: ch4.puckMorphDur,

  coneDelay: ch5.coneDelay,
  coneDur: ch5.coneDur,
  screenDelay,
  screenDur: ch5.screenDur,
  sideLeft,
  sideRight,
  sideDur: ch5.sideDur,
  connectors,

  floorBurst: ch5.coneDelay + 0.08,

  conn: {
    crmDot: conn(0.05),
    crmPath: conn(0.1),
    crmFlow: conn(0.32),
    crmEnd: conn(0.32),
    finDot: conn(0.12),
    finPath: conn(0.18),
    finFlow: conn(0.36),
    finEnd: conn(0.36),
    hrmsDot: conn(0.1),
    hrmsPath: conn(0.15),
    hrmsFlow: conn(0.34),
    hrmsEnd: conn(0.34),
    projDot: conn(0.15),
    projPath: conn(0.2),
    projFlow: conn(0.38),
    projEnd: conn(0.38),
  },
} as const
