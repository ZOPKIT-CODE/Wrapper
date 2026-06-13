import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useExperienceMotion } from './useExperienceMotion'

gsap.registerPlugin(ScrollTrigger)

const PILLARS = [
  {
    index: '01',
    title: 'Shared identity',
    body: 'One login and role model across every module. IT provisions once, not per app.',
  },
  {
    index: '02',
    title: 'Shared records',
    body: 'Customers, employees, and vendors stay aligned when CRM, HR, and finance update the same core data.',
  },
  {
    index: '03',
    title: 'Shared billing',
    body: 'Subscriptions and credits run through a single account. Finance sees the full picture.',
  },
  {
    index: '04',
    title: 'Workflow engine',
    body: 'Lead-to-cash and hire-to-retire sequences run as connected automations, not handoffs.',
  },
]

export function ExperiencePlatform() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const { reduceMotion, isMobile } = useExperienceMotion()

  useEffect(() => {
    if (reduceMotion || isMobile || !wrapRef.current || !trackRef.current)
      return

    const track = trackRef.current
    const distance = track.scrollWidth - window.innerWidth + 48

    const ctx = gsap.context(() => {
      gsap.to(track, {
        x: -distance,
        ease: 'none',
        scrollTrigger: {
          trigger: wrapRef.current,
          start: 'top top',
          end: () => `+=${distance}`,
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
          anticipatePin: 1,
        },
      })
    }, wrapRef)

    return () => ctx.revert()
  }, [reduceMotion, isMobile])

  return (
    <div ref={wrapRef} className="xp-platform-wrap">
      <div className="xp-platform-pin">
        <div className="xp-platform-header">
          <h2 className="xp-platform-title xp-display">
            Built as one system, not a bundle of tabs
          </h2>
        </div>
        <div ref={trackRef} className="xp-platform-track">
          {PILLARS.map((pillar) => (
            <article key={pillar.index} className="xp-platform-card">
              <span className="xp-platform-card-index">{pillar.index}</span>
              <h3 className="xp-display">{pillar.title}</h3>
              <p>{pillar.body}</p>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
