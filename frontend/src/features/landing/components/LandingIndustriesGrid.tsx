import { useNavigate } from '@tanstack/react-router'
import { ArrowUpRight } from 'lucide-react'
import { getAllIndustries } from '@/data/industryPages'
import { LandingScrollReveal } from '@/features/landing/components/LandingScrollReveal'
import { LandingSectionIntro } from '@/features/landing/components/LandingSectionIntro'
import { LandingSectionVisual } from '@/features/landing/components/LandingSectionVisual'
import { industryVisuals } from '@/features/landing/landing-section-visuals'

/** Short grid copy — full subheadlines live on industry pages. */
const INDUSTRY_GRID_SUMMARY: Record<string, string> = {
  'e-commerce': 'Inventory, fulfillment, and finance in one flow.',
  saas: 'CRM, finance, and ops built for subscription scale.',
  manufacturing: 'Production, inventory, and ledger without legacy ERP drag.',
  'professional-services': 'Projects, clients, billing, and people unified.',
}

export function LandingIndustriesGrid() {
  const navigate = useNavigate()
  const industries = getAllIndustries()

  return (
    <section
      id="industries"
      className="landing-section border-border bg-background border-b py-20 sm:py-24"
    >
      <div className="landing-section-inner">
        <LandingScrollReveal>
          <LandingSectionIntro
            eyebrow="Industries"
            title="Vertical setups for teams that cannot afford disconnected data"
            titleClassName="max-w-lg"
            animate={false}
          />
        </LandingScrollReveal>

        <div className="landing-industries-grid border-border mt-10 border">
          {industries.map((industry, index) => {
            const visual = industryVisuals[industry.slug]
            const summary =
              INDUSTRY_GRID_SUMMARY[industry.slug] ?? industry.hero.subheadline

            return (
              <div
                key={industry.slug}
                className={`landing-industries-grid__cell ${
                  index % 2 === 0 ? 'landing-industries-grid__cell--left' : ''
                } ${index < 2 ? 'landing-industries-grid__cell--top' : ''}`}
              >
                <LandingScrollReveal
                  delay={0.04 + index * 0.05}
                  className="h-full"
                >
                  <button
                    type="button"
                    onClick={() =>
                      navigate({ to: `/industries/${industry.slug}` })
                    }
                    className="landing-industry-cell group flex h-full w-full cursor-pointer flex-col text-left transition-colors"
                  >
                    {visual && (
                      <div className="landing-industry-cell__visual">
                        <LandingSectionVisual {...visual} variant="industry" />
                      </div>
                    )}
                    <div className="landing-industry-cell__body">
                      <div className="flex items-start justify-between gap-4">
                        <h3 className="landing-display text-foreground text-lg font-semibold sm:text-xl">
                          {industry.name}
                        </h3>
                        <ArrowUpRight
                          className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                          aria-hidden
                        />
                      </div>
                      <p className="text-muted-foreground mt-2.5 line-clamp-2 text-sm leading-relaxed">
                        {summary}
                      </p>
                    </div>
                  </button>
                </LandingScrollReveal>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
