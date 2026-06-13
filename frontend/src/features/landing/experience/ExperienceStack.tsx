import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useExperienceMotion } from './useExperienceMotion'

gsap.registerPlugin(ScrollTrigger)

const STACK = [
  {
    title: 'Revenue teams run on live pipeline data',
    body: 'CRM scores leads, finance sees booked revenue, and operations knows what shipped without exporting spreadsheets.',
    stat: '342',
    label: 'active leads tracked in one workspace',
  },
  {
    title: 'People and payroll stay in sync',
    body: 'HRMS attendance, project allocations, and finance payouts reference the same employee records your admins already trust.',
    stat: '98%',
    label: 'attendance accuracy across locations',
  },
  {
    title: 'Operations close the loop on every order',
    body: 'Inventory, procurement, and vendor payments connect so fulfillment teams act on current stock, not yesterday’s export.',
    stat: '1.2k',
    label: 'SKUs reconciled daily',
  },
]

export function ExperienceStack() {
  const rootRef = useRef<HTMLDivElement>(null)
  const { reduceMotion, isMobile } = useExperienceMotion()

  useEffect(() => {
    if (reduceMotion || isMobile || !rootRef.current) return

    const cards = gsap.utils.toArray<HTMLElement>(
      '.xp-stack-card',
      rootRef.current
    )

    const ctx = gsap.context(() => {
      cards.forEach((card, index) => {
        if (index === cards.length - 1) return

        ScrollTrigger.create({
          trigger: card,
          start: 'top top+=80',
          endTrigger: cards[cards.length - 1],
          end: 'top top+=80',
          pin: true,
          pinSpacing: false,
        })

        gsap.to(card, {
          scale: 0.94,
          opacity: 0.45,
          filter: 'blur(2px)',
          ease: 'none',
          scrollTrigger: {
            trigger: cards[index + 1],
            start: 'top bottom',
            end: 'top top+=120',
            scrub: true,
          },
        })
      })
    }, rootRef)

    return () => ctx.revert()
  }, [reduceMotion, isMobile])

  return (
    <section ref={rootRef} className="xp-stack-section" aria-label="Use cases">
      {STACK.map((item) => (
        <article key={item.title} className="xp-stack-card">
          <div>
            <h3 className="xp-display">{item.title}</h3>
            <p>{item.body}</p>
          </div>
          <div>
            <div className="xp-stack-stat">{item.stat}</div>
            <div className="xp-stack-stat-label">{item.label}</div>
          </div>
        </article>
      ))}
    </section>
  )
}
