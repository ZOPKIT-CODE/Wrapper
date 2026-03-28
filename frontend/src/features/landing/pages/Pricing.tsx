import React from 'react';
import { Link } from '@tanstack/react-router';
import { LegalPageLayout } from '@/components/layout/LegalPageLayout';
import { Check, ArrowRight, Sparkles, TrendingUp, Zap } from 'lucide-react';

const CREDIT_PACKAGES = [
  {
    id: 'starter',
    name: 'Starter',
    credits: 1000,
    freeCreditsPerMonth: 100,
    description: 'Perfect for small teams getting started',
    features: [
      '1,000 credits included',
      '100 free credits every month',
      'Basic operations support',
      'Email support',
    ],
    recommended: false,
    badge: null,
  },
  {
    id: 'professional',
    name: 'Professional',
    credits: 5000,
    freeCreditsPerMonth: 500,
    description: 'Ideal for growing teams with regular operations',
    features: [
      '5,000 credits included',
      '500 free credits every month',
      'Advanced operations support',
      'Priority email support',
      'Basic reporting',
    ],
    recommended: true,
    badge: 'Most Popular',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    credits: 15000,
    freeCreditsPerMonth: 1500,
    description: 'For large organizations with high-volume operations',
    features: [
      '15,000 credits included',
      '1,500 free credits every month',
      'Full operations support',
      'Phone & email support',
      'Advanced reporting',
      'Custom integrations',
    ],
    recommended: false,
    badge: 'Best Value',
  },
];

const HOW_IT_WORKS = [
  { step: 1, title: 'Pay as you go', desc: 'Use only what you need. No recurring subscription—buy credits when you need them.' },
  { step: 2, title: 'Pay as you grow', desc: 'Start small and scale. Every plan includes free credits every month so you can grow without lock-in.' },
  { step: 3, title: 'Use across the platform', desc: 'Credits power CRM, payroll, reports, and more. One balance, one place.' },
  { step: 4, title: 'Top up anytime', desc: 'Add more credits whenever you need. No contracts, no surprises.' },
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
    a: 'Different operations use different credit amounts. Credits are deducted in real time, and you can view your transaction history anytime.',
  },
  {
    q: 'What are the free monthly credits?',
    a: 'Every package includes free credits every month on top of your purchased credits. Use them for light usage or to try new features—no extra cost.',
  },
  {
    q: 'What happens when credits run out?',
    a: 'Operations pause until you add more credits. We notify you when your balance is low so you can top up in time.',
  },
  {
    q: 'Can I buy more credits anytime?',
    a: 'Yes. Purchase additional credits whenever you need. New credits are added immediately—pay as you go, pay as you grow.',
  },
  {
    q: 'Is there a long-term commitment?',
    a: 'No. There are no contracts or minimum terms. Use credits at your pace and scale when you’re ready.',
  },
];

