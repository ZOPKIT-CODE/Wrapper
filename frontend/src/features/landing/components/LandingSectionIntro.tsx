import { cn } from '@/lib/utils'

type LandingSectionIntroProps = {
  eyebrow: string
  title: string
  lead?: string
  className?: string
  titleClassName?: string
  /** @default true — set false when wrapped in LandingScrollReveal */
  animate?: boolean
}

export function LandingSectionIntro({
  eyebrow,
  title,
  lead,
  className,
  titleClassName,
  animate = true,
}: LandingSectionIntroProps) {
  return (
    <div className={cn(animate && 'landing-fade-in', 'max-w-3xl', className)}>
      <p className="landing-section-eyebrow">{eyebrow}</p>
      <h2 className={cn('landing-section-heading mt-2', titleClassName)}>
        {title}
      </h2>
      {lead ? <p className="landing-lead mt-4 max-w-[65ch]">{lead}</p> : null}
    </div>
  )
}
