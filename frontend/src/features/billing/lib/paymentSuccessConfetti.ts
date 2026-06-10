// @ts-expect-error - canvas-confetti may lack types
import confetti from 'canvas-confetti'

/** Navy / indigo / blue — reads as “deep blue” confetti on dark pages */
export const DEEP_BLUE_CONFETTI = [
  '#0a1628',
  '#0f2744',
  '#172554',
  '#1e3a8a',
  '#1d4ed8',
  '#2563eb',
  '#1e40af',
  '#312e81',
  '#1e293b',
  '#38bdf8',
]

/**
 * Huge confetti: heavy streams from lower-left and lower-right, converging toward upper-center (~1s).
 * canvas-confetti: angle 90 = up; ~60 = up-right from left; ~120 = up-left from right.
 */
export function fireDeepBlueConfetti() {
  const confettiFn =
    typeof confetti === 'function'
      ? confetti
      : (confetti as { default?: typeof confetti })?.default
  if (!confettiFn) return

  const base = {
    colors: DEEP_BLUE_CONFETTI,
    ticks: 320,
    gravity: 0.85,
    scalar: 1.35,
    decay: 0.91,
    drift: 0.04,
  }

  /** Big fan from left edge, aimed toward center-top */
  const fromLeft = (y = 0.88, particles = 100) => {
    confettiFn({
      ...base,
      particleCount: particles,
      angle: 58,
      spread: 72,
      startVelocity: 52,
      origin: { x: 0, y },
    })
    confettiFn({
      ...base,
      particleCount: Math.floor(particles * 0.45),
      angle: 68,
      spread: 55,
      startVelocity: 48,
      origin: { x: 0.04, y: y - 0.06 },
      scalar: 1.15,
    })
  }

  /** Big fan from right edge, aimed toward center-top */
  const fromRight = (y = 0.88, particles = 100) => {
    confettiFn({
      ...base,
      particleCount: particles,
      angle: 122,
      spread: 72,
      startVelocity: 52,
      origin: { x: 1, y },
    })
    confettiFn({
      ...base,
      particleCount: Math.floor(particles * 0.45),
      angle: 112,
      spread: 55,
      startVelocity: 48,
      origin: { x: 0.96, y: y - 0.06 },
      scalar: 1.15,
    })
  }

  const salvo = () => {
    fromLeft(0.9, 120)
    fromRight(0.9, 120)
  }

  salvo()
  setTimeout(salvo, 140)
  setTimeout(() => {
    fromLeft(0.82, 90)
    fromRight(0.82, 90)
  }, 280)
  setTimeout(salvo, 520)

  const started = Date.now()
  const durationMs = 1000
  let tick = 0
  const id = window.setInterval(() => {
    if (Date.now() - started >= durationMs) {
      window.clearInterval(id)
      return
    }
    tick += 1
    const y = 0.78 + (tick % 5) * 0.04
    const n = 38 + (tick % 3) * 12
    if (tick % 2 === 0) {
      fromLeft(y, n)
    } else {
      fromRight(y, n)
    }
  }, 110)
}
