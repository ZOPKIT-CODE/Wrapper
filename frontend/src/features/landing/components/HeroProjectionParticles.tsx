import { useMemo, type CSSProperties } from 'react'
import { useReducedMotion } from 'framer-motion'
import { landingHeroMotion } from '../landing-hero-copy'

/** Matches cone SVG: apex bottom-center → top spans 16%–84% (±34%). */
const CONE_HALF = 34

type ParticleKind = 'speck' | 'dust' | 'streak' | 'flare'

type Particle = {
  id: number
  kind: ParticleKind
  angle: number
  delay: number
  duration: number
  size: number
  depth: number
  peak: number
  wobble: number
  drift: number
  rot: number
}

function seeded(seed: number): number {
  const x = Math.sin(seed * 127.1 + seed * 311.7) * 43758.5453
  return x - Math.floor(x)
}

function buildParticles(
  count: number,
  coneDelay: number,
  coneDur: number
): Particle[] {
  const kinds: ParticleKind[] = ['speck', 'dust', 'streak', 'flare']
  const weights = [0.4, 0.44, 0.12, 0.04]

  return Array.from({ length: count }, (_, i) => {
    const r0 = seeded(i + 1)
    const r1 = seeded(i + 11)
    const r2 = seeded(i + 23)
    const r3 = seeded(i + 37)
    const r4 = seeded(i + 53)

    let roll = r0
    let kind: ParticleKind = 'dust'
    for (let k = 0; k < kinds.length; k += 1) {
      roll -= weights[k]
      if (roll <= 0) {
        kind = kinds[k]
        break
      }
    }

    // Bias toward center rays (brighter core) with some edge scatter
    const angle = (r1 ** 1.4 * 2 - 1) * (kind === 'flare' ? 0.55 : 0.96)
    const depth = 0.15 + r2 * 0.85
    const spreadAtTop = angle * CONE_HALF
    const rot = Math.atan2(100, spreadAtTop || 0.001) * (180 / Math.PI) - 90

    const size =
      kind === 'speck'
        ? 0.45 + r3 * 0.95
        : kind === 'dust'
          ? 1.1 + r3 * 2.2
          : kind === 'streak'
            ? 1.2 + r3 * 1.8
            : 4 + r3 * 5

    const peak =
      kind === 'flare'
        ? 0.2 + r4 * 0.16
        : kind === 'speck'
          ? 0.5 + r4 * 0.42
          : 0.34 + r4 * 0.38

    const duration =
      kind === 'streak'
        ? 1.05 + r2 * 0.65
        : kind === 'flare'
          ? 2.4 + r2 * 1.4
          : kind === 'speck'
            ? 0.95 + r2 * 0.75
            : 1.05 + r2 * 0.85

    return {
      id: i,
      kind,
      angle,
      delay: coneDelay + coneDur * 0.3 + r1 * 1.85 + (i / count) * 0.04,
      duration,
      size,
      depth,
      peak,
      wobble: (r3 - 0.5) * 2.8,
      drift: (r4 - 0.5) * 1.6,
      rot,
    }
  })
}

type HeroProjectionParticlesProps = {
  isMobile?: boolean
}

export function HeroProjectionParticles({
  isMobile = false,
}: HeroProjectionParticlesProps) {
  const reduceMotion = useReducedMotion()
  const m = landingHeroMotion

  const { motes, streaks, flares } = useMemo(() => {
    const count = isMobile ? 46 : 92
    const all = buildParticles(count, m.coneDelay, m.coneDur)
    return {
      motes: all.filter((p) => p.kind === 'speck' || p.kind === 'dust'),
      streaks: all.filter((p) => p.kind === 'streak'),
      flares: all.filter((p) => p.kind === 'flare'),
    }
  }, [isMobile, m.coneDelay, m.coneDur])

  if (reduceMotion) return null

  const styleFor = (p: Particle): CSSProperties =>
    ({
      '--p-angle': p.angle,
      '--p-delay': `${p.delay}s`,
      '--p-dur': `${p.duration}s`,
      '--p-size': `${p.size}px`,
      '--p-depth': p.depth,
      '--p-peak': p.peak,
      '--p-wobble': p.wobble,
      '--p-drift': p.drift,
      '--p-rot': `${p.rot}deg`,
    }) as CSSProperties

  return (
    <div className="hero-projection-particles" aria-hidden="true">
      <div className="hero-projection-particles__haze" />
      <div className="hero-projection-particles__layer hero-projection-particles__layer--flares">
        {flares.map((p) => (
          <span
            key={p.id}
            className="hero-projection-particles__flare"
            style={styleFor(p)}
          />
        ))}
      </div>
      <div className="hero-projection-particles__layer hero-projection-particles__layer--streaks">
        {streaks.map((p) => (
          <span
            key={p.id}
            className="hero-projection-particles__streak"
            style={styleFor(p)}
          />
        ))}
      </div>
      <div className="hero-projection-particles__layer hero-projection-particles__layer--motes">
        {motes.map((p) => (
          <span
            key={p.id}
            className={
              p.kind === 'speck'
                ? 'hero-projection-particles__speck'
                : 'hero-projection-particles__dust'
            }
            style={styleFor(p)}
          />
        ))}
      </div>
    </div>
  )
}
