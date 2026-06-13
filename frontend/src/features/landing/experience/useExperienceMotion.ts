import { useEffect, useState } from 'react'

export function useExperienceMotion() {
  const [reduceMotion, setReduceMotion] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const motionMq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const mobileMq = window.matchMedia('(max-width: 767px)')

    const sync = () => {
      setReduceMotion(motionMq.matches)
      setIsMobile(mobileMq.matches)
    }

    sync()
    motionMq.addEventListener('change', sync)
    mobileMq.addEventListener('change', sync)
    return () => {
      motionMq.removeEventListener('change', sync)
      mobileMq.removeEventListener('change', sync)
    }
  }, [])

  return { reduceMotion, isMobile, disableWebGL: reduceMotion || isMobile }
}
