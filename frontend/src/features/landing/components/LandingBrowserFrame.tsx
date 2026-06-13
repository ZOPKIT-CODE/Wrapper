import { cn } from '@/lib/utils'

type LandingBrowserFrameProps = {
  url: string

  children: React.ReactNode

  className?: string

  contentClassName?: string

  maxContentHeight?: number

  variant?: 'default' | 'hero' | 'ghost'

  clipFade?: boolean
}

export function LandingBrowserFrame({
  url,

  children,

  className,

  contentClassName,

  maxContentHeight = 480,

  variant = 'default',

  clipFade = true,
}: LandingBrowserFrameProps) {
  const isGhost = variant === 'ghost'

  const isHero = variant === 'hero'

  return (
    <div
      className={cn(
        'landing-browser-frame bg-background overflow-hidden rounded-md border',

        isGhost
          ? 'border-border/50 shadow-none'
          : isHero
            ? 'landing-browser-frame--hero border-border/80 ring-foreground/[0.04] shadow-[0_32px_100px_-32px_rgba(15,23,42,0.35)] ring-1'
            : 'border-border/80 shadow-[0_24px_80px_-24px_rgba(15,23,42,0.28)]',

        className
      )}
    >
      {!isGhost && (
        <div className="landing-browser-chrome border-border/70 bg-background flex items-center gap-0 border-b px-3 py-2.5 sm:px-4">
          <div className="mr-3 flex shrink-0 gap-1.5" aria-hidden="true">
            <div className="bg-window-dot-close h-[10px] w-[10px] rounded-full sm:h-[11px] sm:w-[11px]" />

            <div className="bg-window-dot-minimize h-[10px] w-[10px] rounded-full sm:h-[11px] sm:w-[11px]" />

            <div className="bg-window-dot-maximize h-[10px] w-[10px] rounded-full sm:h-[11px] sm:w-[11px]" />
          </div>

          <div className="min-w-0 flex-1">
            <div
              className="landing-browser-url landing-mono text-muted-foreground mx-auto truncate rounded px-2.5 py-1 text-center text-[10px] sm:text-[11px]"
              style={{ maxWidth: '280px' }}
            >
              {url}
            </div>
          </div>

          <div className="w-8 shrink-0" aria-hidden="true" />
        </div>
      )}

      <div
        className={cn(
          'bg-background relative overflow-hidden',

          clipFade && 'landing-browser-clip',

          contentClassName
        )}
        style={{ maxHeight: maxContentHeight }}
      >
        {children}
      </div>
    </div>
  )
}
