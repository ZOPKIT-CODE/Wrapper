import { motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from '@tanstack/react-router';
import { landingEase } from '@/features/landing/components/landing-motion';

const PRODUCTS = [
  { id: 'b2b-crm', name: 'B2B CRM', line: 'Leads, pipeline, quotes, and invoices in one place' },
  { id: 'financial-accounting', name: 'Financial accounting', line: 'Ledger, payables, receivables, and tax compliance' },
  { id: 'operations-management', name: 'Operations', line: 'Inventory, procurement, and fulfillment' },
  { id: 'hrms', name: 'HRMS', line: 'Recruitment through payroll and performance' },
  { id: 'project-management', name: 'Project management', line: 'Delivery tied to time, budget, and people data' },
  { id: 'flowtilla', name: 'Flowtilla', line: 'Visual automation across every Zopkit app' },
] as const;

export function LandingProductIndex() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  return (
    <section id="platform" className="py-20 sm:py-28 border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-16">
          <div className="lg:col-span-4">
            <h2 className="font-['Bricolage_Grotesque'] text-3xl sm:text-4xl font-semibold tracking-[-0.03em] leading-[1.06] text-balance">
              The modules teams actually open every day
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Add what you need now. Turn on the rest when a department is ready. Same workspace throughout.
            </p>
          </div>

          <div className="lg:col-span-8">
            <ul className="divide-y divide-border border-t border-border">
              {PRODUCTS.map((product, index) => (
                <motion.li
                  key={product.id}
                  initial={reduceMotion ? false : { opacity: 0, x: 8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 0.45, delay: index * 0.04, ease: landingEase }}
                >
                  <button
                    type="button"
                    onClick={() => navigate({ to: `/products/${product.id}` })}
                    className="group w-full text-left py-5 sm:py-6 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 sm:gap-8 hover:bg-muted/40 -mx-3 px-3 sm:mx-0 sm:px-0 sm:hover:px-3 rounded-md transition-all duration-200 cursor-pointer"
                  >
                    <span className="font-['Bricolage_Grotesque'] text-lg sm:text-xl font-medium text-foreground group-hover:text-primary transition-colors">
                      {product.name}
                    </span>
                    <span className="text-sm text-muted-foreground sm:text-right max-w-md leading-relaxed">
                      {product.line}
                    </span>
                  </button>
                </motion.li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
