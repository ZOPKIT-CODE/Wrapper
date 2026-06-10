import { cn } from '@/lib/utils';



type LandingBrowserFrameProps = {

  url: string;

  children: React.ReactNode;

  className?: string;

  contentClassName?: string;

  maxContentHeight?: number;

  variant?: 'default' | 'hero' | 'ghost';

  clipFade?: boolean;

};



export function LandingBrowserFrame({

  url,

  children,

  className,

  contentClassName,

  maxContentHeight = 480,

  variant = 'default',

  clipFade = true,

}: LandingBrowserFrameProps) {

  const isGhost = variant === 'ghost';

  const isHero = variant === 'hero';



  return (

    <div

      className={cn(

        'landing-browser-frame rounded-md border overflow-hidden bg-background',

        isGhost

          ? 'border-border/50 shadow-none'

          : isHero

            ? 'landing-browser-frame--hero border-border/80 shadow-[0_32px_100px_-32px_rgba(15,23,42,0.35)] ring-1 ring-foreground/[0.04]'

            : 'border-border/80 shadow-[0_24px_80px_-24px_rgba(15,23,42,0.28)]',

        className

      )}

    >

      {!isGhost && (

        <div className="landing-browser-chrome flex items-center gap-0 px-3 sm:px-4 py-2.5 border-b border-border/70 bg-background">

          <div className="flex gap-1.5 mr-3 shrink-0" aria-hidden="true">

            <div className="w-[10px] h-[10px] sm:w-[11px] sm:h-[11px] rounded-full bg-window-dot-close" />

            <div className="w-[10px] h-[10px] sm:w-[11px] sm:h-[11px] rounded-full bg-window-dot-minimize" />

            <div className="w-[10px] h-[10px] sm:w-[11px] sm:h-[11px] rounded-full bg-window-dot-maximize" />

          </div>

          <div className="flex-1 min-w-0">

            <div

              className="landing-browser-url landing-mono rounded px-2.5 py-1 text-[10px] sm:text-[11px] truncate text-center mx-auto text-muted-foreground"

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

          'relative overflow-hidden bg-background',

          clipFade && 'landing-browser-clip',

          contentClassName

        )}

        style={{ maxHeight: maxContentHeight }}

      >

        {children}

      </div>

    </div>

  );

}

