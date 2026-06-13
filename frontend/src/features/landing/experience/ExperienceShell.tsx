import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import '@/features/landing/landing.css'
import '@/features/landing/experience/experience.css'

type ExperienceShellProps = {
  children: ReactNode
  className?: string
}

export function ExperienceShell({ children, className }: ExperienceShellProps) {
  return (
    <div
      data-landing
      data-landing-theme="experience"
      className={cn('min-h-screen overflow-x-clip antialiased', className)}
    >
      <div className="xp-grain" aria-hidden="true" />
      {children}
    </div>
  )
}
