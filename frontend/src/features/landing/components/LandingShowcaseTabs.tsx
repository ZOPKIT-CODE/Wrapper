import { cn } from '@/lib/utils';

import type { LandingScreenshotTab } from '@/features/landing/landing-screenshots';



type LandingShowcaseTabsProps = {

  tabs: LandingScreenshotTab[];

  activeId: string;

  onChange: (id: string) => void;

  layout?: 'horizontal' | 'vertical';

  className?: string;

};



export function LandingShowcaseTabs({

  tabs,

  activeId,

  onChange,

  layout = 'horizontal',

  className,

}: LandingShowcaseTabsProps) {

  const isVertical = layout === 'vertical';



  return (

    <div

      role="tablist"

      aria-label="Product modules"

      className={cn(isVertical ? 'flex flex-col gap-0.5' : 'flex flex-wrap gap-x-5 gap-y-2', className)}

    >

      {tabs.map((tab) => {

        const selected = tab.id === activeId;

        return (

          <button

            key={tab.id}

            type="button"

            role="tab"

            aria-selected={selected}

            id={`showcase-tab-${tab.id}`}

            aria-controls={`showcase-panel-${tab.id}`}

            onClick={() => onChange(tab.id)}

            className={cn(

              'landing-showcase-tab text-left transition-colors cursor-pointer',

              isVertical

                ? 'landing-showcase-tab--vertical px-3.5 py-2.5 min-w-[148px]'

                : 'landing-showcase-tab--horizontal px-0 py-1 text-xs font-medium',

              selected

                ? 'text-foreground'

                : 'text-muted-foreground hover:text-foreground'

            )}

          >

            <span className={cn('block', isVertical ? 'text-sm font-medium' : 'text-xs font-medium')}>

              {tab.label}

            </span>

            {isVertical && (

              <span className="mt-0.5 block text-[11px] text-muted-foreground leading-snug font-normal">

                {tab.caption}

              </span>

            )}

          </button>

        );

      })}

    </div>

  );

}

