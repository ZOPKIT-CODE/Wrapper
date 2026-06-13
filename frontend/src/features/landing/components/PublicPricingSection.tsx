import React, { useCallback, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Check, Loader2 } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { subscriptionAPI } from '@/lib/api'
import {
  applicationPlansFallback,
  creditTopups,
} from '@/features/billing/constants/billingPlans'
import { mapSubscriptionPlansResponse } from '@/features/billing/utils/mapSubscriptionPlansResponse'
import {
  formatMonthlyInrDisplay,
  formatMonthlyUsdDisplay,
} from '@/features/billing/utils/planPriceDisplay'
import { appDisplayName, moduleDisplayName } from '@/data/planDisplayLabels'
import {
  FALLBACK_PLAN_COVERAGE,
  FULL_MODULE_CATALOG_BY_APP,
} from '@/data/pricingPlanMatrix'
import type { ApplicationPlan, CheckoutCurrency } from '@/types/pricing'
import { cn } from '@/lib/utils'

const BILLING_PRICE_CURRENCY_KEY = 'wrapper.billing.price-currency'

function readStoredCheckoutCurrency(): CheckoutCurrency {
  try {
    if (typeof window === 'undefined') return 'usd'
    const v = localStorage.getItem(BILLING_PRICE_CURRENCY_KEY)
    if (v === 'inr' || v === 'usd') return v
  } catch {
    /* ignore */
  }
  return 'usd'
}

const HOW_IT_WORKS = [
  {
    step: 1,
    title: 'Choose a plan',
    desc: 'Starter, Professional, or Enterprise—annual billing, credits included for the year.',
  },
  {
    step: 2,
    title: 'Use across apps',
    desc: 'Each plan unlocks a defined set of applications and modules—see the matrix for coverage by tier.',
  },
  {
    step: 3,
    title: 'Top up credits',
    desc: 'Need more? Buy credit packs anytime; they expire with your plan.',
  },
  {
    step: 4,
    title: 'Scale when ready',
    desc: 'Upgrade your application plan or add credits from your billing workspace when you need to grow.',
  },
]

const USAGE_EXAMPLES = [
  {
    type: 'Simple actions',
    desc: 'Record creation, updates, single-item operations—lower credit cost per action.',
  },
  {
    type: 'Workflow & automation',
    desc: 'Runs, triggers, and automated steps—credit cost depends on complexity.',
  },
  {
    type: 'Reports & analytics',
    desc: 'Standard and advanced reports—more credits for larger or deeper reports.',
  },
  {
    type: 'Bulk & heavy operations',
    desc: 'Payroll, bulk processing, integrations—higher credit cost per run.',
  },
]

const FAQ_ITEMS = [
  {
    q: 'How are credits consumed?',
    a: 'Different operations use different credit amounts. Credits are deducted in real time, and you can review usage and history from your organization’s billing area.',
  },
  {
    q: 'What is included in an application plan?',
    a: 'Each plan lists annual credits, price (USD or INR), and which applications and modules are enabled. The matrix below summarizes coverage by tier.',
  },
  {
    q: 'What happens when credits run out?',
    a: 'Operations pause until you add more credits. We notify you when your balance is low so you can top up in time.',
  },
  {
    q: 'Can I buy more credits anytime?',
    a: 'Yes. Purchase additional credit packages whenever you need. New credits are added immediately.',
  },
  {
    q: 'Is billing monthly?',
    a: 'Application plans are billed annually. Prices are shown as a monthly equivalent for comparison.',
  },
]

const CONTACT_SALES_HREF = '/#contact'

export type PublicPricingSectionProps = {
  variant?: 'page' | 'landing'
}

type RawPlanRow = {
  id?: string
  applications?: string[]
  modules?: Record<string, string[] | '*'>
}

