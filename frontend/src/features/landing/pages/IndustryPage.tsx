import React, { Suspense } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import { ArrowRight, PlayCircle } from 'lucide-react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { getIndustryBySlug } from '@/data/industryPages'
import {
  OrbitalEcosystem,
  WORKFLOW_ORBIT_APP_IDS,
} from '@/features/landing/components/OrbitalEcosystem'
import { LandingSectionIntro } from '@/features/landing/components/LandingSectionIntro'
import { resolveMarketingCtaAction } from '@/features/landing/marketing-cta'
import { useMarketingContactCta } from '@/features/landing/useMarketingContactCta'

const WorkflowVisualizer = React.lazy(() =>
  import('@/features/landing/components/WorkflowVisualizer').then((m) => ({
    default: m.WorkflowVisualizer,
  }))
)

const IndustryPage: React.FC = () => {
  const { industrySlug } = useParams({ strict: false })
  const navigate = useNavigate()
  const scrollToContact = useMarketingContactCta()
  const { scrollY } = useScroll()
  const backgroundY = useTransform(scrollY, [0, 500], [0, 150])

  const data = industrySlug ? getIndustryBySlug(industrySlug) : undefined

  if (!data) {
    return (
      <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center">
        <div className="text-center">
          <h1 className="text-primary mb-4 text-2xl font-bold">
            Industry Not Found
          </h1>
          <button
            onClick={() => navigate({ to: '/' })}
            className="text-primary hover:text-primary/80 font-medium"
          >
            Return to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="text-foreground selection:bg-primary/10 selection:text-primary font-sans">
      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 pt-32 pb-24 sm:px-6 lg:px-8">
        <div className="absolute inset-0 -z-20 bg-slate-50"></div>
        <motion.div
          style={{ y: backgroundY }}
          className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] bg-[size:24px_24px]"
        ></motion.div>

        <div className="relative z-10 mx-auto max-w-5xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-1.5 text-xs font-bold tracking-wider text-blue-700 uppercase shadow-sm"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500"></span>
            </span>
            {data.name} Solutions
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-8 bg-gradient-to-r from-[#1B2E5A] via-[#2D4A7B] to-[#4A6FA5] bg-clip-text text-5xl font-extrabold tracking-tight text-[#1B2E5A] text-transparent lg:text-7xl"
          >
            {data.hero.headline}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mx-auto mb-10 max-w-3xl text-xl leading-relaxed text-slate-600"
          >
            {data.hero.subheadline}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <button
              type="button"
              onClick={resolveMarketingCtaAction(
                data.hero.primaryCTA,
                scrollToContact,
                navigate
              )}
              className="landing-btn-primary group inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-medium"
            >
              {data.hero.primaryCTA}
              <ArrowRight
                size={18}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </button>
            <button
              type="button"
              onClick={resolveMarketingCtaAction(
                data.hero.secondaryCTA,
                scrollToContact,
                navigate
              )}
              className="landing-text-link group border-border bg-background hover:bg-muted/50 inline-flex items-center gap-2 rounded-full border px-8 py-4 text-base font-medium transition-colors"
            >
              <PlayCircle size={18} className="text-muted-foreground" />
              {data.hero.secondaryCTA}
            </button>
          </motion.div>
        </div>
      </section>

      {/* Pain Points Section */}
      <section
        id="challenges"
        className="relative bg-white px-4 py-24 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-bold text-[#1B2E5A]">
              Common Challenges We Solve
            </h2>
            <p className="mx-auto max-w-2xl text-xl text-slate-600">
              Transforming obstacles into opportunities for {data.name} leaders.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {data.painPoints.map((point, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group rounded-2xl border border-slate-200 bg-slate-50 p-8 transition-all duration-300 hover:-translate-y-1 hover:border-[#162447] hover:bg-[#1B2E5A] hover:shadow-xl hover:shadow-[#0f172a]/25"
              >
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 transition-colors group-hover:bg-white/15">
                  <point.icon
                    size={24}
                    className="text-blue-600 transition-colors group-hover:text-white"
                  />
                </div>
                <h3 className="mb-2 text-lg font-bold text-[#1B2E5A] transition-colors group-hover:text-white">
                  {point.text}
                </h3>
                <p className="text-sm leading-relaxed text-slate-500 transition-colors group-hover:text-slate-200">
                  Our platform directly addresses this by streamlining
                  operations and providing real-time visibility.
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrated solutions â€” orbital ecosystem (same interactive as home page) */}
      <section
        id="integrated-solutions"
        className="scroll-mt-24 border-y border-slate-200 bg-slate-50 px-4 pt-28 pb-24 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center sm:mb-16">
            <h2 className="mb-4 text-4xl font-bold text-[#1B2E5A]">
              Integrated Solutions Ecosystem
            </h2>
            <p className="mx-auto max-w-2xl text-xl text-slate-600">
              Explore how every app connects around the Zopkit hub â€” tap the
              orbit to see dependencies, matching the home page experience.
            </p>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex justify-center rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/40 md:p-12"
          >
            <OrbitalEcosystem
              layout="stack"
              appIds={WORKFLOW_ORBIT_APP_IDS}
              motionClassName="mx-auto w-full max-w-[420px] lg:max-w-[520px]"
            />
          </motion.div>
        </div>
      </section>

      <section
        id="workflows"
        className="landing-section landing-section-muted border-border bg-background overflow-x-hidden border-b"
      >
        <div className="landing-section-inner pt-20 pb-10 sm:pt-24">
          <LandingSectionIntro
            eyebrow="Workflows"
            title={`Intelligent workflow automation for ${data.name}`}
            lead="Watch how connected apps orchestrate complex processes in real time — the same engine configured on the landing page."
          />
        </div>
        <Suspense
          fallback={
            <div className="landing-section-inner border-border min-h-[380px] border-t pb-16 sm:pb-20" />
          }
        >
          <WorkflowVisualizer hideIntro />
        </Suspense>
      </section>

      <section className="landing-section border-border bg-muted/30 border-b px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="landing-display text-foreground mb-4 text-3xl font-semibold tracking-tight md:text-4xl">
            {data.finalCTA.headline}
          </h2>
          <p className="text-muted-foreground mx-auto mb-10 max-w-2xl text-lg leading-relaxed">
            {data.finalCTA.description}
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={resolveMarketingCtaAction(
                data.finalCTA.primaryCTA,
                scrollToContact,
                navigate
              )}
              className="landing-btn-primary group inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-sm font-medium"
            >
              {data.finalCTA.primaryCTA}
              <ArrowRight
                size={16}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </button>
            {data.finalCTA.secondaryCTAs.map((cta) => (
              <button
                key={cta}
                type="button"
                onClick={resolveMarketingCtaAction(
                  cta,
                  scrollToContact,
                  navigate
                )}
                className="landing-text-link border-border bg-background hover:bg-muted/50 rounded-full border px-8 py-3.5 text-sm font-medium transition-colors"
              >
                {cta}
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

export default IndustryPage
