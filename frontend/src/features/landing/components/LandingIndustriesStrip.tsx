import { motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from '@tanstack/react-router';
import { getAllIndustries } from '@/data/industryPages';
import { landingEase } from '@/features/landing/components/landing-motion';

export function LandingIndustriesStrip() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const industries = getAllIndustries();
  const [featured, ...rest] = industries;

  return (
    <section id="industries" className="py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="font-['Bricolage_Grotesque'] text-3xl sm:text-4xl font-semibold tracking-[-0.03em] max-w-lg text-balance">
          Vertical playbooks, not blank templates
        </h2>

        {featured && (
          <motion.button
            type="button"
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: landingEase }}
            onClick={() => navigate({ to: `/industries/${featured.slug}` })}
            className="mt-12 w-full text-left group cursor-pointer border border-border rounded-lg p-8 sm:p-10 hover:border-foreground/20 transition-colors"
          >
            <h3 className="font-['Bricolage_Grotesque'] text-2xl sm:text-3xl font-semibold tracking-tight group-hover:text-primary transition-colors">
              {featured.name}
            </h3>
            <p className="mt-3 text-muted-foreground max-w-2xl leading-relaxed">
              {featured.hero.subheadline}
            </p>
            <span className="mt-6 inline-block text-sm font-medium text-foreground group-hover:underline">
              View {featured.name.toLowerCase()} setup
            </span>
          </motion.button>
        )}

        <ul className="mt-4 divide-y divide-border border-b border-border">
          {rest.map((industry, index) => (
            <motion.li
              key={industry.slug}
              initial={reduceMotion ? false : { opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
            >
              <button
                type="button"
                onClick={() => navigate({ to: `/industries/${industry.slug}` })}
                className="w-full text-left py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 hover:bg-muted/30 -mx-2 px-2 rounded-md transition-colors cursor-pointer"
              >
                <span className="font-medium text-foreground">{industry.name}</span>
                <span className="text-sm text-muted-foreground sm:max-w-md sm:text-right">
                  {industry.hero.subheadline}
                </span>
              </button>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}
