import { Badge } from '@/components/ui/badge';
import { STATES } from '../../schemas';
import { UserClassification } from '../FlowSelector';
import { Info } from 'lucide-react';

interface StateStepProps {
  selectedState: string;
  onSelect: (stateId: string) => void;
  userClassification?: UserClassification;
}

export const StateStep = ({ selectedState, onSelect, userClassification }: StateStepProps) => {
  const content = {
    title: 'Jurisdiction',
    description: 'Select the state where you wish to incorporate. Delaware is recommended for most startups.',
    recommended: 'delaware'
  };

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-4">
          {userClassification && (
            <Badge variant="outline" className="bg-brand-50 text-brand-700 border-brand-200 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase">
              {userClassification.replace(/([A-Z])/g, ' $1').trim()}
            </Badge>
          )}
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#1B2E5A] mb-3">
          {content.title}
        </h1>
        <p className="text-lg text-slate-500 leading-relaxed max-w-2xl">
          {content.description}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 max-w-3xl">
        {STATES.map((state) => {
          const isRecommended = state.id === content.recommended;
          const isSelected = selectedState === state.id;

          return (
            <button
              key={state.id}
              type="button"
              onClick={() => onSelect(state.id)}
              className={`relative h-44 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center justify-center gap-4 group ${
                isSelected
                  ? 'border-brand-600 bg-brand-50/40 shadow-lg scale-105 z-10'
                  : isRecommended
                    ? 'border-emerald-200 bg-emerald-50/30 hover:border-emerald-400 hover:shadow-md'
                    : 'border-slate-200 bg-white hover:border-brand-300 hover:shadow-md'
              }`}
            >
              <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-sm border ${
                 isSelected ? 'bg-white border-brand-200' : 'bg-slate-50 border-slate-100 group-hover:bg-white'
              }`}>
                {state.id === 'delaware' ? (
                  <span className="text-3xl">🏛️</span>
                ) : (
                  <span className="text-3xl">🇺🇸</span>
                )}
              </div>
              
              <div className="text-center">
                <span className={`block font-bold text-lg ${isSelected ? 'text-brand-900' : 'text-slate-700'}`}>
                  {state.name}
                </span>
                
                {isRecommended && !isSelected && (
                  <span className="inline-block mt-2 text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                    Recommended
                  </span>
                )}
                
                {isSelected && (
                  <span className="inline-block mt-2 text-[10px] font-bold uppercase tracking-wider text-brand-600 bg-brand-100 px-2 py-0.5 rounded-full">
                    Selected
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="glass-card rounded-xl p-6 flex gap-4 max-w-3xl">
        <div className="shrink-0 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-brand-600">
          <Info className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h4 className="font-semibold text-[#1B2E5A] text-sm">Why Delaware?</h4>
          <p className="text-sm text-slate-500 leading-relaxed">
            Delaware is the gold standard for corporate law. Over 65% of Fortune 500 companies are incorporated there due to its business-friendly court system and investor preference.
          </p>
        </div>
      </div>
    </div>
  );
};