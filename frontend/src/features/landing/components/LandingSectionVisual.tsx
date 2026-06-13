import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { SectionVisualConfig } from '../landing-section-visuals'
import './landing-section-visual.css'

type LandingSectionVisualProps = SectionVisualConfig & {
  className?: string
  variant?:
    | 'default'
    | 'compact'
    | 'wide'
    | 'card'
    | 'industry'
    | 'product'
    | 'illustration'
  children?: ReactNode
}

const LIGHT_PANEL_VARIANTS = new Set(['industry', 'product', 'illustration'])

export function LandingSectionVisual({
  src,
  alt,
  objectFit = 'cover',
  className,
  variant = 'default',
  children,
}: LandingSectionVisualProps) {
  const isLightPanel = LIGHT_PANEL_VARIANTS.has(variant)
  const isIndustryPhoto = variant === 'industry' && objectFit === 'cover'
  const isIllustration = variant === 'illustration'

  return (
    <div
      className={cn(
        'landing-section-visual',
        `landing-section-visual--${variant}`,
        isIndustryPhoto && 'landing-section-visual--industry-photo',
        className
      )}
    >
      <div
        className="landing-section-visual__frame"
        {...(children ? { role: 'img', 'aria-label': alt } : {})}
      >
        {children ?? (
          <img
            src={src}
            alt={alt}
            className={cn(
              'landing-section-visual__image',
              objectFit === 'contain' &&
                'landing-section-visual__image--contain'
            )}
            loading="lazy"
            decoding="async"
          />
        )}
        {!isLightPanel && (
          <div className="landing-section-visual__scrim" aria-hidden="true" />
        )}
        {!isIndustryPhoto && !isIllustration && (
          <div
            className={cn(
              'landing-section-visual__grid',
              isLightPanel &&
                !isIllustration &&
                'landing-section-visual__grid--subtle'
            )}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  )
}
