import React, { useCallback, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Check, Loader2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { subscriptionAPI } from '@/lib/api';
import { applicationPlansFallback, creditTopups } from '@/features/billing/constants/billingPlans';
import { mapSubscriptionPlansResponse } from '@/features/billing/utils/mapSubscriptionPlansResponse';
import { formatMonthlyInrDisplay, formatMonthlyUsdDisplay } from '@/features/billing/utils/planPriceDisplay';
import { appDisplayName, moduleDisplayName } from '@/data/planDisplayLabels';
import { FALLBACK_PLAN_COVERAGE, FULL_MODULE_CATALOG_BY_APP } from '@/data/pricingPlanMatrix';
import type { ApplicationPlan, CheckoutCurrency } from '@/types/pricing';
import { cn } from '@/lib/utils';

const BILLING_PRICE_CURRENCY_KEY = 'wrapper.billing.price-currency';

function readStoredCheckoutCurrency(): CheckoutCurrency {
  try {
    if (typeof window === 'undefined') return 'usd';
    const v = localStorage.getItem(BILLING_PRICE_CURRENCY_KEY);
    if (v === 'inr' || v === 'usd') return v;
  } catch {
    /* ignore */
  }
  return 'usd';
}

const HOW_IT_WORKS = [
  { step: 1, title: 'Choose a plan', desc: 'Starter, Professional, or Enterprise—annual billing, credits included for the year.' },
  { step: 2, title: 'Use across apps', desc: 'Each plan unlocks a defined set of applications and modules—see the matrix for coverage by tier.' },
  { step: 3, title: 'Top up credits', desc: 'Need more? Buy credit packs anytime; they never expire.' },
  { step: 4, title: 'Scale when ready', desc: 'Upgrade your application plan or add credits from your billing workspace when you need to grow.' },
];

const USAGE_EXAMPLES = [
  { type: 'Simple actions', desc: 'Record creation, updates, single-item operations—lower credit cost per action.' },
  { type: 'Workflow & automation', desc: 'Runs, triggers, and automated steps—credit cost depends on complexity.' },
  { type: 'Reports & analytics', desc: 'Standard and advanced reports—more credits for larger or deeper reports.' },
  { type: 'Bulk & heavy operations', desc: 'Payroll, bulk processing, integrations—higher credit cost per run.' },
];

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
];

const contactSalesHref = (variant: 'page' | 'landing') =>
  variant === 'landing' ? '#contact' : '/#contact';

export type PublicPricingSectionProps = {
  variant?: 'page' | 'landing';
};

type RawPlanRow = {
  id?: string;
  applications?: string[];
  modules?: Record<string, string[] | '*'>;
};

/** When the API omits app/module data, map fallback coverage to whatever plan rows are shown (by tier order). */
function alignFallbackToPlans(
  plans: ApplicationPlan[],
  fallbackRows: RawPlanRow[]
): Map<string, RawPlanRow> {
  const m = new Map<string, RawPlanRow>();
  const n = Math.min(plans.length, fallbackRows.length);
  for (let i = 0; i < n; i++) {
    const f = fallbackRows[i];
    m.set(plans[i].id, {
      id: plans[i].id,
      applications: f.applications,
      modules: f.modules,
    });
  }
  return m;
}

function ModuleList({ moduleCodes }: { moduleCodes: string[] }) {
  const sorted = [...moduleCodes].sort((a, b) =>
    moduleDisplayName(a).localeCompare(moduleDisplayName(b))
  );
  return (
    <ul
      className="max-h-[min(16rem,40vh)] space-y-1.5 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin] [scrollbar-color:rgba(27,46,90,0.2)_transparent]"
      aria-label="Modules included"
    >
      {sorted.map((m) => (
        <li
          key={m}
          className="border-l-2 border-zopkit/20 pl-2.5 text-[13px] leading-snug text-zopkit/80"
        >
          {moduleDisplayName(m)}
        </li>
      ))}
    </ul>
  );
}

