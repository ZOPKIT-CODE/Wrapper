import { useNavigate } from '@tanstack/react-router';

const PRODUCTS = [
  { id: 'b2b-crm', name: 'B2B CRM', desc: 'Pipeline to cash' },
  { id: 'financial-accounting', name: 'Finance', desc: 'Ledger and compliance' },
  { id: 'operations-management', name: 'Operations', desc: 'Stock to shipment' },
  { id: 'hrms', name: 'HRMS', desc: 'Hire to retire' },
  { id: 'project-management', name: 'Projects', desc: 'Delivery and budget' },
  { id: 'flowtilla', name: 'Flowtilla', desc: 'Cross-app automation' },
] as const;

export function LandingProductRail() {
  const navigate = useNavigate();

  return (
    <section id="platform" className="py-16 sm:py-20 border-b border-border bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="landing-display text-2xl sm:text-3xl font-semibold text-foreground">
            Modules in the suite
          </h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-md">
            Turn on what you need. Every module runs in the same workspace.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate({ to: '/pricing' })}
          className="landing-mono text-xs text-primary hover:text-primary-hover transition-colors cursor-pointer shrink-0"
        >
          Compare plans
        </button>
      </div>

      <div className="landing-product-rail flex overflow-x-auto snap-x snap-mandatory border-y border-border">
        {PRODUCTS.map((product) => (
          <button
            key={product.id}
            type="button"
            onClick={() => navigate({ to: `/products/${product.id}` })}
            className="group snap-start shrink-0 w-[min(78vw,280px)] sm:w-[300px] text-left border-r border-border px-6 sm:px-8 py-10 hover:bg-muted/50 transition-colors duration-200 cursor-pointer flex flex-col justify-end min-h-[200px]"
          >
            <h3 className="landing-display text-2xl font-semibold text-foreground group-hover:text-primary transition-colors">
              {product.name}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">{product.desc}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
