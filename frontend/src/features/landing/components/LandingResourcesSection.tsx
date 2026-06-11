import {
  ArrowUpRight,
  FileText,
  GraduationCap,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { LandingSectionIntro } from '@/features/landing/components/LandingSectionIntro'

type ResourceItem = {
  icon: LucideIcon
  title: string
  desc: string
  to: string
}

const RESOURCES: ResourceItem[] = [
  {
    icon: FileText,
    title: 'Documentation',
    desc: 'Guides, API references, and setup playbooks',
    to: '/docs',
  },
  {
    icon: GraduationCap,
    title: 'Academy',
    desc: 'Video tutorials and role-based courses',
    to: '/products/zopkit-academy',
  },
  {
    icon: Users,
    title: 'Community',
    desc: 'Connect with operators and admins',
    to: '/community',
  },
  {
    icon: Zap,
    title: 'Support',
    desc: 'Priority help when your team is live',
    to: '/help',
  },
]

export function LandingResourcesSection() {
  return (
    <section
      id="resources"
      className="landing-section border-border bg-background border-b py-20 sm:py-24"
    >
      <div className="landing-section-inner">
        <LandingSectionIntro
          eyebrow="Resources"
          title="Guides and support for your rollout"
          lead="Documentation, training, and help channels for teams moving from pilot to production."
          titleClassName="max-w-lg"
        />

        <div className="border-border mt-10 grid border sm:grid-cols-2">
          {RESOURCES.map((item, index) => (
            <a
              key={item.title}
              href={item.to}
              className={`landing-industry-cell group block p-8 transition-colors sm:p-10 ${
                index % 2 === 0 ? 'border-border sm:border-r' : ''
              } ${index < 2 ? 'border-border border-b' : ''}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="border-border bg-muted/40 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border">
                    <item.icon
                      className="text-muted-foreground h-4 w-4"
                      aria-hidden
                    />
                  </span>
                  <h3 className="landing-display text-foreground text-lg font-semibold">
                    {item.title}
                  </h3>
                </div>
                <ArrowUpRight className="text-muted-foreground mt-2 h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <p className="text-muted-foreground mt-3 pl-12 text-sm leading-relaxed">
                {item.desc}
              </p>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