function moduleCellContent(
  planRow: RawPlanRow | undefined,
  appId: string
): React.ReactNode {
  if (!planRow?.applications?.includes(appId)) {
    return (
      <div className="flex min-h-[2.5rem] items-center justify-center py-1">
        <span className="text-sm tabular-nums text-zopkit/25" aria-label="Not included">
          —
        </span>
      </div>
    );
  }
  const mods = planRow.modules?.[appId];
  if (mods === '*') {
    const expanded = FULL_MODULE_CATALOG_BY_APP[appId];
    if (expanded && expanded.length > 0) {
      return <ModuleList moduleCodes={expanded} />;
    }
    return (
      <div className="flex items-center gap-2 py-1">
        <Check className="h-4 w-4 shrink-0 text-zopkit" strokeWidth={2} aria-hidden />
        <span className="text-[13px] font-medium text-zopkit/90">All modules</span>
      </div>
    );
  }
  if (Array.isArray(mods) && mods.length > 0) {
    return <ModuleList moduleCodes={mods} />;
  }
  return (
    <div className="flex items-center gap-2 py-1">
      <Check className="h-4 w-4 shrink-0 text-zopkit" strokeWidth={2} aria-hidden />
      <span className="text-[13px] font-medium text-zopkit/90">Included</span>
    </div>
  );
}

