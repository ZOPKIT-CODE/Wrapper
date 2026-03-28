import { Badge } from '@/components/ui/badge';
import { COMPANY_TYPES } from '../../schemas';
import { UserClassification } from '../FlowSelector';
import { CheckCircle2, Building, Briefcase, Globe } from 'lucide-react';

interface CompanyTypeStepProps {
  selectedType: string;
  onSelect: (typeId: string) => void;
  userClassification?: UserClassification;
}

export const CompanyTypeStep = ({ selectedType, onSelect, userClassification }: CompanyTypeStepProps) => {
  const getPersonalizedContent = () => {
    switch (userClassification) {
      case 'aspiringFounder':
        return {
          title: 'Legal Structure',
          description: 'Choose the entity type that fits your fundraising needs.',
          recommended: 'llc'
        };
      case 'enterprise':
        return {
          title: 'Enterprise Entity',
          description: 'Select the structure for your large-scale organization.',
          recommended: 'corporation'
        };
      default:
        return {
          title: 'Company Type',
          description: 'Select the legal structure that best fits your business.',
          recommended: 'llc'
        };
    }
  };
  const content = getPersonalizedContent();

  const getIcon = (id: string) => {
    switch (id) {
      case 'llc': return <Briefcase className="w-6 h-6" />;
      case 'corporation': return <Building className="w-6 h-6" />;
      default: return <Globe className="w-6 h-6" />;
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-4">
          {userClassification && (
            <Badge variant="outline" className="bg-white/50 text-slate-600 border-slate-200 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase shadow-sm">
              {userClassification.replace(/([A-Z])/g, ' $1').trim()}
            </Badge>
          )}
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#1B2E5A] mb-3 drop-shadow-sm">
          {content.title}
        </h1>
        <p className="text-lg text-slate-500 leading-relaxed max-w-2xl font-light">
          {content.description}
        </p>
      </div>
      
      <div className="grid grid-cols-1 gap-5 max-w-2xl">
        {COMPANY_TYPES.map((type) => {
          const isRecommended = type.id === content.recommended;
          const isSelected = selectedType === type.id;

          return (
            <div
              key={type.id}
              onClick={() => onSelect(type.id)}
              className={`group relative p-6 rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden ${
                isSelected
                  ? 'glass-card border-slate-400 shadow-glow scale-[1.01]'
                  : 'glass-card border-slate-100/50 shadow-soft hover:border-slate-300 hover:shadow-glow'
              }`}
            >
              {/* Subtle background gradient on hover/select */}
              <div className={`absolute inset-0 bg-gradient-to-r from-slate-50 to-transparent opacity-0 transition-opacity duration-500 ${isSelected ? 'opacity-100' : 'group-hover:opacity-50'}`} />

              <div className="relative flex items-start gap-5 z-10">
                <div className={`shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                  isSelected 
                    ? 'bg-slate-900 text-white shadow-lg rotate-3' 
                    : 'bg-slate-50 text-slate-400 group-hover:bg-white group-hover:text-slate-700 group-hover:shadow-sm'
                }`}>
                  {getIcon(type.id)}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className={`text-lg font-bold ${isSelected ? 'text-[#1B2E5A]' : 'text-slate-700 group-hover:text-[#1B2E5A]'}`}>
                      {type.name}
                    </h3>
                    <div className="flex items-center gap-2">
                      {isRecommended && !isSelected && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
                          Recommended
                        </span>
                      )}
                      {isSelected && (
                         <CheckCircle2 className="w-6 h-6 text-[#1B2E5A] fill-white" />
                      )}
                    </div>
                  </div>
                  <p className={`text-sm leading-relaxed ${isSelected ? 'text-slate-600' : 'text-slate-400 group-hover:text-slate-500'}`}>
                    {type.name === 'Private Limited Company' ? 'Most popular for startups and growing businesses' :
                     type.name === 'Public Limited Company' ? 'For large-scale businesses seeking public investment' :
                     type.name === 'Limited Liability Partnership (LLP)' ? 'Flexible structure with limited liability protection' :
                     type.name === 'Partnership Firm' ? 'Simple structure for business partnerships' :
                     'Select this company type'}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};