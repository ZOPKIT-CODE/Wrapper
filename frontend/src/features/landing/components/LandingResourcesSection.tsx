import { ArrowUpRight } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { LandingScrollReveal } from '@/features/landing/components/LandingScrollReveal'
import { LandingSectionIntro } from '@/features/landing/components/LandingSectionIntro'

type ResourceItem =
  | { title: string; desc: string; href: string }
  | { title: string; desc: string; to: '/blog' }
  | {
      title: string
      desc: string
      to: '/products/$productId'
      params: { productId: 'zopkit-academy' }
    }

const RESOURCES: ResourceItem[] = [
  {
    title: 'Documentation',
    desc: 'Guides, API references, and setup playbooks',
    to: '/blog',
  },
  {
    title: 'Academy',
    desc: 'Video tutorials and role-based courses',
    to: '/products/$productId',
    params: { productId: 'zopkit-academy' },
  },
  {
    title: 'Community',
    desc: 'Connect with operators and admins',
    href: '/#contact',
  },
  {
    title: 'Support',
    desc: 'Priority help when your team is live',
    href: 'mailto:sales@zopkit.com',
  },
]

export function LandingResourcesSection() {
  return (
    <section
      id="resources"
      className="landing-section landing-section-tint border-border border-b py-20 sm:py-24"
    >
      <div className="landing-section-inner">
        <LandingScrollReveal>
          <LandingSectionIntro
            eyebrow="Resources"
            title="Guides and support for your rollout"
            lead="Documentation, training, and help channels for teams moving from pilot to production."
            titleClassName="max-w-lg"
            animate={false}
          />
        </LandingScrollReveal>

        <ul className="border-border mt-10 overflow-hidden rounded-lg border">
          {RESOURCES.map((item, index) => {
            const rowClassName =
              'landing-resource-row group flex items-center justify-between gap-6 px-6 py-5 transition-colors sm:px-8 sm:py-6'
            const rowContent = (
              <>
                <div className="min-w-0">
                  <h3 className="landing-display text-foreground text-base font-semibold sm:text-lg">
                    {item.title}
                  </h3>
                  <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                    {item.desc}
                  </p>
                </div>
                <ArrowUpRight
                  className="text-muted-foreground h-4 w-4 shrink-0 opacity-40 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100"
                  aria-hidden
                />
              </>
            )

            return (
              <li
                key={item.title}
                className={index > 0 ? 'border-border border-t' : undefined}
              >
                <LandingScrollReveal delay={0.05 + index * 0.05}>
                  {'href' in item ? (
                    <a href={item.href} className={rowClassName}>
                      {rowContent}
                    </a>
                  ) : 'params' in item ? (
                    <Link
                      to={item.to}
                      params={item.params}
                      className={rowClassName}
                    >
                      {rowContent}
                    </Link>
                  ) : (
                    <Link to={item.to} className={rowClassName}>
                      {rowContent}
                    </Link>
                  )}
                </LandingScrollReveal>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
