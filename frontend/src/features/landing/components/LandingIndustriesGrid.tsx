import { useNavigate } from '@tanstack/react-router'
import { ArrowUpRight } from 'lucide-react'
import { getAllIndustries } from '@/data/industryPages'
import { LandingSectionIntro } from '@/features/landing/components/LandingSectionIntro'

export function LandingIndustriesGrid() {
  const navigate = useNavigate()
  const industries = getAllIndustries()

  return (
    <section
      id="industries"
      className="landing-section border-border bg-background border-b py-20 sm:py-24"
    >
      <div className="landing-section-inner">
        <LandingSectionIntro
          eyebrow="Industries"
          title="Vertical setups for teams that cannot afford disconnected data"
          titleClassName="max-w-lg"
        />

        <div className="border-border mt-10 grid border sm:grid-cols-2">
          {industries.map((industry, index) => (
            <button
              key={industry.slug}
              type="button"
              onClick={() => navigate({ to: `/industries/${industry.slug}` })}
              className={`landing-industry-cell group cursor-pointer p-8 text-left transition-colors sm:p-10 ${
                index % 2 === 0 ? 'border-border sm:border-r' : ''
              } ${index < 2 ? 'border-border border-b' : ''}`}
            >
              <div className="flex items-start justify-between gap-4">
                <h3 className="landing-display text-foreground text-lg font-semibold sm:text-xl">
                  {industry.name}
                </h3>
                <ArrowUpRight className="text-muted-foreground mt-1 h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                {industry.hero.subheadline}
              </p>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
