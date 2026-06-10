import { useNavigate } from '@tanstack/react-router';

import { ArrowUpRight } from 'lucide-react';

import { getAllIndustries } from '@/data/industryPages';



export function LandingIndustriesGrid() {

  const navigate = useNavigate();

  const industries = getAllIndustries();



  return (

    <section id="industries" className="py-16 sm:py-20 border-b border-border bg-background">

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <h2 className="landing-display text-2xl sm:text-3xl font-semibold text-foreground max-w-lg text-balance tracking-tight">

          Vertical setups for teams that cannot afford disconnected data

        </h2>



        <div className="mt-10 grid sm:grid-cols-2 border border-border">

          {industries.map((industry, index) => (

            <button

              key={industry.slug}

              type="button"

              onClick={() => navigate({ to: `/industries/${industry.slug}` })}

              className={`landing-industry-cell group text-left p-8 sm:p-10 transition-colors cursor-pointer ${

                index % 2 === 0 ? 'sm:border-r border-border' : ''

              } ${index < 2 ? 'border-b border-border' : ''}`}

            >

              <div className="flex items-start justify-between gap-4">

                <h3 className="landing-display text-xl font-semibold text-foreground transition-colors">

                  {industry.name}

                </h3>

                <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />

              </div>

              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">

                {industry.hero.subheadline}

              </p>

            </button>

          ))}

        </div>

      </div>

    </section>

  );

}

