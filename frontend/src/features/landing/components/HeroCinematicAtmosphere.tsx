import { useEffect, useRef, useState } from 'react'
import { landingHeroLayout } from '../landing-hero-copy'

type Particle = {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  size: number
  alpha: number
}

function initParticles(count: number, w: number, h: number): Particle[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    z: Math.random(),
    vx: (Math.random() - 0.5) * 0.18,
    vy: -0.08 - Math.random() * 0.22,
    size: 0.6 + Math.random() * 2.2,
    alpha: 0.15 + Math.random() * 0.55,
  }))
}

function particleCount(w: number, h: number, compact: boolean) {
  const density = compact ? 22000 : 14000
  return Math.min(Math.floor((w * h) / density), compact ? 48 : 90)
}

function HeroCinematicCanvas({ compact }: { compact: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let particles: Particle[] = []
    let visible = true

    const drawFrame = (animate: boolean) => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      ctx.clearRect(0, 0, w, h)

      for (const p of particles) {
        if (animate) {
          p.x += p.vx
          p.y += p.vy
          if (p.y < -4) {
            p.y = h + 4
            p.x = Math.random() * w
          }
          if (p.x < -4) p.x = w + 4
          if (p.x > w + 4) p.x = -4
        }

        const depth = 0.4 + p.z * 0.6
        const size = p.size * depth
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 3)
        g.addColorStop(0, `rgba(200, 240, 255, ${p.alpha * depth})`)
        g.addColorStop(0.4, `rgba(94, 231, 255, ${p.alpha * 0.35 * depth})`)
        g.addColorStop(1, 'rgba(94, 231, 255, 0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(p.x, p.y, size * 3, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      const dpr = Math.min(window.devicePixelRatio || 1, compact ? 1.5 : 2)
      const w = parent.clientWidth
      const h = parent.clientHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      particles = initParticles(particleCount(w, h, compact), w, h)
    }

    const start = () => {
      cancelAnimationFrame(raf)
      if (motionQuery.matches || !visible) {
        drawFrame(false)
        return
      }

      const loop = () => {
        drawFrame(true)
        raf = requestAnimationFrame(loop)
      }
      loop()
    }

    resize()
    start()

    const onMotionChange = () => start()
    motionQuery.addEventListener('change', onMotionChange)
    window.addEventListener('resize', resize)

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting
        start()
      },
      { rootMargin: '64px' }
    )
    io.observe(canvas)

    return () => {
      cancelAnimationFrame(raf)
      motionQuery.removeEventListener('change', onMotionChange)
      window.removeEventListener('resize', resize)
      io.disconnect()
    }
  }, [compact])

  return <canvas ref={canvasRef} />
}

function useDeferredAtmosphere() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const start = () => setReady(true)
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(start, { timeout: 900 })
      return () => window.cancelIdleCallback(id)
    }
    const id = setTimeout(start, 350)
    return () => clearTimeout(id)
  }, [])

  return ready
}

function useCompactAtmosphere() {
  const [compact, setCompact] = useState(() =>
    typeof window !== 'undefined'
      ? window.innerWidth <= landingHeroLayout.compactMax
      : false
  )

  useEffect(() => {
    const mq = window.matchMedia(
      `(max-width: ${landingHeroLayout.compactMax}px)`
    )
    setCompact(mq.matches)
    const handler = (e: MediaQueryListEvent) => setCompact(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return compact
}

/** Floating particles + lens bloom overlay for holographic hero. */
export function HeroCinematicAtmosphere() {
  const ready = useDeferredAtmosphere()
  const compact = useCompactAtmosphere()

  return (
    <div className="hero-cine-atmosphere" aria-hidden="true">
      {ready && <HeroCinematicCanvas compact={compact} />}
      <div className="hero-cine-bloom" />
      <div className="hero-cine-anamorphic" />
    </div>
  )
}
