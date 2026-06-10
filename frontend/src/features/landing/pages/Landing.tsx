import React, { Suspense, useState, useEffect } from 'react'
import { PetpoojaHeroSection } from '@/features/landing/components/PetpoojaHeroSection'
import { useNavigate } from '@tanstack/react-router'
import { DynamicIcon } from '@/features/landing/components/Icons'
import {
  ArrowRight,
  FileText,
  GraduationCap,
  Users,
  Zap,
  Mail,
  Phone,
  MapPin,
} from 'lucide-react'
import api from '@/lib/api'
import { toast } from 'sonner'
import { consumeSessionRecoveryReason } from '@/lib/auth/session-recovery'

const WorkflowVisualizer = React.lazy(() =>
  import('@/features/landing/components/WorkflowVisualizer').then((m) => ({
    default: m.WorkflowVisualizer,
  }))
)
import { getAllIndustries } from '@/data/industryPages'

import { LandingFooter } from '@/components/layout/LandingFooter'
import { MarketingNavbar } from '@/components/layout/MarketingNavbar'

const Landing: React.FC = () => {
  const navigate = useNavigate()

  // Contact form state
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
    jobTitle: '',
    companySize: '',
    preferredTime: '',
    comments: '',
  })
  const [isSubmittingContact, setIsSubmittingContact] = useState(false)

  // Scroll to top when landing page loads
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  useEffect(() => {
    const recoveryReason = consumeSessionRecoveryReason()
    if (
      recoveryReason === 'invalid_grant' ||
      recoveryReason === 'session_expired'
    ) {
      toast.error('Your session has expired. Please sign in again.', {
        id: 'session-expired',
        duration: 6000,
        position: 'top-center',
      })
    }
  }, [])

  return (
    <div className="relative min-h-screen overflow-x-clip bg-white font-sans text-slate-900 selection:bg-teal-100 selection:text-teal-900 lg:overflow-x-visible">
      {/* Hero background */}
      <div
        className="pointer-events-none absolute top-0 right-0 left-0 z-0 h-[720px] overflow-hidden"
        aria-hidden="true"
      >
        {/* Base gradient */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom, #FAFBFC 0%, #FFFFFF 100%)',
          }}
        />
        {/* Single indigo radial wash */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 700px 350px at 50% 0%, rgba(99,102,241,0.05) 0%, transparent 70%)',
          }}
        />
        {/* Dot pattern — low opacity, 32px, masked to fade out */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(15,23,42,0.025) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
            WebkitMaskImage:
              'linear-gradient(to bottom, black 0%, transparent 80%)',
            maskImage: 'linear-gradient(to bottom, black 0%, transparent 80%)',
          }}
        />
        {/* Hairline separator just below navbar */}
        <div
          className="absolute right-0 left-0 h-px"
          style={{
            top: '64px',
            background:
              'linear-gradient(to right, transparent, rgba(148,163,184,0.6), transparent)',
          }}
        />
      </div>

      <MarketingNavbar />

      {/* Hero */}
      <PetpoojaHeroSection
        onBookDemo={() => {
          const el = document.getElementById('contact')
          if (el) el.scrollIntoView({ behavior: 'smooth' })
        }}
      />

      <section
        id="workflows"
        className="overflow-x-hidden bg-white py-12 sm:py-20 lg:py-24"
        style={{
          contentVisibility: 'auto',
          containIntrinsicSize: 'auto 800px',
        }}
      >
        <Suspense fallback={<div className="min-h-[400px]" />}>
          <WorkflowVisualizer />
        </Suspense>
      </section>

      {/* Industries Section */}
      <section
        id="industries"
        className="bg-white px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24"
        style={{
          contentVisibility: 'auto',
          containIntrinsicSize: 'auto 700px',
        }}
      >
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center sm:mb-16">
            <p className="mb-3 text-sm font-semibold tracking-wide text-slate-400">
              Industries
            </p>
            <h2 className="text-2xl font-extrabold tracking-[-0.025em] text-[#1B2E5A] sm:text-3xl lg:text-4xl">
              Built for how you work
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-slate-500 sm:text-lg">
              Tailored solutions for the unique challenges of your industry.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {getAllIndustries().map((industry) => {
              const iconMap: Record<string, string> = {
                'e-commerce': 'ShoppingCart',
                saas: 'Briefcase',
                manufacturing: 'Box',
                'professional-services': 'Users',
              }
              const topStats = industry.hero.stats.slice(0, 2)

              return (
                <div
                  key={industry.slug}
                  className="group flex cursor-pointer flex-col rounded-2xl bg-[#fafafa] p-6 transition-all duration-300 hover:bg-[#243B6E] sm:p-7"
                  onClick={() =>
                    navigate({ to: `/industries/${industry.slug}` })
                  }
                >
                  {/* Icon */}
                  <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-white transition-colors duration-300 group-hover:bg-white/10">
                    <DynamicIcon
                      name={iconMap[industry.slug] ?? 'Building2'}
                      className="h-5 w-5 text-slate-700 transition-colors duration-300 group-hover:text-white"
                    />
                  </div>

                  {/* Content */}
                  <h3 className="mb-2 text-lg font-bold tracking-tight text-[#1B2E5A] transition-colors duration-300 group-hover:text-white">
                    {industry.name}
                  </h3>
                  <p className="mb-6 flex-1 text-sm leading-relaxed text-slate-500 transition-colors duration-300 group-hover:text-slate-400">
                    {industry.hero.subheadline}
                  </p>

                  {/* Stats */}
                  <div className="mb-6 flex items-center gap-4 border-t border-slate-200/60 pt-5 transition-colors duration-300 group-hover:border-white/10">
                    {topStats.map((stat, i) => (
                      <div key={i}>
                        <p className="text-lg font-extrabold tracking-tight text-[#1B2E5A] transition-colors duration-300 group-hover:text-white">
                          {stat.value}
                        </p>
                        <p className="text-[11px] text-slate-400 transition-colors duration-300 group-hover:text-slate-500">
                          {stat.label}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900 transition-colors duration-300 group-hover:text-white">
                    Explore{' '}
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section
        id="contact"
        className="border-t border-slate-100 bg-white px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24"
        style={{
          contentVisibility: 'auto',
          containIntrinsicSize: 'auto 700px',
        }}
      >
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center sm:mb-16">
            <p className="mb-3 text-sm font-semibold tracking-wide text-slate-400">
              Contact
            </p>
            <h2 className="text-2xl font-extrabold tracking-[-0.025em] text-[#1B2E5A] sm:text-3xl lg:text-4xl">
              Talk to our team
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-slate-500 sm:text-lg">
              Whether you&apos;re evaluating Zopkit for your company or have a
              specific question, we&apos;ll get back to you within one business
              day.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-5 lg:gap-12">
            {/* Left — quick info */}
            <div className="space-y-5 lg:col-span-2">
              {[
                {
                  icon: Mail,
                  label: 'Email',
                  value: 'sales@zopkit.com',
                  href: 'mailto:sales@zopkit.com',
                },
                { icon: Phone, label: 'Phone', value: '8971055515' },
                {
                  icon: MapPin,
                  label: 'Office',
                  value: 'Hi-Tech City, Hyderabad',
                },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fafafa]">
                    <item.icon className="h-[18px] w-[18px] text-slate-500" />
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-slate-400">
                      {item.label}
                    </p>
                    {item.href ? (
                      <a
                        href={item.href}
                        className="cursor-pointer text-sm font-semibold text-slate-900 transition-colors hover:text-slate-600"
                      >
                        {item.value}
                      </a>
                    ) : (
                      <p className="text-sm font-semibold text-slate-900">
                        {item.value}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs text-slate-400">
                  Mon – Fri, 9 AM – 6 PM IST
                </p>
              </div>
            </div>

            {/* Right — form */}
            <div className="lg:col-span-3">
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  setIsSubmittingContact(true)
                  try {
                    const response = await api.post(
                      '/contact/submit',
                      contactForm
                    )
                    if (response.data.success) {
                      toast.success(
                        "Thanks! We'll be in touch within one business day."
                      )
                      setContactForm({
                        name: '',
                        email: '',
                        company: '',
                        phone: '',
                        jobTitle: '',
                        companySize: '',
                        preferredTime: '',
                        comments: '',
                      })
                    } else {
                      throw new Error(
                        response.data.message || 'Failed to submit'
                      )
                    }
                  } catch (error: unknown) {
                    const e = error as {
                      response?: { data?: { message?: string } }
                    }
                    toast.error(
                      e.response?.data?.message ||
                        'Something went wrong. Please try again.'
                    )
                  } finally {
                    setIsSubmittingContact(false)
                  }
                }}
                className="space-y-4"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="c-name"
                      className="mb-1.5 block text-sm font-medium text-slate-700"
                    >
                      Name
                    </label>
                    <input
                      type="text"
                      id="c-name"
                      required
                      value={contactForm.name}
                      onChange={(e) =>
                        setContactForm((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-[#1B2E5A]/10 focus:outline-none"
                      placeholder="Jane Smith"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="c-email"
                      className="mb-1.5 block text-sm font-medium text-slate-700"
                    >
                      Work email
                    </label>
                    <input
                      type="email"
                      id="c-email"
                      required
                      value={contactForm.email}
                      onChange={(e) =>
                        setContactForm((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-[#1B2E5A]/10 focus:outline-none"
                      placeholder="jane@company.com"
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="c-company"
                      className="mb-1.5 block text-sm font-medium text-slate-700"
                    >
                      Company
                    </label>
                    <input
                      type="text"
                      id="c-company"
                      required
                      value={contactForm.company}
                      onChange={(e) =>
                        setContactForm((prev) => ({
                          ...prev,
                          company: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-[#1B2E5A]/10 focus:outline-none"
                      placeholder="Acme Inc."
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="c-size"
                      className="mb-1.5 block text-sm font-medium text-slate-700"
                    >
                      Team size
                    </label>
                    <select
                      id="c-size"
                      value={contactForm.companySize}
                      onChange={(e) =>
                        setContactForm((prev) => ({
                          ...prev,
                          companySize: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 transition-colors focus:border-slate-400 focus:ring-2 focus:ring-[#1B2E5A]/10 focus:outline-none"
                    >
                      <option value="">Select</option>
                      <option value="1-10">1-10</option>
                      <option value="11-50">11-50</option>
                      <option value="51-200">51-200</option>
                      <option value="201-500">201-500</option>
                      <option value="500+">500+</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="c-msg"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    How can we help?
                  </label>
                  <textarea
                    id="c-msg"
                    rows={4}
                    value={contactForm.comments}
                    onChange={(e) =>
                      setContactForm((prev) => ({
                        ...prev,
                        comments: e.target.value,
                      }))
                    }
                    className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-[#1B2E5A]/10 focus:outline-none"
                    placeholder="Tell us about your use case, team size, or any questions..."
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmittingContact}
                  className="w-full cursor-pointer rounded-full bg-[#1B2E5A] px-7 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-[#243B6E] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {isSubmittingContact ? 'Sending...' : 'Send message'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Resources Section */}
      <section
        id="resources"
        className="border-t border-slate-100 bg-white px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24"
        style={{
          contentVisibility: 'auto',
          containIntrinsicSize: 'auto 500px',
        }}
      >
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center sm:mb-16">
            <p className="mb-3 text-sm font-semibold tracking-wide text-slate-400">
              Resources
            </p>
            <h2 className="text-2xl font-extrabold tracking-[-0.025em] text-[#1B2E5A] sm:text-3xl lg:text-4xl">
              Everything you need to succeed
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: FileText,
                title: 'Documentation',
                desc: 'Comprehensive guides and API docs',
              },
              {
                icon: GraduationCap,
                title: 'Academy',
                desc: 'Video tutorials and courses',
              },
              {
                icon: Users,
                title: 'Community',
                desc: 'Join our user community',
              },
              { icon: Zap, title: 'Support', desc: '24/7 customer support' },
            ].map((item) => (
              <div
                key={item.title}
                className="group cursor-pointer rounded-2xl bg-[#fafafa] p-6 transition-all duration-300 hover:bg-[#243B6E] sm:p-7"
              >
                <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-white transition-colors duration-300 group-hover:bg-white/10">
                  <item.icon className="h-5 w-5 text-slate-600 transition-colors duration-300 group-hover:text-white" />
                </div>
                <h3 className="mb-1.5 text-base font-bold tracking-tight text-[#1B2E5A] transition-colors duration-300 group-hover:text-white">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-slate-500 transition-colors duration-300 group-hover:text-slate-400">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  )
}

export default Landing