function ApplicationsModulesMatrixTable({
  plans,
  matrixRowsById,
}: {
  plans: ApplicationPlan[];
  matrixRowsById: Map<string, RawPlanRow>;
}) {
  const unionApps = Array.from(
    new Set(plans.flatMap((p) => matrixRowsById.get(p.id)?.applications ?? []))
  ).sort((a, b) => appDisplayName(a).localeCompare(appDisplayName(b)));

  if (unionApps.length === 0) {
    return (
      <p className="text-center text-sm text-zopkit/55 py-8 border border-dashed border-zopkit/20 rounded-xl bg-zopkit-surface/80">
        Application coverage will appear here when subscription data is available.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zopkit/15 bg-white shadow-sm">
      <div className="border-b border-zopkit/10 bg-zopkit-surface px-4 py-2.5 sm:px-5">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-zopkit/50">Module coverage</p>
      </div>
      <div className="overflow-x-auto">
        <Table className="w-full min-w-[760px] border-collapse text-sm">
          <TableHeader>
            <TableRow className="border-0 hover:bg-transparent [&>th]:border-b [&>th]:border-zopkit/15">
              <TableHead className="sticky left-0 z-[2] min-w-[176px] border-r border-zopkit/15 bg-zopkit-surface px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-zopkit/55">
                Application
              </TableHead>
              {plans.map((p) => (
                <TableHead
                  key={p.id}
                  className="min-w-[220px] bg-zopkit-surface px-4 py-3.5 text-center align-bottom text-sm font-semibold tracking-tight text-zopkit"
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
                className="group border-0 border-b border-zopkit/10 transition-colors last:border-b-0 hover:bg-zopkit/5"
              >
                <TableCell className="sticky left-0 z-[1] border-r border-zopkit/15 bg-white px-4 py-4 align-top text-sm font-semibold tracking-tight text-zopkit transition-colors group-hover:bg-zopkit/5">
                  {appDisplayName(appId)}
                </TableCell>
                {plans.map((p) => (
                  <TableCell
                    key={`${appId}-${p.id}`}
                    className="border-l border-zopkit/10 bg-white px-4 py-4 align-top transition-colors group-hover:bg-zopkit/5"
                  >
                    {moduleCellContent(matrixRowsById.get(p.id), appId)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="border-t border-zopkit/10 bg-zopkit-surface px-4 py-3 sm:px-5">
        <p className="text-[11px] leading-relaxed text-zopkit/55">
          Coverage reflects the platform access matrix. Your contract and billing profile determine final entitlements.
        </p>
      </div>
    </div>
  );
}

function FeatureBullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-sm text-zopkit/80 leading-relaxed">
      <span
        className="mt-2 h-1 w-1 shrink-0 rounded-full bg-zopkit"
        aria-hidden
      />
      <span>{children}</span>
    </li>
  );
}

export function PublicPricingSection({ variant = 'page' }: PublicPricingSectionProps) {
  const hrefContact = contactSalesHref(variant);
  const isLanding = variant === 'landing';

  const [checkoutCurrency, setCheckoutCurrencyState] = useState<CheckoutCurrency>(() =>
    readStoredCheckoutCurrency()
  );

  const setCheckoutCurrency = useCallback((c: CheckoutCurrency) => {
    setCheckoutCurrencyState(c);
    try {
      localStorage.setItem(BILLING_PRICE_CURRENCY_KEY, c);
    } catch {
      /* ignore */
    }
  }, []);

  const { data: rawPlans, isLoading } = useQuery({
    queryKey: ['subscription', 'plans', 'public'],
    queryFn: async () => {
      const response = await subscriptionAPI.getAvailablePlans();
      const raw = response.data?.data ?? response.data;
      return Array.isArray(raw) ? (raw as RawPlanRow[]) : [];
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const applicationPlans: ApplicationPlan[] =
    rawPlans && rawPlans.length > 0
      ? mapSubscriptionPlansResponse(rawPlans)
      : applicationPlansFallback;

  const rawHasMatrix = (rawPlans ?? []).some((r) => (r.applications?.length ?? 0) > 0);

  const matrixRowsById = new Map<string, RawPlanRow>();
  if (rawHasMatrix) {
    (rawPlans ?? []).forEach((r) => {
      const id = String(r.id ?? '');
      if (id) matrixRowsById.set(id, r);
    });
  } else {
    alignFallbackToPlans(applicationPlans, FALLBACK_PLAN_COVERAGE).forEach((v, k) => {
      matrixRowsById.set(k, v);
    });
  }

  const headingClass = 'text-zopkit font-semibold tracking-tight';
  const bodyClass = 'text-zopkit/75 leading-relaxed';
  const metaClass = 'text-zopkit/55 text-sm leading-relaxed';

  return (
    <div className="font-sans text-zopkit/90 antialiased">
      {/* Hero */}
      <section className={`text-center ${isLanding ? 'pt-2 pb-8 md:pb-10' : 'pt-4 pb-10 md:pb-12'}`}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zopkit/45 mb-4">
          Pricing
        </p>
        {isLanding ? (
          <h2 className={`text-3xl sm:text-4xl md:text-[2.5rem] ${headingClass} mb-4 max-w-2xl mx-auto leading-tight`}>
            Annual plans &amp; credits
          </h2>
        ) : (
          <h1 className={`text-3xl sm:text-4xl md:text-[2.5rem] ${headingClass} mb-4 max-w-2xl mx-auto leading-tight`}>
            Annual plans &amp; credits
          </h1>
        )}
        <p className={`text-base ${bodyClass} max-w-xl mx-auto mb-6`}>
          Pick a tier for the apps and modules you need.{' '}
          <span className="font-medium text-zopkit">Billed annually</span> in USD or INR. Credits included each year;
          add top-ups anytime.
        </p>
        <p className="mt-6">
          <a
            href="#pricing-faq"
            className="cursor-pointer text-sm font-medium text-zopkit hover:text-zopkit-hover underline underline-offset-4 decoration-zopkit/30 hover:decoration-zopkit"
          >
            Frequently asked questions
          </a>
        </p>
      </section>

      {/* Applications & modules matrix */}
      <section className="mb-12 md:mb-14 max-w-6xl mx-auto px-0 sm:px-1" aria-labelledby="applications-modules-matrix-heading">
        <div className="mb-5 text-center sm:mb-6">
          <h2 id="applications-modules-matrix-heading" className={`text-base sm:text-lg ${headingClass} mb-1.5`}>
            Applications &amp; modules by plan
          </h2>
          <p className={`mx-auto max-w-lg text-sm ${metaClass}`}>
            Full module list per application. API data is used when available.
          </p>
        </div>
        <ApplicationsModulesMatrixTable plans={applicationPlans} matrixRowsById={matrixRowsById} />
      </section>

      {/* Currency */}
      <div className="flex justify-center mb-10">
        <div
          className="inline-flex rounded-md border border-zopkit/15 p-0.5 bg-white shadow-sm"
          role="group"
          aria-label="Billing currency"
        >
          <button
            type="button"
            onClick={() => setCheckoutCurrency('usd')}
            className={cn(
              'cursor-pointer px-5 py-2 rounded-[5px] text-sm font-medium transition-colors min-w-[3.5rem]',
              checkoutCurrency === 'usd'
                ? 'bg-zopkit text-white'
                : 'text-zopkit/65 hover:bg-zopkit-surface'
            )}
          >
            USD
          </button>
          <button
            type="button"
            onClick={() => setCheckoutCurrency('inr')}
            className={cn(
              'cursor-pointer px-5 py-2 rounded-[5px] text-sm font-medium transition-colors min-w-[3.5rem]',
              checkoutCurrency === 'inr'
                ? 'bg-zopkit text-white'
                : 'text-zopkit/65 hover:bg-zopkit-surface'
            )}
          >
            INR
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-14 gap-3 items-center text-zopkit/55">
          <Loader2 className="w-5 h-5 animate-spin text-zopkit/70" aria-hidden />
          <span className="text-sm font-medium text-zopkit/70">Loading plans</span>
        </div>
      )}

      {/* Application plans */}
      <section className="mb-14" aria-label="Application plans">
        <p className={`text-center ${metaClass} mb-8 max-w-2xl mx-auto`}>
          Billed annually · credits renew each billing year
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-7 items-stretch">
          {applicationPlans.map((pkg) => {
            const showInr =
              checkoutCurrency === 'inr' && (pkg.annualPriceInr ?? 0) > 0;
            const monthlyDisplay = showInr
              ? formatMonthlyInrDisplay(pkg.annualPriceInr ?? 0)
              : formatMonthlyUsdDisplay(pkg.annualPriceUsd ?? 0);
            const perMonthLabel = showInr ? 'Per month (INR)' : 'Per month (USD)';
            const featured = Boolean(pkg.popular);
            return (
              <div
                key={pkg.id}
                className={cn(
                  'relative flex flex-col rounded-xl border bg-white p-7 md:p-8 transition-shadow',
                  featured
                    ? 'border-zopkit shadow-md shadow-zopkit/10 z-[1]'
                    : 'border-zopkit/15 hover:border-zopkit/30 hover:shadow-sm'
                )}
              >
                {featured && (
                  <div className="absolute -top-px left-1/2 -translate-x-1/2">
                    <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.14em] px-3 py-1.5 rounded-b-md bg-zopkit text-white">
                      Most popular
                    </span>
                  </div>
                )}
                <div className={cn('mb-6', featured && 'pt-2')}>
                  <h3 className="text-lg font-semibold text-zopkit tracking-tight">{pkg.name}</h3>
                  <p className={`mt-2 text-sm ${bodyClass}`}>{pkg.description}</p>
                </div>
                <div className="mb-1">
                  <span className="text-4xl font-semibold tabular-nums tracking-tight text-zopkit">
                    {monthlyDisplay}
                  </span>
                </div>
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-zopkit/50 mb-5">{perMonthLabel}</p>
                <p className="text-sm font-medium text-zopkit border-t border-zopkit/10 pt-5 mb-6">
                  {pkg.freeCredits.toLocaleString()} credits included per year
                </p>
                <ul className="space-y-3 mb-10 flex-1">
                  {pkg.features.map((f, i) => (
                    <FeatureBullet key={i}>{f}</FeatureBullet>
                  ))}
                </ul>
                <a
                  href={hrefContact}
                  className={cn(
                    'mt-auto inline-flex items-center justify-center text-center rounded-lg py-3 px-4 text-sm font-semibold transition-colors cursor-pointer',
                    featured
                      ? 'bg-zopkit text-white hover:bg-zopkit-hover'
                      : 'bg-white text-zopkit border border-zopkit/15 hover:border-zopkit/40 hover:bg-zopkit-surface'
                  )}
                >
                  Contact sales
                </a>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-14">
        <div className="rounded-xl border border-zopkit/15 bg-zopkit-surface px-6 py-5">
          <h2 className="text-base font-semibold text-zopkit tracking-tight">Credits included yearly</h2>
          <p className={`mt-2 text-sm ${bodyClass}`}>
            Each application plan includes an annual credit pool for platform usage. Need more? Use credit top-ups below.
          </p>
        </div>
      </section>

      <section className="mb-16" aria-label="Credit top-ups">
        <h2 className={`text-xl sm:text-2xl text-center ${headingClass} mb-3`}>Credit top-ups</h2>
        <p className={`text-center ${metaClass} max-w-2xl mx-auto mb-8`}>
          One-time purchase bundles—same options as in-app billing. Credits never expire.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-7 items-stretch">
          {creditTopups.map((topup) => {
            const featured = Boolean(topup.recommended);
            return (
              <div
                key={topup.id}
                className={cn(
                  'relative flex flex-col rounded-xl border bg-white p-7 md:p-8',
                  featured
                    ? 'border-zopkit shadow-md shadow-zopkit/10'
                    : 'border-zopkit/15 hover:shadow-sm'
                )}
              >
                {featured && (
                  <div className="absolute -top-px left-1/2 -translate-x-1/2">
                    <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.14em] px-3 py-1.5 rounded-b-md bg-zopkit text-white">
                      Best value
                    </span>
                  </div>
                )}
                <div className={cn('mb-6', featured && 'pt-2')}>
                  <h3 className="text-lg font-semibold text-zopkit tracking-tight">{topup.name}</h3>
                  <p className={`mt-2 text-sm ${bodyClass}`}>{topup.description}</p>
                </div>
                <div className="mb-1">
                  <span className="text-4xl font-semibold tabular-nums text-zopkit">${topup.price}</span>
                  <span className={`ml-1.5 text-sm ${metaClass}`}>one-time</span>
                </div>
                <p className="text-sm font-medium text-zopkit border-t border-zopkit/10 pt-5 mb-6">
                  {topup.credits.toLocaleString()} credits
                </p>
                <ul className="space-y-3 mb-10 flex-1">
                  {topup.features.map((f, i) => (
                    <FeatureBullet key={i}>{f}</FeatureBullet>
                  ))}
                </ul>
                <a
                  href={hrefContact}
                  className={cn(
                    'mt-auto inline-flex items-center justify-center text-center rounded-lg py-3 px-4 text-sm font-semibold transition-colors cursor-pointer',
                    featured
                      ? 'bg-zopkit text-white hover:bg-zopkit-hover'
                      : 'bg-white text-zopkit border border-zopkit/15 hover:border-zopkit/40 hover:bg-zopkit-surface'
                  )}
                >
                  Contact sales
                </a>
              </div>
            );
          })}
        </div>
      </section>

      <section id="pricing-faq" className="mb-16 scroll-mt-28" aria-labelledby="pricing-faq-heading">
        <h2 id="pricing-faq-heading" className={`text-xl sm:text-2xl ${headingClass} mb-6`}>
          Frequently asked questions
        </h2>
        <Accordion
          type="single"
          collapsible
          className="rounded-xl border border-zopkit/15 bg-white shadow-sm"
        >
          {FAQ_ITEMS.map((faq, i) => (
            <AccordionItem key={i} value={`faq-${variant}-${i}`} className="border-zopkit/10 px-4 sm:px-5 last:border-b-0">
              <AccordionTrigger className="cursor-pointer text-left text-[15px] font-semibold text-zopkit hover:no-underline py-5 hover:bg-zopkit/5 rounded-md px-1 -mx-1 data-[state=open]:bg-zopkit/10">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className={`${bodyClass} text-sm pl-1 pr-4 pb-5`}>{faq.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <section className="mb-16 py-12 px-5 sm:px-8 rounded-xl border border-zopkit/15 bg-zopkit-surface">
        <h2 className={`text-xl sm:text-2xl text-center ${headingClass} mb-10`}>How it works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
          {HOW_IT_WORKS.map((item) => (
            <div key={item.step} className="border-l-2 border-zopkit/25 pl-5">
              <p className="text-xs font-semibold tabular-nums text-zopkit/45 mb-2">0{item.step}</p>
              <h3 className="text-sm font-semibold text-zopkit tracking-tight mb-2">{item.title}</h3>
              <p className={`text-sm ${bodyClass}`}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-16">
        <h2 className={`text-xl sm:text-2xl ${headingClass} mb-3`}>What uses credits?</h2>
        <p className={`${bodyClass} text-[15px] mb-8 max-w-3xl`}>
          Credits are deducted per action across the platform. The amount varies by operation type—simpler actions use
          fewer credits; heavier operations use more.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {USAGE_EXAMPLES.map((ex) => (
            <div key={ex.type} className="rounded-lg border border-zopkit/15 bg-white p-4">
              <h3 className="text-sm font-semibold text-zopkit tracking-tight mb-2">{ex.type}</h3>
              <p className={`text-sm ${bodyClass}`}>{ex.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-16 p-8 sm:p-10 rounded-xl bg-zopkit text-white border border-zopkit-hover">
        <h2 className="text-lg sm:text-xl font-semibold tracking-tight mb-3">Need a custom package?</h2>
        <p className="text-sm text-white/80 leading-relaxed mb-8 max-w-xl">
          Volume discounts, dedicated support, or custom integrations—we’ll tailor a plan for you. Contact{' '}
          <a href="mailto:sales@zopkit.com" className="cursor-pointer font-medium text-white underline underline-offset-4 decoration-white/30 hover:decoration-white">
            sales@zopkit.com
          </a>
          .
        </p>
        <a
          href={hrefContact}
          className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-zopkit hover:bg-zopkit-surface transition-colors"
        >
          Contact sales
        </a>
      </section>

      {isLanding && (
        <p className={`text-center text-sm ${metaClass} pb-2`}>
          <Link
            to="/pricing"
            className="cursor-pointer font-medium text-zopkit hover:text-zopkit-hover underline underline-offset-4 decoration-zopkit/25"
          >
            View pricing as a full page
          </Link>
        </p>
      )}
    </div>
  );
}
