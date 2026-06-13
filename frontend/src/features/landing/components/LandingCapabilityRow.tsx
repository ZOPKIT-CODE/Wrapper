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
] as const

export function LandingCapabilityRow() {
  return (
    <section className="border-border bg-background border-b">
      <div className="mx-auto grid max-w-7xl md:grid-cols-3">
        {CAPABILITIES.map((item, i) => (
          <article
            key={item.title}
            className={`px-6 py-10 sm:px-8 sm:py-12 ${
              i < CAPABILITIES.length - 1 ? 'border-border md:border-r' : ''
            } ${i < CAPABILITIES.length - 1 ? 'border-border border-b md:border-b-0' : ''}`}
          >
            <p className="landing-capability-index landing-mono text-muted-foreground text-[11px] tracking-wider">
              {item.index}
            </p>
            <h2 className="landing-display text-foreground mt-2 text-xl font-semibold sm:text-2xl">
              {item.title}
            </h2>
            <p className="text-muted-foreground mt-3 max-w-sm text-sm leading-relaxed sm:text-[15px]">
              {item.body}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}