const Pricing: React.FC = () => (
  <LegalPageLayout title="Pricing" wide contained={false}>
    {/* Hero */}
    <section className="text-center pt-4 pb-12 md:pb-16">
      <h1 className="text-3xl md:text-5xl font-bold text-[#1B2E5A] tracking-tight mb-4">
        Pay as you go.<br className="sm:hidden" /> Pay as you grow.
      </h1>
      <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto mb-6">
        Credit-based pricing with free credits every month. No subscriptions, no lock-in—scale when you need to.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-amber-500" />
          Free credits every month
        </span>
        <span className="hidden sm:inline text-slate-300">•</span>
        <span className="inline-flex items-center gap-1.5">
          <Zap className="w-4 h-4 text-blue-500" />
          No long-term commitment
        </span>
        <span className="hidden sm:inline text-slate-300">•</span>
        <span className="inline-flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4 text-green-500" />
          Scale anytime
        </span>
      </div>
    </section>

    {/* Free credits callout */}
    <section className="mb-12">
      <div className="rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="font-semibold text-[#1B2E5A]">Free credits every month</h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Every plan includes free credits each month on top of your package—so you can keep moving without worrying about expiry or lock-in.
          </p>
        </div>
      </div>
    </section>

    {/* Pricing cards — industry-standard 3-column with elevated recommended */}
    <section className="mb-20" aria-label="Plans">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-stretch">
        {CREDIT_PACKAGES.map((pkg) => (
          <div
            key={pkg.id}
            className={`relative flex flex-col rounded-2xl border-2 bg-white p-6 md:p-8 transition-all ${
              pkg.recommended
                ? 'border-blue-500 shadow-xl shadow-blue-500/15 lg:scale-[1.02] z-10 ring-2 ring-blue-500/20'
                : 'border-slate-200 hover:border-slate-300 hover:shadow-lg'
            }`}
          >
            {pkg.badge && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className={`inline-block text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full ${
                  pkg.recommended ? 'bg-[#1B2E5A] text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {pkg.badge}
                </span>
              </div>
            )}
            <div className="mb-6">
              <h2 className="text-xl font-bold text-[#1B2E5A]">{pkg.name}</h2>
              <p className="text-slate-600 text-sm mt-1">{pkg.description}</p>
            </div>
            <div className="mb-2">
              <span className="text-4xl font-bold text-slate-900">{pkg.credits.toLocaleString()}</span>
              <span className="text-slate-600 ml-1">credits</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-green-700 font-medium mb-6">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              {pkg.freeCreditsPerMonth.toLocaleString()} free credits every month
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {pkg.features.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                  <Check className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              to="/landing#pricing"
              className={`mt-auto w-full inline-flex items-center justify-center gap-2 rounded-xl py-3.5 px-4 font-semibold text-sm transition-colors ${
                pkg.recommended
                  ? 'bg-[#1B2E5A] text-white hover:bg-[#162447]'
                  : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
              }`}
            >
              {pkg.id === 'enterprise' ? 'Get a Quote' : 'Contact Sales'}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ))}
      </div>
    </section>

    {/* How it works */}
    <section className="mb-20 py-12 px-6 rounded-2xl bg-slate-50 border border-slate-100">
      <h2 className="text-2xl font-bold text-[#1B2E5A] mb-8 text-center">How it works</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {HOW_IT_WORKS.map((item) => (
          <div key={item.step} className="flex gap-4 p-4 rounded-xl bg-white border border-slate-100 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">
              {item.step}
            </div>
            <div>
              <h3 className="font-semibold text-[#1B2E5A]">{item.title}</h3>
              <p className="text-slate-600 text-sm mt-1">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>

    {/* Usage examples */}
    <section className="mb-20">
      <h2 className="text-2xl font-bold text-[#1B2E5A] mb-4">What uses credits?</h2>
      <p className="text-slate-600 mb-6">
        Credits are deducted per action across the platform. The amount varies by operation type—simpler actions use fewer credits; heavier operations use more.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {USAGE_EXAMPLES.map((ex) => (
          <div key={ex.type} className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <h3 className="font-semibold text-[#1B2E5A] text-sm mb-1">{ex.type}</h3>
            <p className="text-slate-600 text-sm leading-relaxed">{ex.desc}</p>
          </div>
        ))}
      </div>
    </section>

    {/* Enterprise CTA */}
    <section className="mb-20 p-8 rounded-2xl bg-slate-900 text-white border border-slate-800">
      <h2 className="text-xl font-bold mb-2">Need a custom package?</h2>
      <p className="text-slate-300 text-sm mb-6 max-w-xl">
        Volume discounts, dedicated support, or custom integrations—we’ll tailor a plan for you. Contact{' '}
        <a href="mailto:sales@zopkit.com" className="text-blue-400 hover:underline">sales@zopkit.com</a>.
      </p>
      <Link
        to="/landing#pricing"
        className="inline-flex items-center gap-2 rounded-xl bg-white text-slate-900 font-semibold text-sm px-5 py-2.5 hover:bg-slate-100 transition-colors"
      >
        Contact Sales
        <ArrowRight className="w-4 h-4" />
      </Link>
    </section>

    {/* FAQ */}
    <section id="pricing-faq" className="mb-12">
      <h2 className="text-2xl font-bold text-[#1B2E5A] mb-6">Frequently asked questions</h2>
      <div className="space-y-6">
        {FAQ_ITEMS.map((faq, i) => (
          <div key={i} className="border-b border-slate-200 pb-6 last:border-0">
            <h3 className="font-semibold text-[#1B2E5A] mb-2">{faq.q}</h3>
            <p className="text-slate-600 text-sm leading-relaxed">{faq.a}</p>
          </div>
        ))}
      </div>
    </section>
  </LegalPageLayout>
);

export default Pricing;
