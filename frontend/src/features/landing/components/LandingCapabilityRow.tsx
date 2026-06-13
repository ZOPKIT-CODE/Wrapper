const CAPABILITIES = [
  {
    index: '01',
    title: 'Shared identity',
    body: 'One login and role model across every module. IT provisions once, not per app.',
  },
  {
    index: '02',
    title: 'Shared records',
    body: 'Customers, employees, and vendors stay aligned when CRM, HR, and finance update the same core data.',
  },
  {
    index: '03',
    title: 'Shared billing',
    body: 'Subscriptions and credits run through a single account. Finance sees the full picture.',
  },
] as const;

export function LandingCapabilityRow() {
  return (
    <section className="border-b border-border bg-background">
      <div className="max-w-7xl mx-auto grid md:grid-cols-3">
        {CAPABILITIES.map((item, i) => (
          <article
            key={item.title}
            className={`px-6 sm:px-8 py-10 sm:py-12 ${
              i < CAPABILITIES.length - 1 ? 'md:border-r border-border' : ''
            } ${i < CAPABILITIES.length - 1 ? 'border-b md:border-b-0 border-border' : ''}`}
          >
            <p className="landing-capability-index landing-mono text-[11px] text-muted-foreground tracking-wider">{item.index}</p>
            <h2 className="mt-2 landing-display text-xl sm:text-2xl font-semibold text-foreground">
              {item.title}
            </h2>
            <p className="mt-3 text-sm sm:text-[15px] text-muted-foreground leading-relaxed max-w-sm">
              {item.body}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
