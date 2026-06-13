import { Badge } from '@/components/ui/badge'
import { COMPANY_TYPES } from '../../schemas'
import { UserClassification } from '../FlowSelector'
import { CheckCircle2, Building, Briefcase, Globe } from 'lucide-react'

interface CompanyTypeStepProps {
  selectedType: string
  onSelect: (typeId: string) => void
  userClassification?: UserClassification
}

export const CompanyTypeStep = ({
  selectedType,
  onSelect,
  userClassification,
}: CompanyTypeStepProps) => {
  const getPersonalizedContent = () => {
    switch (userClassification) {
      case 'aspiringFounder':
        return {
          title: 'Legal Structure',
          description:
            'Choose the entity type that fits your fundraising needs.',
          recommended: 'llc',
        }
      case 'enterprise':
        return {
          title: 'Enterprise Entity',
          description:
            'Select the structure for your large-scale organization.',
          recommended: 'corporation',
        }
      default:
        return {
          title: 'Company Type',
          description:
            'Select the legal structure that best fits your business.',
          recommended: 'llc',
        }
    }
  }
  const content = getPersonalizedContent()

  const getIcon = (id: string) => {
    switch (id) {
      case 'llc':
        return <Briefcase className="h-6 w-6" />
      case 'corporation':
        return <Building className="h-6 w-6" />
      default:
        return <Globe className="h-6 w-6" />
    }
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-blue-100 pb-6">
        <div className="mb-2">
          {userClassification && userClassification !== 'aspiringFounder' && (
            <Badge
              variant="outline"
              className="rounded border border-blue-200/90 bg-blue-50 px-2 py-0.5 text-[10px] font-medium tracking-wider text-blue-900 uppercase"
            >
              {userClassification.replace(/([A-Z])/g, ' $1').trim()}
            </Badge>
          )}
        </div>
        <h1 className="mb-1.5 text-2xl font-semibold tracking-tight text-blue-950 md:text-[1.65rem]">
          {content.title}
        </h1>
        <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
          {content.description}
        </p>
      </div>

      <div className="grid max-w-2xl grid-cols-1 gap-3">
        {COMPANY_TYPES.map((type) => {
          const isRecommended = type.id === content.recommended
          const isSelected = selectedType === type.id

          return (
            <div
              key={type.id}
              onClick={() => onSelect(type.id)}
              className={`group relative cursor-pointer overflow-hidden rounded-lg border p-5 transition-colors ${
                isSelected
                  ? 'border-blue-300 bg-blue-50/50 shadow-sm ring-1 ring-blue-100'
                  : 'bg-card hover:bg-primary/5/30 border-blue-100 hover:border-blue-200'
              }`}
            >
              <div className="relative z-10 flex items-start gap-4">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-md transition-colors ${
                    isSelected
                      ? 'bg-blue-950 text-white shadow-sm'
                      : 'bg-muted text-muted-foreground group-hover:bg-blue-100 group-hover:text-blue-900'
                  }`}
                >
                  {getIcon(type.id)}
                </div>

                <div className="flex-1">
                  <div className="mb-2 flex items-center justify-between">
                    <h3
                      className={`text-base font-semibold ${isSelected ? 'text-blue-950' : 'text-foreground group-hover:text-primary'}`}
                    >
                      {type.name}
                    </h3>
                    <div className="flex items-center gap-2">
                      {isRecommended && !isSelected && (
                        <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2 py-1 text-[10px] font-bold tracking-wider text-emerald-600 uppercase">
                          Recommended
                        </span>
                      )}
                      {isSelected && (
                        <CheckCircle2 className="text-primary h-6 w-6" />
                      )}
                    </div>
                  </div>
                  <p
                    className={`text-sm leading-relaxed ${isSelected ? 'text-muted-foreground' : 'text-muted-foreground group-hover:text-muted-foreground'}`}
                  >
                    {type.name === 'Private Limited Company'
                      ? 'Most popular for startups and growing businesses'
                      : type.name === 'Public Limited Company'
                        ? 'For large-scale businesses seeking public investment'
                        : type.name === 'Limited Liability Partnership (LLP)'
                          ? 'Flexible structure with limited liability protection'
                          : type.name === 'Partnership Firm'
                            ? 'Simple structure for business partnerships'
                            : 'Select this company type'}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