/** When the API omits app/module data, map fallback coverage to whatever plan rows are shown (by tier order). */
function alignFallbackToPlans(
  plans: ApplicationPlan[],
  fallbackRows: RawPlanRow[]
): Map<string, RawPlanRow> {
  const m = new Map<string, RawPlanRow>()
  const n = Math.min(plans.length, fallbackRows.length)
  for (let i = 0; i < n; i++) {
    const f = fallbackRows[i]
    m.set(plans[i].id, {
      id: plans[i].id,
      applications: f.applications,
      modules: f.modules,
    })
  }
  return m
}

function ModuleList({ moduleCodes }: { moduleCodes: string[] }) {
  const sorted = [...moduleCodes].sort((a, b) =>
    moduleDisplayName(a).localeCompare(moduleDisplayName(b))
  )
  return (
    <ul
      className="max-h-[min(16rem,40vh)] space-y-1.5 overflow-y-auto overscroll-contain pr-1 [scrollbar-color:rgba(27,46,90,0.2)_transparent] [scrollbar-width:thin]"
      aria-label="Modules included"
    >
      {sorted.map((m) => (
        <li
          key={m}
          className="border-border text-foreground/80 border-l-2 pl-2.5 text-[13px] leading-snug"
        >
          {moduleDisplayName(m)}
        </li>
      ))}
    </ul>
  )
}

function moduleCellContent(
  planRow: RawPlanRow | undefined,
  appId: string
): React.ReactNode {
  if (!planRow?.applications?.includes(appId)) {
    return (
      <div className="flex min-h-[2.5rem] items-center justify-center py-1">
        <span
          className="text-foreground/25 text-sm tabular-nums"
          aria-label="Not included"
        >
          —
        </span>
      </div>
    )
  }
  const mods = planRow.modules?.[appId]
  if (mods === '*') {
    const expanded = FULL_MODULE_CATALOG_BY_APP[appId]
    if (expanded && expanded.length > 0) {
      return <ModuleList moduleCodes={expanded} />
    }
    return (
      <div className="flex items-center gap-2 py-1">
        <Check
          className="text-foreground h-4 w-4 shrink-0"
          strokeWidth={2}
          aria-hidden
        />
        <span className="text-foreground/90 text-[13px] font-medium">
          All modules
        </span>
      </div>
    )
  }
  if (Array.isArray(mods) && mods.length > 0) {
    return <ModuleList moduleCodes={mods} />
  }
  return (
    <div className="flex items-center gap-2 py-1">
      <Check
        className="text-foreground h-4 w-4 shrink-0"
        strokeWidth={2}
        aria-hidden
      />
      <span className="text-foreground/90 text-[13px] font-medium">
        Included
      </span>
    </div>
  )
}

