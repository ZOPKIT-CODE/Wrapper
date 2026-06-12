import { Badge } from '@/components/ui/badge'
import { STATES } from '../../schemas'
import { UserClassification } from '../FlowSelector'
import { Info } from 'lucide-react'

interface StateStepProps {
  selectedState: string
  onSelect: (stateId: string) => void
  userClassification?: UserClassification
}

export const StateStep = ({
  selectedState,
  onSelect,
  userClassification,
}: StateStepProps) => {
  const content = {
    title: 'Jurisdiction',
    description:
      'Select the state where you wish to incorporate. Delaware is recommended for most startups.',
    recommended: 'delaware',
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-4">
          {userClassification && userClassification !== 'aspiringFounder' && (
            <Badge
              variant="outline"
              className="bg-brand-50 text-brand-700 border-brand-200 rounded-full px-3 py-1 text-xs font-bold tracking-wide uppercase"
            >
              {userClassification.replace(/([A-Z])/g, ' $1').trim()}
            </Badge>
          )}
        </div>
        <h1 className="text-primary mb-3 text-3xl font-extrabold tracking-tight md:text-4xl">
          {content.title}
        </h1>
        <p className="text-muted-foreground max-w-2xl text-lg leading-relaxed">
          {content.description}
        </p>
      </div>

      <div className="grid max-w-3xl grid-cols-2 gap-5 sm:grid-cols-3">
        {STATES.map((state) => {
          const isRecommended = state.id === content.recommended
          const isSelected = selectedState === state.id

          return (
            <button
              key={state.id}
              type="button"
              onClick={() => onSelect(state.id)}
              className={`group relative flex h-44 flex-col items-center justify-center gap-4 rounded-2xl border-2 transition-all duration-300 ${
                isSelected
                  ? 'border-brand-600 bg-brand-50/40 z-10 scale-105 shadow-lg'
                  : isRecommended
                    ? 'border-emerald-200 bg-emerald-50/30 hover:border-emerald-400 hover:shadow-md'
                    : 'border-border bg-card hover:border-brand-300 hover:shadow-md'
              }`}
            >
              <div
                className={`flex h-16 w-16 items-center justify-center rounded-full border shadow-sm ${
                  isSelected
                    ? 'bg-card border-brand-200'
                    : 'bg-muted border-border group-hover:bg-card'
                }`}
              >
                {state.id === 'delaware' ? (
                  <span className="text-3xl">🏛️</span>
                ) : (
                  <span className="text-3xl">🇺🇸</span>
                )}
              </div>

              <div className="text-center">
                <span
                  className={`block text-lg font-bold ${isSelected ? 'text-brand-900' : 'text-foreground'}`}
                >
                  {state.name}
                </span>

                {isRecommended && !isSelected && (
                  <span className="mt-2 inline-block rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold tracking-wider text-emerald-600 uppercase">
                    Recommended
                  </span>
                )}

                {isSelected && (
                  <span className="text-brand-600 bg-brand-100 mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase">
                    Selected
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      <div className="glass-card flex max-w-3xl gap-4 rounded-xl p-6">
        <div className="bg-card text-brand-600 flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-sm">
          <Info className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <h4 className="text-primary text-sm font-semibold">Why Delaware?</h4>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Delaware is the gold standard for corporate law. Over 65% of Fortune
            500 companies are incorporated there due to its business-friendly
            court system and investor preference.
          </p>
        </div>
      </div>
    </div>
  )
}
