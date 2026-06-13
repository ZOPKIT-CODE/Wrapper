import { LandingScrollReveal } from '@/features/landing/components/LandingScrollReveal'
import { getCapabilityIllustration } from '@/features/landing/components/LandingCapabilityIllustrations'
import { LandingSectionIntro } from '@/features/landing/components/LandingSectionIntro'
import { LandingSectionVisual } from '@/features/landing/components/LandingSectionVisual'
import { capabilityVisuals } from '@/features/landing/landing-section-visuals'

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
    <section className="landing-capability-row landing-section-tint border-border border-b pt-0 pb-14 sm:pb-16">
      <div className="landing-section-inner">
        <LandingScrollReveal className="mb-10 sm:mb-12">
          <LandingSectionIntro
            eyebrow="Platform"
            title="One core. Every module."
            lead="Identity, records, and billing run through the same workspace — not three separate admin consoles."
            titleClassName="max-w-md"
            animate={false}
          />
        </LandingScrollReveal>

        {CAPABILITIES.map((item, i) => {
          const visual = capabilityVisuals[item.title]
          const copyBlock = (
            <div className="flex flex-col justify-center">
              <p className="landing-capability-index landing-mono text-muted-foreground text-[11px] tracking-wider">
                {item.index}
              </p>
              <h3 className="landing-display text-foreground mt-2 text-xl font-semibold sm:text-2xl">
                {item.title}
              </h3>
              <p className="text-muted-foreground mt-4 max-w-lg text-sm leading-relaxed sm:text-[15px]">
                {item.body}
              </p>
            </div>
          )

          return (
            <LandingScrollReveal key={item.title} delay={i * 0.06}>
              <article
                className={`grid gap-8 py-10 sm:grid-cols-2 sm:items-center sm:gap-10 sm:py-12 ${
                  i > 0 ? 'border-border border-t' : ''
                }`}
              >
                {i % 2 === 0 ? (
                  <>
                    {copyBlock}
                    {visual && (
                      <LandingSectionVisual {...visual} variant="illustration">
                        {getCapabilityIllustration(item.title)}
                      </LandingSectionVisual>
                    )}
                  </>
                ) : (
                  <>
                    {visual && (
                      <LandingSectionVisual {...visual} variant="illustration">
                        {getCapabilityIllustration(item.title)}
                      </LandingSectionVisual>
                    )}
                    {copyBlock}
                  </>
                )}
              </article>
            </LandingScrollReveal>
          )
        })}
      </div>
    </section>
  )
}