function ApplicationsModulesMatrixTable({
  plans,
  matrixRowsById,
}: {
  plans: ApplicationPlan[]
  matrixRowsById: Map<string, RawPlanRow>
}) {
  const unionApps = Array.from(
    new Set(plans.flatMap((p) => matrixRowsById.get(p.id)?.applications ?? []))
  ).sort((a, b) => appDisplayName(a).localeCompare(appDisplayName(b)))

  if (unionApps.length === 0) {
    return (
      <p className="text-foreground/55 border-border bg-background/80 rounded-xl border border-dashed py-8 text-center text-sm">
        Application coverage will appear here when subscription data is
        available.
      </p>
    )
  }

  return (
    <div className="border-border overflow-hidden rounded-xl border bg-white shadow-sm">
      <div className="border-border bg-background border-b px-4 py-2.5 sm:px-5">
        <p className="text-foreground/50 text-[10px] font-medium tracking-[0.14em] uppercase">
          Module coverage
        </p>
      </div>
      <div className="overflow-x-auto">
        <Table className="w-full min-w-[760px] border-collapse text-sm">
          <TableHeader>
            <TableRow className="[&>th]:border-border border-0 hover:bg-transparent [&>th]:border-b">
              <TableHead className="border-border bg-background text-foreground/55 sticky left-0 z-[2] min-w-[176px] border-r px-4 py-3.5 text-left text-xs font-semibold tracking-wider uppercase">
                Application
              </TableHead>
              {plans.map((p) => (
                <TableHead
                  key={p.id}
                  className="bg-background text-foreground min-w-[220px] px-4 py-3.5 text-center align-bottom text-sm font-semibold tracking-tight"
                >
                  {p.name}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {unionApps.map((appId) => (
              <TableRow
                key={appId}
                className="group border-border hover:bg-muted/30 border-0 border-b transition-colors last:border-b-0"
              >
                <TableCell className="border-border text-foreground group-hover:bg-muted/30 sticky left-0 z-[1] border-r bg-white px-4 py-4 align-top text-sm font-semibold tracking-tight transition-colors">
                  {appDisplayName(appId)}
                </TableCell>
                {plans.map((p) => (
                  <TableCell
                    key={`${appId}-${p.id}`}
                    className="border-border group-hover:bg-muted/30 border-l bg-white px-4 py-4 align-top transition-colors"
                  >
                    {moduleCellContent(matrixRowsById.get(p.id), appId)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="border-border bg-background border-t px-4 py-3 sm:px-5">
        <p className="text-foreground/55 text-[11px] leading-relaxed">
          Coverage reflects the platform access matrix. Your contract and
          billing profile determine final entitlements.
        </p>
      </div>
    </div>
  )
}

function FeatureBullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="text-foreground/80 flex gap-3 text-sm leading-relaxed">
      <span
        className="bg-foreground mt-2 h-1 w-1 shrink-0 rounded-full"
        aria-hidden
      />
      <span>{children}</span>
    </li>
  )
}

export function PublicPricingSection({
  variant = 'page',
}: PublicPricingSectionProps) {
  const hrefContact = CONTACT_SALES_HREF
  const isLanding = variant === 'landing'

  const [checkoutCurrency, setCheckoutCurrencyState] =
    useState<CheckoutCurrency>(() => readStoredCheckoutCurrency())

  const setCheckoutCurrency = useCallback((c: CheckoutCurrency) => {
    setCheckoutCurrencyState(c)
    try {
      localStorage.setItem(BILLING_PRICE_CURRENCY_KEY, c)
    } catch {
      /* ignore */
    }
  }, [])

  const { data: rawPlans, isLoading } = useQuery({
    queryKey: ['subscription', 'plans', 'public'],
    queryFn: async () => {
      const response = await subscriptionAPI.getAvailablePlans()
      const raw = response.data?.data ?? response.data
      return Array.isArray(raw) ? (raw as RawPlanRow[]) : []
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  const applicationPlans: ApplicationPlan[] =
    rawPlans && rawPlans.length > 0
      ? mapSubscriptionPlansResponse(rawPlans)
      : applicationPlansFallback

  const rawHasMatrix = (rawPlans ?? []).some(
    (r) => (r.applications?.length ?? 0) > 0
  )

  const matrixRowsById = new Map<string, RawPlanRow>()
  if (rawHasMatrix) {
    ;(rawPlans ?? []).forEach((r) => {
      const id = String(r.id ?? '')
      if (id) matrixRowsById.set(id, r)
    })
  } else {
    alignFallbackToPlans(applicationPlans, FALLBACK_PLAN_COVERAGE).forEach(
      (v, k) => {
        matrixRowsById.set(k, v)
      }
    )
  }

  const headingClass = 'text-foreground font-semibold tracking-tight'
  const bodyClass = 'text-muted-foreground leading-relaxed'
  const metaClass = 'text-muted-foreground text-sm leading-relaxed'

  return (
    <div className="marketing-pricing text-foreground font-sans antialiased">
      {/* Hero */}
      <section
        className={`text-center ${isLanding ? 'pt-2 pb-8 md:pb-10' : 'pt-4 pb-10 md:pb-12'}`}
      >
        <p className="landing-mono text-muted-foreground mb-4 text-[11px] tracking-[0.14em] uppercase">
          Pricing
        </p>
        {isLanding ? (
          <h2
            className={`text-3xl sm:text-4xl md:text-[2.5rem] ${headingClass} mx-auto mb-4 max-w-2xl leading-tight`}
          >
            Annual plans &amp; credits
          </h2>
        ) : (
          <h1
            className={`text-3xl sm:text-4xl md:text-[2.5rem] ${headingClass} mx-auto mb-4 max-w-2xl leading-tight`}
          >
            Annual plans &amp; credits
          </h1>
        )}
        <p className={`text-base ${bodyClass} mx-auto mb-6 max-w-xl`}>
          Pick a tier for the apps and modules you need.{' '}
          <span className="text-foreground font-medium">Billed annually</span>{' '}
          in USD or INR. Credits included each year; add top-ups anytime.
        </p>
        <p className="mt-6">
          <a
            href="#pricing-faq"
            className="text-muted-foreground hover:text-foreground cursor-pointer text-sm font-medium underline underline-offset-4"
          >
            Frequently asked questions
          </a>
        </p>
      </section>

      {/* Applications & modules matrix */}
      <section
        className="mx-auto mb-12 max-w-6xl px-0 sm:px-1 md:mb-14"
        aria-labelledby="applications-modules-matrix-heading"
      >
        <div className="mb-5 text-center sm:mb-6">
          <h2
            id="applications-modules-matrix-heading"
            className={`text-base sm:text-lg ${headingClass} mb-1.5`}
          >
            Applications &amp; modules by plan
          </h2>
          <p className={`mx-auto max-w-lg text-sm ${metaClass}`}>
            Full module list per application. API data is used when available.
          </p>
        </div>
        <ApplicationsModulesMatrixTable
          plans={applicationPlans}
          matrixRowsById={matrixRowsById}
        />
      </section>

      {/* Currency */}
      <div className="mb-10 flex justify-center">
        <div
          className="border-border bg-background inline-flex rounded-full border p-0.5"
          role="group"
          aria-label="Billing currency"
        >
          <button
            type="button"
            onClick={() => setCheckoutCurrency('usd')}
            className={cn(
              'min-w-[3.5rem] cursor-pointer rounded-[5px] px-5 py-2 text-sm font-medium transition-colors',
              checkoutCurrency === 'usd'
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            USD
          </button>
          <button
            type="button"
            onClick={() => setCheckoutCurrency('inr')}
            className={cn(
              'min-w-[3.5rem] cursor-pointer rounded-[5px] px-5 py-2 text-sm font-medium transition-colors',
              checkoutCurrency === 'inr'
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            INR
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="text-foreground/55 flex items-center justify-center gap-3 py-14">
          <Loader2
            className="text-foreground/70 h-5 w-5 animate-spin"
            aria-hidden
          />
          <span className="text-foreground/70 text-sm font-medium">
            Loading plans
          </span>
        </div>
      )}

      {/* Application plans */}
      <section className="mb-14" aria-label="Application plans">
        <p className={`text-center ${metaClass} mx-auto mb-8 max-w-2xl`}>
          Billed annually · credits renew each billing year
        </p>
        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3 lg:gap-7">
          {applicationPlans.map((pkg) => {
            const showInr =
              checkoutCurrency === 'inr' && (pkg.annualPriceInr ?? 0) > 0
            const monthlyDisplay = showInr
              ? formatMonthlyInrDisplay(pkg.annualPriceInr ?? 0)
              : formatMonthlyUsdDisplay(pkg.annualPriceUsd ?? 0)
            const perMonthLabel = showInr
              ? 'Per month (INR)'
              : 'Per month (USD)'
            const featured = Boolean(pkg.popular)
            return (
              <div
                key={pkg.id}
                className={cn(
                  'relative flex flex-col rounded-xl border bg-white p-7 transition-shadow md:p-8',
                  featured
                    ? 'border-foreground z-[1] shadow-sm'
                    : 'border-border hover:border-foreground/30 hover:shadow-sm'
                )}
              >
                {featured && (
                  <div className="absolute -top-px left-1/2 -translate-x-1/2">
                    <span className="bg-foreground text-background inline-block rounded-b-md px-3 py-1.5 text-[10px] font-semibold tracking-[0.14em] uppercase">
                      Most popular
                    </span>
                  </div>
                )}
                <div className={cn('mb-6', featured && 'pt-2')}>
                  <h3 className="text-foreground text-lg font-semibold tracking-tight">
                    {pkg.name}
                  </h3>
                  <p className={`mt-2 text-sm ${bodyClass}`}>
                    {pkg.description}
                  </p>
                </div>
                <div className="mb-1">
                  <span className="text-foreground text-4xl font-semibold tracking-tight tabular-nums">
                    {monthlyDisplay}
                  </span>
                </div>
                <p className="text-foreground/50 mb-5 text-[11px] font-medium tracking-[0.12em] uppercase">
                  {perMonthLabel}
                </p>
                <p className="text-foreground border-border mb-6 border-t pt-5 text-sm font-medium">
                  {pkg.freeCredits.toLocaleString()} credits included per year
                </p>
                <ul className="mb-10 flex-1 space-y-3">
                  {pkg.features.map((f, i) => (
                    <FeatureBullet key={i}>{f}</FeatureBullet>
                  ))}
                </ul>
                <a
                  href={hrefContact}
                  className={cn(
                    'mt-auto inline-flex cursor-pointer items-center justify-center rounded-lg px-4 py-3 text-center text-sm font-semibold transition-colors',
                    featured
                      ? 'bg-foreground text-background hover:bg-foreground-hover'
                      : 'text-foreground border-border hover:border-foreground/40 hover:bg-background border bg-white'
                  )}
                >
                  Contact sales
                </a>
              </div>
            )
          })}
        </div>
      </section>

      <section className="mb-14">
        <div className="border-border bg-background rounded-xl border px-6 py-5">
          <h2 className="text-foreground text-base font-semibold tracking-tight">
            Credits included yearly
          </h2>
          <p className={`mt-2 text-sm ${bodyClass}`}>
            Each application plan includes an annual credit pool for platform
            usage. Need more? Use credit top-ups below.
          </p>
        </div>
      </section>

      <section className="mb-16" aria-label="Credit top-ups">
        <h2 className={`text-center text-xl sm:text-2xl ${headingClass} mb-3`}>
          Credit top-ups
        </h2>
        <p className={`text-center ${metaClass} mx-auto mb-8 max-w-2xl`}>
          One-time purchase bundles—same options as in-app billing. Credits
          expire with your plan.
        </p>
        <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-3 lg:gap-7">
          {creditTopups.map((topup) => {
            const featured = Boolean(topup.recommended)
            return (
              <div
                key={topup.id}
                className={cn(
                  'relative flex flex-col rounded-xl border bg-white p-7 md:p-8',
                  featured
                    ? 'border-foreground shadow-sm'
                    : 'border-border hover:shadow-sm'
                )}
              >
                {featured && (
                  <div className="absolute -top-px left-1/2 -translate-x-1/2">
                    <span className="bg-foreground text-background inline-block rounded-b-md px-3 py-1.5 text-[10px] font-semibold tracking-[0.14em] uppercase">
                      Best value
                    </span>
                  </div>
                )}
                <div className={cn('mb-6', featured && 'pt-2')}>
                  <h3 className="text-foreground text-lg font-semibold tracking-tight">
                    {topup.name}
                  </h3>
                  <p className={`mt-2 text-sm ${bodyClass}`}>
                    {topup.description}
                  </p>
                </div>
                <div className="mb-1">
                  <span className="text-foreground text-4xl font-semibold tabular-nums">
                    ${topup.price}
                  </span>
                  <span className={`ml-1.5 text-sm ${metaClass}`}>
                    one-time
                  </span>
                </div>
                <p className="text-foreground border-border mb-6 border-t pt-5 text-sm font-medium">
                  {topup.credits.toLocaleString()} credits
                </p>
                <ul className="mb-10 flex-1 space-y-3">
                  {topup.features.map((f, i) => (
                    <FeatureBullet key={i}>{f}</FeatureBullet>
                  ))}
                </ul>
                <a
                  href={hrefContact}
                  className={cn(
                    'mt-auto inline-flex cursor-pointer items-center justify-center rounded-lg px-4 py-3 text-center text-sm font-semibold transition-colors',
                    featured
                      ? 'bg-foreground text-background hover:bg-foreground-hover'
                      : 'text-foreground border-border hover:border-foreground/40 hover:bg-background border bg-white'
                  )}
                >
                  Contact sales
                </a>
              </div>
            )
          })}
        </div>
      </section>

      <section
        id="pricing-faq"
        className="mb-16 scroll-mt-28"
        aria-labelledby="pricing-faq-heading"
      >
        <h2
          id="pricing-faq-heading"
          className={`text-xl sm:text-2xl ${headingClass} mb-6`}
        >
          Frequently asked questions
        </h2>
        <Accordion
          type="single"
          collapsible
          className="border-border rounded-xl border bg-white shadow-sm"
        >
          {FAQ_ITEMS.map((faq, i) => (
            <AccordionItem
              key={i}
              value={`faq-${variant}-${i}`}
              className="border-border px-4 last:border-b-0 sm:px-5"
            >
              <AccordionTrigger className="text-foreground hover:bg-muted/30 data-[state=open]:bg-foreground/10 -mx-1 cursor-pointer rounded-md px-1 py-5 text-left text-[15px] font-semibold hover:no-underline">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent
                className={`${bodyClass} pr-4 pb-5 pl-1 text-sm`}
              >
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <section className="border-border bg-background mb-16 rounded-xl border px-5 py-12 sm:px-8">
        <h2 className={`text-center text-xl sm:text-2xl ${headingClass} mb-10`}>
          How it works
        </h2>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {HOW_IT_WORKS.map((item) => (
            <div key={item.step} className="border-border border-l-2 pl-5">
              <p className="text-foreground/45 mb-2 text-xs font-semibold tabular-nums">
                0{item.step}
              </p>
              <h3 className="text-foreground mb-2 text-sm font-semibold tracking-tight">
                {item.title}
              </h3>
              <p className={`text-sm ${bodyClass}`}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-16">
        <h2 className={`text-xl sm:text-2xl ${headingClass} mb-3`}>
          What uses credits?
        </h2>
        <p className={`${bodyClass} mb-8 max-w-3xl text-[15px]`}>
          Credits are deducted per action across the platform. The amount varies
          by operation type—simpler actions use fewer credits; heavier
          operations use more.
        </p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {USAGE_EXAMPLES.map((ex) => (
            <div
              key={ex.type}
              className="border-border rounded-lg border bg-white p-4"
            >
              <h3 className="text-foreground mb-2 text-sm font-semibold tracking-tight">
                {ex.type}
              </h3>
              <p className={`text-sm ${bodyClass}`}>{ex.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-border mb-16 border p-8 sm:p-10">
        <h2 className="mb-3 text-lg font-semibold tracking-tight sm:text-xl">
          Need a custom package?
        </h2>
        <p className={`text-sm ${bodyClass} mb-8 max-w-xl`}>
          Volume discounts, dedicated support, or custom integrations—we’ll
          tailor a plan for you. Contact{' '}
          <a
            href="mailto:sales@zopkit.com"
            className="text-foreground cursor-pointer font-medium underline underline-offset-4"
          >
            sales@zopkit.com
          </a>
          .
        </p>
        <a
          href={hrefContact}
          className="landing-btn-primary inline-flex cursor-pointer items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
        >
          Contact sales
        </a>
      </section>

      {isLanding && (
        <p className={`text-center text-sm ${metaClass} pb-2`}>
          <Link
            to="/pricing"
            className="text-muted-foreground hover:text-foreground cursor-pointer font-medium underline underline-offset-4"
          >
            View pricing as a full page
          </Link>
        </p>
      )}
    </div>
  )
}
